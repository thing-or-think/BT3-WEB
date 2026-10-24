import { SingleMatchSummary } from '../../domain/evaluation/entities/Submission';
import { Board } from '../../domain/game/entities/Board';
import { Match } from '../../domain/game/entities/Match';
import { BotDecisionDomainService } from '../../domain/game/services/BotDecisionDomainService';
import { Side } from '../../domain/game/types/GameTypes';
import { ScoringPolicy } from '../../domain/ranking/services/ScoringPolicy';
import { TestMatchResultDto } from '../dto/MatchResultDto';
import { RunTestMatchCommand } from '../dto/SubmitCodeDto';
import { IRunTestMatchUseCase } from '../ports/inbound/IRunTestMatchUseCase';
import { CompiledArtifact, ICodeSandboxPort } from '../ports/outbound/ICodeSandboxPort';

export class RunTestMatchUseCase implements IRunTestMatchUseCase {
  constructor(
    private readonly sandboxPort: ICodeSandboxPort,
    private readonly botDomainService: BotDecisionDomainService
  ) {}

  public async executeSingleMatchWithArtifact(
    artifact: CompiledArtifact,
    botLevel: number,
    userSide: Side,
    timeLimitMs = 1200
  ): Promise<SingleMatchSummary> {
    const botProfile = BotDecisionDomainService.getBotProfile(botLevel);
    const match = new Match(botProfile, userSide);
    const session = this.sandboxPort.createSession(artifact);

    let currentSide: Side = 'RED';

    try {
      for (let turn = 1; turn <= Board.MAX_TURNS; turn++) {
        const board = match.getBoard();
        const legalMoves = board.getLegalMoves(currentSide);
        if (legalMoves.length === 0) {
          match.finishByNoMoves(currentSide);
          break;
        }

        if (currentSide === userSide) {
          const stdinPayload = board.formatStdin(currentSide, turn, timeLimitMs);
          const metrics = await session.runTurn(stdinPayload, timeLimitMs);

          if (metrics.status === 'TLE') {
            match.finishByUserFault(
              'TLE',
              'TIMEOUT',
              metrics.errorMessage || `Quá giới hạn thời gian (${timeLimitMs}ms)`,
              metrics.execTimeMs
            );
            break;
          }

          if (metrics.status === 'RE') {
            match.finishByUserFault(
              'RE',
              'RUNTIME_ERROR',
              metrics.errorMessage || 'Lỗi thực thi (Runtime Error)',
              metrics.execTimeMs
            );
            break;
          }

          const check = board.validateMoveOutput(currentSide, metrics.stdout);
          if (!check.valid || !check.move) {
            match.finishByUserFault(
              'INVALID_MOVE',
              'INVALID_MOVE',
              check.reason || 'Nước đi không hợp lệ',
              metrics.execTimeMs
            );
            break;
          }

          const ended = match.recordMove(turn, 'USER', currentSide, check.move, metrics.execTimeMs);
          if (ended) break;
        } else {
          const t0 = process.hrtime.bigint();
          const botMove = this.botDomainService.chooseMove(botProfile.level, board, currentSide);
          const botTimeMs = Math.max(1, Math.round(Number(process.hrtime.bigint() - t0) / 1e6));

          if (!botMove) {
            match.finishByNoMoves(currentSide);
            break;
          }

          const ended = match.recordMove(turn, 'BOT', currentSide, botMove, botTimeMs);
          if (ended) break;
        }

        currentSide = currentSide === 'RED' ? 'BLUE' : 'RED';
      }
    } finally {
      session.dispose();
    }

    if (!match.getWinnerSide()) match.finishByTurnLimit();
    const turnsCount = match.getTurnsCount();
    const outcome = match.getOutcome();
    const score = ScoringPolicy.calculateMatchScore(outcome, botProfile.basePoints, turnsCount);

    return {
      botId: botProfile.id,
      botLevel: botProfile.level,
      botName: botProfile.name,
      botElo: botProfile.elo,
      userSide,
      result: outcome,
      winnerSide: match.getWinnerSide(),
      winReason: match.getWinReason(),
      errorDetail: match.getErrorDetail(),
      turnsCount,
      userTurns: match.getUserTurns(),
      execTimeMs: match.getUserExecTimeMs(),
      score,
      moves: match.getMoves()
    };
  }

  /**
   * Nếu botLevel == 0 -> Chạy Test với cả 4 Bot (Lv1 -> Lv4) cho Client
   * Nếu botLevel in 1..4 -> Chạy Test với 1 Bot được chọn
   */
  public async execute(command: RunTestMatchCommand): Promise<TestMatchResultDto> {
    const compiled = await this.sandboxPort.compile(command.language, command.sourceCode);
    if (!compiled.ok) {
      return {
        status: 'COMPILE_ERROR',
        compileError: compiled.compileError || 'Lỗi biên dịch'
      };
    }

    try {
      const side: Side = command.userSide === 'BLUE' ? 'BLUE' : 'RED';
      if (Number(command.botLevel) === 0) {
        const botMatches: SingleMatchSummary[] = [];
        for (const b of BotDecisionDomainService.BOT_PROFILES) {
          const m = await this.executeSingleMatchWithArtifact(compiled, b.level, side);
          botMatches.push(m);
        }
        return {
          status: 'COMPLETED',
          match: botMatches[botMatches.length - 1],
          botMatches
        };
      }

      const matchSummary = await this.executeSingleMatchWithArtifact(
        compiled,
        command.botLevel,
        side
      );
      return {
        status: 'COMPLETED',
        match: matchSummary,
        botMatches: [matchSummary]
      };
    } finally {
      this.sandboxPort.cleanup(compiled.workDir);
    }
  }
}
