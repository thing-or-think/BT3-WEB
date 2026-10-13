import { BotProfile, CellChar, Side } from '../types/GameTypes';
import { Board } from '../entities/Board';
import { Coordinate } from '../value-objects/Coordinate';
import { Move } from '../value-objects/Move';
import { Piece } from '../value-objects/Piece';

export class BotDecisionDomainService {
  public static readonly BOT_PROFILES: ReadonlyArray<BotProfile> = [
    {
      id: 1,
      level: 1,
      code: 'bot_lv1',
      name: 'Bot Tập Sự (Rookie)',
      elo: 800,
      basePoints: 50,
      badge: 'Đồng',
      description: 'Di chuyển ngẫu nhiên có xu hướng tiến về căn cứ đối phương.'
    },
    {
      id: 2,
      level: 2,
      code: 'bot_lv2',
      name: 'Bot Trinh Sát (Scout)',
      elo: 1100,
      basePoints: 100,
      badge: 'Bạc',
      description: 'Chiến thuật tham lam (Greedy): Ưu tiên ăn quân, né thiên địch và áp sát căn cứ.'
    },
    {
      id: 3,
      level: 3,
      code: 'bot_lv3',
      name: 'Bot Chiến Thuật (Tactician)',
      elo: 1450,
      basePoints: 175,
      badge: 'Vàng',
      description: 'Minimax cắt tỉa Alpha-Beta (Độ sâu 3) cân bằng giữa tấn công và bảo vệ cờ.'
    },
    {
      id: 4,
      level: 4,
      code: 'bot_lv4',
      name: 'Bot Đại Sư (Grandmaster)',
      elo: 1800,
      basePoints: 250,
      badge: 'Kim Cương',
      description: 'Alpha-Beta nâng cao (Độ sâu 4) + Săn mồi theo khắc chế hệ Đấm-Lá-Kéo & Phòng thủ căn cứ.'
    }
  ];

  public static getBotProfile(level: number): BotProfile {
    return (
      BotDecisionDomainService.BOT_PROFILES.find(b => b.level === Number(level)) ||
      BotDecisionDomainService.BOT_PROFILES[0]
    );
  }

  public chooseMove(level: number, board: Board, side: Side): Move | null {
    switch (Number(level)) {
      case 1:
        return this.chooseMoveLv1(board, side);
      case 2:
        return this.chooseMoveLv2(board, side);
      case 3:
        return this.chooseMoveMinimax(board, side, 3, false);
      case 4:
      default:
        return this.chooseMoveMinimax(board, side, 4, true);
    }
  }

  private isSquareThreatened(board: Board, r: number, c: number, myPieceChar: CellChar): boolean {
    const grid = board.getGrid();
    for (const [dr, dc] of Board.DIRS) {
      const nr = r + dr;
      const nc = c + dc;
      if (nr < 0 || nr >= Board.SIZE || nc < 0 || nc >= Board.SIZE) continue;
      const neighbor = grid[nr][nc];
      if (neighbor !== '.' && Piece.canCaptureChar(neighbor, myPieceChar)) {
        return true;
      }
    }
    return false;
  }

  private chooseMoveLv1(board: Board, side: Side): Move | null {
    const moves = board.getLegalMoves(side);
    if (moves.length === 0) return null;

    const targetBase = Coordinate.getTargetBase(side);
    for (const m of moves) {
      if (m.toR === targetBase.row && m.toC === targetBase.col) return m;
    }

    const scored = moves.map(m => {
      const oldDist = m.fromCoord.manhattanDistanceTo(targetBase);
      const newDist = m.toCoord.manhattanDistanceTo(targetBase);
      const stepGain = oldDist - newDist;
      const score = stepGain * 10 + (m.captured ? 25 : 0) + Math.random() * 35;
      return { m, score };
    });

    scored.sort((a, b) => b.score - a.score);
    return scored[0].m;
  }

  private chooseMoveLv2(board: Board, side: Side): Move | null {
    const moves = board.getLegalMoves(side);
    if (moves.length === 0) return null;

    const targetBase = Coordinate.getTargetBase(side);
    const ownBase = Coordinate.getOwnBase(side);

    let bestMove = moves[0];
    let bestScore = -Infinity;

    for (const m of moves) {
      if (m.toR === targetBase.row && m.toC === targetBase.col) return m;

      const nextBoard = board.applyMove(m);
      const oldDist = m.fromCoord.manhattanDistanceTo(targetBase);
      const newDist = m.toCoord.manhattanDistanceTo(targetBase);

      let score = (oldDist - newDist) * 18 + (16 - newDist) * 2;
      if (m.captured) {
        score += 85;
        const enemyDistToOurBase = m.toCoord.manhattanDistanceTo(ownBase);
        if (enemyDistToOurBase <= 5) score += 45;
      }

      if (this.isSquareThreatened(nextBoard, m.toR, m.toC, m.piece)) {
        score -= 75;
      }

      score += Math.random() * 4;
      if (score > bestScore) {
        bestScore = score;
        bestMove = m;
      }
    }

    return bestMove;
  }

  public evaluateBoard(board: Board, perspectiveSide: Side, advanced = false): number {
    const oppSide: Side = perspectiveSide === 'RED' ? 'BLUE' : 'RED';
    const myTarget = Coordinate.getTargetBase(perspectiveSide);
    const oppTarget = Coordinate.getTargetBase(oppSide);
    const grid = board.getGrid();

    if (Piece.getSide(grid[myTarget.row][myTarget.col]) === perspectiveSide) return 100000;
    if (Piece.getSide(grid[oppTarget.row][oppTarget.col]) === oppSide) return -100000;

    let score = 0;
    const myPieces: Array<{ ch: CellChar; r: number; c: number }> = [];
    const oppPieces: Array<{ ch: CellChar; r: number; c: number }> = [];

    for (let r = 0; r < Board.SIZE; r++) {
      for (let c = 0; c < Board.SIZE; c++) {
        const ch = grid[r][c];
        if (ch === '.') continue;
        if (Piece.getSide(ch) === perspectiveSide) {
          myPieces.push({ ch, r, c });
        } else {
          oppPieces.push({ ch, r, c });
        }
      }
    }

    if (oppPieces.length === 0) return 90000;
    if (myPieces.length === 0) return -90000;

    for (const p of myPieces) {
      const distToGoal = Math.abs(p.r - myTarget.row) + Math.abs(p.c - myTarget.col);
      score += 120 + (16 - distToGoal) * (16 - distToGoal) * 1.4;
      if (distToGoal === 1) score += 450;
      else if (distToGoal === 2) score += 140;
    }

    for (const p of oppPieces) {
      const distToGoal = Math.abs(p.r - oppTarget.row) + Math.abs(p.c - oppTarget.col);
      score -= 120 + (16 - distToGoal) * (16 - distToGoal) * 1.45;
      if (distToGoal === 1) score -= 500;
      else if (distToGoal === 2) score -= 160;
    }

    if (advanced) {
      for (const mp of myPieces) {
        for (const op of oppPieces) {
          const dist = Math.abs(mp.r - op.r) + Math.abs(mp.c - op.c);
          if (Piece.canCaptureChar(mp.ch, op.ch)) {
            if (dist === 1) score += 65;
            else if (dist <= 4) score += (6 - dist) * 7;

            const oppDistBase = Math.abs(op.r - oppTarget.row) + Math.abs(op.c - oppTarget.col);
            if (oppDistBase <= 5) {
              score += (7 - dist) * 10;
            }
          } else if (Piece.canCaptureChar(op.ch, mp.ch)) {
            if (dist === 1) score -= 75;
          }
        }
      }
    }

    return score;
  }

  private orderMoves(moves: Move[], side: Side): Move[] {
    const target = Coordinate.getTargetBase(side);
    return moves
      .map(m => {
        let prio = 0;
        if (m.toR === target.row && m.toC === target.col) prio += 10000;
        if (m.captured) prio += 500;
        const oldD = m.fromCoord.manhattanDistanceTo(target);
        const newD = m.toCoord.manhattanDistanceTo(target);
        prio += (oldD - newD) * 20;
        return { m, prio };
      })
      .sort((a, b) => b.prio - a.prio)
      .map(x => x.m);
  }

  private minimax(
    board: Board,
    depth: number,
    alpha: number,
    beta: number,
    maximizingPlayer: boolean,
    currentSide: Side,
    rootSide: Side,
    advanced: boolean
  ): number {
    const myTarget = Coordinate.getTargetBase(rootSide);
    const oppTarget = Coordinate.getOwnBase(rootSide);
    const oppRootSide: Side = rootSide === 'RED' ? 'BLUE' : 'RED';
    const grid = board.getGrid();

    if (Piece.getSide(grid[myTarget.row][myTarget.col]) === rootSide) {
      return 100000 + depth * 100;
    }
    if (Piece.getSide(grid[oppTarget.row][oppTarget.col]) === oppRootSide) {
      return -100000 - depth * 100;
    }

    if (depth === 0) {
      return this.evaluateBoard(board, rootSide, advanced);
    }

    const rawMoves = board.getLegalMoves(currentSide);
    if (rawMoves.length === 0) {
      return currentSide === rootSide ? -95000 - depth * 50 : 95000 + depth * 50;
    }

    const ordered = this.orderMoves(rawMoves, currentSide).slice(0, advanced ? 14 : 12);
    const nextSide: Side = currentSide === 'RED' ? 'BLUE' : 'RED';

    if (maximizingPlayer) {
      let maxEval = -Infinity;
      for (const move of ordered) {
        const nextBoard = board.applyMove(move);
        const ev = this.minimax(nextBoard, depth - 1, alpha, beta, false, nextSide, rootSide, advanced);
        if (ev > maxEval) maxEval = ev;
        if (ev > alpha) alpha = ev;
        if (beta <= alpha) break;
      }
      return maxEval;
    } else {
      let minEval = Infinity;
      for (const move of ordered) {
        const nextBoard = board.applyMove(move);
        const ev = this.minimax(nextBoard, depth - 1, alpha, beta, true, nextSide, rootSide, advanced);
        if (ev < minEval) minEval = ev;
        if (ev < beta) beta = ev;
        if (beta <= alpha) break;
      }
      return minEval;
    }
  }

  private chooseMoveMinimax(board: Board, side: Side, depth: number, advanced: boolean): Move | null {
    const rawMoves = board.getLegalMoves(side);
    if (rawMoves.length === 0) return null;

    const target = Coordinate.getTargetBase(side);
    for (const m of rawMoves) {
      if (m.toR === target.row && m.toC === target.col) return m;
    }

    const ordered = this.orderMoves(rawMoves, side);
    let bestMove = ordered[0];
    let bestVal = -Infinity;
    let alpha = -Infinity;
    const beta = Infinity;
    const nextSide: Side = side === 'RED' ? 'BLUE' : 'RED';

    for (const move of ordered) {
      const nextBoard = board.applyMove(move);
      const val =
        this.minimax(nextBoard, depth - 1, alpha, beta, false, nextSide, side, advanced) +
        (Math.random() * 1.5 - 0.75);
      if (val > bestVal) {
        bestVal = val;
        bestMove = move;
      }
      if (val > alpha) alpha = val;
    }

    return bestMove;
  }
}
