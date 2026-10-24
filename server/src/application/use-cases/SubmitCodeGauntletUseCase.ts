import crypto from 'crypto';
import {
  LadderMatchSummary,
  SingleMatchSummary,
  Submission
} from '../../domain/evaluation/entities/Submission';
import { Board } from '../../domain/game/entities/Board';
import { SEED_PLAYERS_CODE } from '../../domain/game/services/StarterTemplates';
import {
  MatchOutcome,
  MoveRecord,
  Side,
  SupportedLanguage,
  WinReason
} from '../../domain/game/types/GameTypes';
import { Competitor } from '../../domain/ranking/entities/Competitor';
import { SubmitGauntletResultDto } from '../dto/MatchResultDto';
import { SubmitCodeCommand } from '../dto/SubmitCodeDto';
import { ISubmitCodeGauntletUseCase } from '../ports/inbound/ISubmitCodeGauntletUseCase';
import { CompiledArtifact, ICodeSandboxPort } from '../ports/outbound/ICodeSandboxPort';
import { ILeaderboardRepositoryPort } from '../ports/outbound/ILeaderboardRepositoryPort';
import { ISubmissionRepositoryPort } from '../ports/outbound/ISubmissionRepositoryPort';
import { RunTestMatchUseCase } from './RunTestMatchUseCase';

export class SubmitCodeGauntletUseCase implements ISubmitCodeGauntletUseCase {
  constructor(
    private readonly sandboxPort: ICodeSandboxPort,
    private readonly leaderboardRepo: ILeaderboardRepositoryPort,
    private readonly submissionRepo: ISubmissionRepositoryPort,
    private readonly _testMatchRunner: RunTestMatchUseCase
  ) {}

  /**
   * Đấu đối kháng trực tiếp giữa 2 bản Code (Challenger cầm RED vs Defender cầm BLUE)
   */
  private async runPvpCodeMatch(params: {
    stepNumber: number;
    challengerArtifact: CompiledArtifact;
    defenderArtifact: CompiledArtifact;
    defenderRankBefore: number;
    defenderUsername: string;
    defenderLanguage: SupportedLanguage;
    timeLimitMs?: number;
  }): Promise<LadderMatchSummary> {
    const timeLimitMs = params.timeLimitMs || 1200;
    const challengerSide: Side = 'RED';
    let board = new Board();

    const challengerSession = this.sandboxPort.createSession(params.challengerArtifact);
    const defenderSession = this.sandboxPort.createSession(params.defenderArtifact);

    const moves: MoveRecord[] = [];
    let currentSide: Side = 'RED';
    let result: MatchOutcome = 'LOSS';
    let winnerSide: Side | null = null;
    let winReason: WinReason = 'MAX_TURNS';
    let errorDetail: string | null = null;
    let challengerExecTimeMs = 0;
    let decided = false;

    try {
      for (let turn = 1; turn <= Board.MAX_TURNS; turn++) {
        const legalMoves = board.getLegalMoves(currentSide);
        if (legalMoves.length === 0) {
          winnerSide = currentSide === 'RED' ? 'BLUE' : 'RED';
          result = winnerSide === challengerSide ? 'WIN' : 'LOSS';
          winReason = 'NO_MOVES';
          decided = true;
          break;
        }

        const isChallengerTurn = currentSide === challengerSide;
        const activeSession = isChallengerTurn ? challengerSession : defenderSession;
        const stdinStr = board.formatStdin(currentSide, turn, timeLimitMs);
        const metrics = await activeSession.runTurn(stdinStr, timeLimitMs);

        if (isChallengerTurn) {
          challengerExecTimeMs += metrics.execTimeMs;
        }

        if (metrics.status === 'TLE' || metrics.status === 'RE') {
          if (isChallengerTurn) {
            winnerSide = 'BLUE';
            result = metrics.status;
            winReason = metrics.status === 'TLE' ? 'TIMEOUT' : 'RUNTIME_ERROR';
            errorDetail = metrics.errorMessage;
          } else {
            // Defender bị lỗi -> Challenger thắng
            winnerSide = 'RED';
            result = 'WIN';
            winReason = metrics.status === 'TLE' ? 'TIMEOUT' : 'RUNTIME_ERROR';
          }
          decided = true;
          break;
        }

        const check = board.validateMoveOutput(currentSide, metrics.stdout);
        if (!check.valid || !check.move) {
          if (isChallengerTurn) {
            winnerSide = 'BLUE';
            result = 'INVALID_MOVE';
            winReason = 'INVALID_MOVE';
            errorDetail = check.reason || 'Nước đi không hợp lệ';
          } else {
            winnerSide = 'RED';
            result = 'WIN';
            winReason = 'INVALID_MOVE';
          }
          decided = true;
          break;
        }

        const move = check.move;
        board = board.applyMove(move);
        moves.push({
          turn,
          actor: isChallengerTurn ? 'USER' : 'BOT',
          side: currentSide,
          piece: move.piece,
          from: move.from,
          to: move.to,
          captured: move.captured,
          timeMs: metrics.execTimeMs
        });

        if (Board.isEnemyBase(currentSide, move.toR, move.toC)) {
          winnerSide = currentSide;
          result = currentSide === challengerSide ? 'WIN' : 'LOSS';
          winReason = 'BASE_CAPTURE';
          decided = true;
          break;
        }

        currentSide = currentSide === 'RED' ? 'BLUE' : 'RED';
      }

      if (!decided) {
        // Phân định thắng thua khi hết 160 lượt bằng Tie-break (số quân -> khoảng cách tới căn cứ)
        winnerSide = board.resolveTieBreakWinner();
        result = winnerSide === challengerSide ? 'WIN' : 'LOSS';
        winReason = 'MAX_TURNS';
      }
    } finally {
      challengerSession.dispose();
      defenderSession.dispose();
    }

    return {
      stepNumber: params.stepNumber,
      defenderRankBefore: params.defenderRankBefore,
      defenderUsername: params.defenderUsername,
      defenderLanguage: params.defenderLanguage,
      userSide: challengerSide,
      result,
      winnerSide,
      winReason,
      errorDetail,
      turnsCount: moves.length,
      execTimeMs: challengerExecTimeMs,
      moves
    };
  }

  /**
   * USE CASE LEO THÁP XẾP HẠNG TỪ DƯỚI LÊN (Bottom-Up Ladder Climbing):
   * Đấu với từng người chơi trên BXH từ vị trí thấp nhất (#N) lên vị trí #1.
   * Thắng thì leo tiếp, thua ở đâu thì xếp hạng ngay tại dưới người đó!
   */
  public async execute(command: SubmitCodeCommand): Promise<SubmitGauntletResultDto> {
    const cleanUsername = (command.username || 'Player_01').trim().slice(0, 32) || 'Player_01';
    const existing = this.leaderboardRepo.findCompetitorByUsername(cleanUsername);

    const compiledChallenger = await this.sandboxPort.compile(command.language, command.sourceCode);
    if (!compiledChallenger.ok) {
      const failedSub = new Submission(
        `sub_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`,
        command.userId || (existing ? existing.id : `user_${crypto.randomBytes(4).toString('hex')}`),
        cleanUsername,
        command.language,
        command.sourceCode,
        'COMPILE_ERROR',
        compiledChallenger.compileError || 'Lỗi biên dịch',
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        existing ? existing.elo : 1000,
        [],
        new Date().toISOString(),
        [],
        null,
        null
      );
      this.submissionRepo.saveSubmission(failedSub);
      const bxh = this.leaderboardRepo.getRankedLeaderboard();
      const myRank = bxh.find(e => e.username.toLowerCase() === cleanUsername.toLowerCase());
      return {
        submission: failedSub,
        userRank: myRank ? myRank.rank : null,
        stoppedBy: null,
        ladderMatches: [],
        leaderboard: bxh
      };
    }

    // Lấy danh sách những người chơi khác đang giữ hạng trên BXH (từ #1 xuống #N)
    const allCompetitors = this.leaderboardRepo.getOrderedCompetitors();
    const otherDefenders = allCompetitors.filter(
      u => u.username.toLowerCase() !== cleanUsername.toLowerCase()
    );

    const ladderMatches: LadderMatchSummary[] = [];
    let insertIndex = otherDefenders.length; // Mặc định ở cuối bảng (#N+1)
    let stoppedBy: string | null = null;
    let winsCount = 0;
    let lossesCount = 0;
    let totalTurns = 0;
    let totalExecTimeMs = 0;

    try {
      // VÒNG LẶP ĐẤU TỪ DƯỚI LÊN (từ người cuối bảng idx = N-1 lên người đầu bảng idx = 0)
      for (let idx = otherDefenders.length - 1; idx >= 0; idx--) {
        const defender = otherDefenders[idx];
        const defenderLang: SupportedLanguage =
          defender.bestLanguage === 'system' ? 'python' : defender.bestLanguage;
        const defenderCode = defender.sourceCode || SEED_PLAYERS_CODE.rank3_rusher_py;

        const compiledDefender = await this.sandboxPort.compile(defenderLang, defenderCode);
        try {
          let matchSummary: LadderMatchSummary;
          if (!compiledDefender.ok) {
            // Nếu code của Defender lỗi thì Challenger nghiễm nhiên vượt qua
            matchSummary = {
              stepNumber: ladderMatches.length + 1,
              defenderRankBefore: idx + 1,
              defenderUsername: defender.username,
              defenderLanguage: defenderLang,
              userSide: 'RED',
              result: 'WIN',
              winnerSide: 'RED',
              winReason: 'RUNTIME_ERROR',
              errorDetail: null,
              turnsCount: 0,
              execTimeMs: 1,
              moves: []
            };
          } else {
            matchSummary = await this.runPvpCodeMatch({
              stepNumber: ladderMatches.length + 1,
              challengerArtifact: compiledChallenger,
              defenderArtifact: compiledDefender,
              defenderRankBefore: idx + 1,
              defenderUsername: defender.username,
              defenderLanguage: defenderLang
            });
          }

          ladderMatches.push(matchSummary);
          totalTurns += matchSummary.turnsCount;
          totalExecTimeMs += matchSummary.execTimeMs;

          if (matchSummary.result === 'WIN') {
            winsCount += 1;
            insertIndex = idx; // Vượt qua người ở vị trí idx, tiếp tục thách đấu idx - 1!
          } else {
            lossesCount += 1;
            stoppedBy = defender.username;
            insertIndex = idx + 1; // DỪNG LẠI NGAY DƯỚI DEFENDER NÀY!
            break;
          }
        } finally {
          this.sandboxPort.cleanup(compiledDefender.workDir);
        }
      }
    } finally {
      this.sandboxPort.cleanup(compiledChallenger.workDir);
    }

    const finalRank = insertIndex + 1;
    const totalScore = Math.max(100, (otherDefenders.length - insertIndex + 1) * 280 + winsCount * 60);
    const newElo = Math.max(850, 1750 - (finalRank - 1) * 160);

    const challengerCompetitor = new Competitor(
      command.userId || (existing ? existing.id : `user_${crypto.randomBytes(4).toString('hex')}`),
      cleanUsername,
      false,
      command.language,
      totalScore,
      newElo,
      winsCount,
      winsCount,
      ladderMatches.length,
      Math.max(1, totalExecTimeMs),
      (existing ? existing.submissionsCount : 0) + 1,
      new Date().toISOString(),
      command.sourceCode,
      stoppedBy
    );

    // Chèn người chơi vào đúng vị trí insertIndex trên BXH (đẩy những người đã thua xuống 1 bậc)
    const updatedLadder = [...otherDefenders];
    updatedLadder.splice(insertIndex, 0, challengerCompetitor);

    // Cập nhật lại điểm/Elo hiển thị tương ứng vị trí bậc thang
    updatedLadder.forEach((comp, i) => {
      if (i > insertIndex) {
        comp.bestScore = Math.min(comp.bestScore, Math.max(100, challengerCompetitor.bestScore - (i - insertIndex) * 120));
      }
    });

    this.leaderboardRepo.saveOrderedCompetitors(updatedLadder);

    // Chuyển đổi ladderMatches sang định dạng tương thích SingleMatchSummary cho Replay
    const compatMatches: SingleMatchSummary[] = ladderMatches.map(lm => ({
      botId: lm.stepNumber,
      botLevel: lm.defenderRankBefore,
      botName: `[Hạng #${lm.defenderRankBefore}] ${lm.defenderUsername} (${lm.defenderLanguage.toUpperCase()})`,
      botElo: 1200,
      userSide: lm.userSide,
      result: lm.result,
      winnerSide: lm.winnerSide,
      winReason: lm.winReason,
      errorDetail: lm.errorDetail,
      turnsCount: lm.turnsCount,
      userTurns: Math.ceil(lm.turnsCount / 2),
      execTimeMs: lm.execTimeMs,
      score: lm.result === 'WIN' ? 300 : 0,
      moves: lm.moves
    }));

    const submission = new Submission(
      `sub_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`,
      challengerCompetitor.id,
      challengerCompetitor.username,
      command.language,
      command.sourceCode,
      'COMPLETED',
      null,
      totalScore,
      winsCount,
      0,
      lossesCount,
      winsCount,
      totalTurns,
      totalExecTimeMs,
      newElo,
      compatMatches,
      new Date().toISOString(),
      ladderMatches,
      finalRank,
      stoppedBy
    );

    this.submissionRepo.saveSubmission(submission);

    const leaderboard = this.leaderboardRepo.getRankedLeaderboard();
    return {
      submission,
      userRank: finalRank,
      stoppedBy,
      ladderMatches,
      leaderboard
    };
  }
}
