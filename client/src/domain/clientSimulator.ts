import { cloneGrid, coordToRC, rcToCoord } from './boardModel';
import { chooseClientBotMove, CLIENT_BOT_PROFILES, getLegalMovesForSide } from './clientBots';
import { CellChar, MatchSummary, MoveRecord, Side } from './types';

export interface BotPlayerConfig {
  name: string;
  level?: number;
  jsCode?: string;
  side: Side;
}

export class ClientMatchSimulator {
  public static readonly INITIAL_BOARD: CellChar[][] = [
    ['.', 'r', '.', 'p', '.', 's', '.', 'r', '.'],
    ['p', '.', 's', '.', 'r', '.', 'p', '.', 's'],
    ['.', '.', '.', '.', '.', '.', '.', '.', '.'],
    ['.', '.', '.', '.', '.', '.', '.', '.', '.'],
    ['.', '.', '.', '.', '.', '.', '.', '.', '.'],
    ['.', '.', '.', '.', '.', '.', '.', '.', '.'],
    ['.', '.', '.', '.', '.', '.', '.', '.', '.'],
    ['S', '.', 'P', '.', 'R', '.', 'S', '.', 'P'],
    ['.', 'R', '.', 'S', '.', 'P', '.', 'R', '.']
  ];

  /**
   * Biên dịch hàm chooseMove từ code JavaScript của người dùng
   */
  public static compileJsBot(code: string): ((board: CellChar[][], side: Side, moves: any[]) => string | null) | null {
    try {
      // Bọc code người dùng trong một closure an toàn
      const wrapped = `
        ${code}
        if (typeof chooseMove === 'function') {
          return chooseMove(board, side, legalMoves);
        }
        return null;
      `;
      const fn = new Function('board', 'side', 'legalMoves', wrapped);
      return (board: CellChar[][], side: Side, moves: any[]) => {
        try {
          return fn(board, side, moves);
        } catch (e) {
          console.warn('Lỗi khi bot thực thi chooseMove:', e);
          return null;
        }
      };
    } catch (err) {
      console.error('Lỗi cú pháp trong JS Bot:', err);
      return null;
    }
  }

  /**
   * Mô phỏng toàn bộ ván đấu 160 lượt giữa Challenger (RED) và Defender (BLUE)
   */
  public static simulateMatch(params: {
    challenger: BotPlayerConfig;
    defender: BotPlayerConfig;
    maxTurns?: number;
  }): MatchSummary {
    const maxTurns = params.maxTurns || 160;
    let board = cloneGrid(ClientMatchSimulator.INITIAL_BOARD);
    const moves: MoveRecord[] = [];

    const challengerFn = params.challenger.jsCode
      ? ClientMatchSimulator.compileJsBot(params.challenger.jsCode)
      : null;
    const defenderFn = params.defender.jsCode
      ? ClientMatchSimulator.compileJsBot(params.defender.jsCode)
      : null;

    let currentSide: Side = 'RED';
    let winnerSide: Side | null = null;
    let winReason = 'MAX_TURNS';
    let errorDetail: string | null = null;

    const tStart = performance.now();

    for (let turn = 1; turn <= maxTurns; turn++) {
      const legalMoves = getLegalMovesForSide(board, currentSide);
      if (legalMoves.length === 0) {
        winnerSide = currentSide === 'RED' ? 'BLUE' : 'RED';
        winReason = 'NO_MOVES';
        break;
      }

      const isChallengerTurn = currentSide === params.challenger.side;
      let chosenMoveStr: string | null = null;

      if (isChallengerTurn) {
        if (challengerFn) {
          chosenMoveStr = challengerFn(board, currentSide, legalMoves);
        } else if (params.challenger.level !== undefined) {
          const m = chooseClientBotMove(params.challenger.level, board, currentSide);
          if (m) chosenMoveStr = `${m.from} ${m.to}`;
        }
      } else {
        if (defenderFn) {
          chosenMoveStr = defenderFn(board, currentSide, legalMoves);
        } else if (params.defender.level !== undefined) {
          const m = chooseClientBotMove(params.defender.level, board, currentSide);
          if (m) chosenMoveStr = `${m.from} ${m.to}`;
        }
      }

      // Xác thực nước đi
      let selectedMove = legalMoves[0]; // Mặc định fallback
      if (chosenMoveStr && typeof chosenMoveStr === 'string') {
        const parts = chosenMoveStr.trim().split(/\s+/);
        if (parts.length >= 2) {
          const from = parts[0].toLowerCase();
          const to = parts[1].toLowerCase();
          const match = legalMoves.find(m => m.from === from && m.to === to);
          if (match) {
            selectedMove = match;
          } else {
            errorDetail = `Nước đi ${chosenMoveStr} không hợp lệ!`;
          }
        }
      }

      // Áp dụng nước đi
      board[selectedMove.toR][selectedMove.toC] = board[selectedMove.fromR][selectedMove.fromC];
      board[selectedMove.fromR][selectedMove.fromC] = '.';

      moves.push({
        turn,
        actor: isChallengerTurn ? 'USER' : 'BOT',
        side: currentSide,
        piece: selectedMove.piece,
        from: selectedMove.from,
        to: selectedMove.to,
        captured: selectedMove.captured,
        timeMs: 1
      });

      // Kiểm tra chiếm căn cứ đối phương
      if (currentSide === 'RED' && selectedMove.toR === 0 && selectedMove.toC === 8) {
        winnerSide = 'RED';
        winReason = 'BASE_CAPTURE';
        break;
      }
      if (currentSide === 'BLUE' && selectedMove.toR === 8 && selectedMove.toC === 0) {
        winnerSide = 'BLUE';
        winReason = 'BASE_CAPTURE';
        break;
      }

      currentSide = currentSide === 'RED' ? 'BLUE' : 'RED';
    }

    // Nếu hết 160 lượt chưa ai chiếm căn cứ -> Tie break
    if (!winnerSide) {
      let redCount = 0;
      let blueCount = 0;
      for (let r = 0; r < 9; r++) {
        for (let c = 0; c < 9; c++) {
          const p = board[r][c];
          if (p === 'R' || p === 'P' || p === 'S') redCount++;
          if (p === 'r' || p === 'p' || p === 's') blueCount++;
        }
      }

      if (redCount > blueCount) {
        winnerSide = 'RED';
        winReason = 'MAX_TURNS';
      } else if (blueCount > redCount) {
        winnerSide = 'BLUE';
        winReason = 'MAX_TURNS';
      } else {
        // Bằng quân -> tính khoảng cách gần căn cứ địch hơn
        let redMinDist = 99;
        let blueMinDist = 99;
        for (let r = 0; r < 9; r++) {
          for (let c = 0; c < 9; c++) {
            const p = board[r][c];
            if (p === 'R' || p === 'P' || p === 'S') {
              redMinDist = Math.min(redMinDist, r + (8 - c));
            }
            if (p === 'r' || p === 'p' || p === 's') {
              blueMinDist = Math.min(blueMinDist, (8 - r) + c);
            }
          }
        }
        winnerSide = redMinDist <= blueMinDist ? 'RED' : 'BLUE';
        winReason = 'MAX_TURNS';
      }
    }

    const elapsed = Math.max(1, Math.round(performance.now() - tStart));
    const userWon = winnerSide === params.challenger.side;

    return {
      botId: params.defender.level || 99,
      botLevel: params.defender.level || 4,
      botName: params.defender.name,
      botElo: 1200 + (params.defender.level || 4) * 150,
      userSide: params.challenger.side,
      result: userWon ? 'WIN' : 'LOSS',
      winnerSide,
      winReason,
      errorDetail,
      turnsCount: moves.length,
      userTurns: Math.ceil(moves.length / 2),
      execTimeMs: elapsed,
      score: userWon ? 300 : 50,
      moves
    };
  }
}
