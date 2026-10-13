import { canCapture, cloneGrid, DIRS, getPieceSide, rcToCoord } from './boardModel';
import { CellChar, MoveRecord, Side } from './types';

export interface ClientBotMove {
  from: string;
  to: string;
  fromR: number;
  fromC: number;
  toR: number;
  toC: number;
  piece: CellChar;
  captured: CellChar | null;
}

export const CLIENT_BOT_PROFILES = [
  {
    level: 1,
    name: 'Bot Lv1: Tập Sự (Rookie - Client)',
    elo: 800,
    description: 'Di chuyển ngẫu nhiên có trọng số tiến về căn cứ đối phương.'
  },
  {
    level: 2,
    name: 'Bot Lv2: Trinh Sát (Scout - Client)',
    elo: 1100,
    description: 'Greedy 1-ply: Ưu tiên ăn quân khắc chế, né thiên địch.'
  },
  {
    level: 3,
    name: 'Bot Lv3: Chiến Thuật (Tactician - Client)',
    elo: 1450,
    description: 'Minimax cắt tỉa Alpha-Beta (Độ sâu 3) chạy trực tiếp tại Client.'
  },
  {
    level: 4,
    name: 'Bot Lv4: Đại Sư (Grandmaster - Client)',
    elo: 1800,
    description: 'Alpha-Beta nâng cao (Độ sâu 4) + Săn mồi hệ Đấm-Lá-Kéo tại Client.'
  }
];

function getTargetBase(side: Side): { r: number; c: number } {
  return side === 'RED' ? { r: 0, c: 8 } : { r: 8, c: 0 };
}

function getOwnBase(side: Side): { r: number; c: number } {
  return side === 'RED' ? { r: 8, c: 0 } : { r: 0, c: 8 };
}

export function getLegalMovesForSide(board: CellChar[][], side: Side): ClientBotMove[] {
  const moves: ClientBotMove[] = [];
  const ownBase = getOwnBase(side);

  for (let r = 0; r < 9; r++) {
    for (let c = 0; c < 9; c++) {
      const piece = board[r][c];
      if (getPieceSide(piece) !== side) continue;

      for (const [dr, dc] of DIRS) {
        const nr = r + dr;
        const nc = c + dc;
        if (nr < 0 || nr >= 9 || nc < 0 || nc >= 9) continue;
        if (nr === ownBase.r && nc === ownBase.c) continue;

        const target = board[nr][nc];
        if (target === '.' || canCapture(piece, target)) {
          moves.push({
            from: rcToCoord(r, c),
            to: rcToCoord(nr, nc),
            fromR: r,
            fromC: c,
            toR: nr,
            toC: nc,
            piece,
            captured: target === '.' ? null : target
          });
        }
      }
    }
  }
  return moves;
}

function applyClientMove(board: CellChar[][], move: ClientBotMove): CellChar[][] {
  const next = cloneGrid(board);
  next[move.toR][move.toC] = next[move.fromR][move.fromC];
  next[move.fromR][move.fromC] = '.';
  return next;
}

function isThreatened(board: CellChar[][], r: number, c: number, myPiece: CellChar): boolean {
  for (const [dr, dc] of DIRS) {
    const nr = r + dr;
    const nc = c + dc;
    if (nr < 0 || nr >= 9 || nc < 0 || nc >= 9) continue;
    const nb = board[nr][nc];
    if (nb !== '.' && canCapture(nb, myPiece)) return true;
  }
  return false;
}

function evaluateBoardClient(board: CellChar[][], rootSide: Side, advanced: boolean): number {
  const oppSide: Side = rootSide === 'RED' ? 'BLUE' : 'RED';
  const myTarget = getTargetBase(rootSide);
  const oppTarget = getTargetBase(oppSide);

  if (getPieceSide(board[myTarget.r][myTarget.c]) === rootSide) return 100000;
  if (getPieceSide(board[oppTarget.r][oppTarget.c]) === oppSide) return -100000;

  let score = 0;
  const myPieces: Array<{ ch: CellChar; r: number; c: number }> = [];
  const oppPieces: Array<{ ch: CellChar; r: number; c: number }> = [];

  for (let r = 0; r < 9; r++) {
    for (let c = 0; c < 9; c++) {
      const ch = board[r][c];
      if (ch === '.') continue;
      if (getPieceSide(ch) === rootSide) myPieces.push({ ch, r, c });
      else oppPieces.push({ ch, r, c });
    }
  }

  if (oppPieces.length === 0) return 90000;
  if (myPieces.length === 0) return -90000;

  for (const p of myPieces) {
    const d = Math.abs(p.r - myTarget.r) + Math.abs(p.c - myTarget.c);
    score += 120 + (16 - d) * (16 - d) * 1.4;
    if (d === 1) score += 450;
  }

  for (const p of oppPieces) {
    const d = Math.abs(p.r - oppTarget.r) + Math.abs(p.c - oppTarget.c);
    score -= 120 + (16 - d) * (16 - d) * 1.45;
    if (d === 1) score -= 500;
  }

  if (advanced) {
    for (const mp of myPieces) {
      for (const op of oppPieces) {
        const dist = Math.abs(mp.r - op.r) + Math.abs(mp.c - op.c);
        if (canCapture(mp.ch, op.ch)) {
          if (dist === 1) score += 65;
          else if (dist <= 4) score += (6 - dist) * 7;
        } else if (canCapture(op.ch, mp.ch) && dist === 1) {
          score -= 75;
        }
      }
    }
  }

  return score;
}

function minimaxClient(
  board: CellChar[][],
  depth: number,
  alpha: number,
  beta: number,
  maximizing: boolean,
  currentSide: Side,
  rootSide: Side,
  advanced: boolean
): number {
  const myTarget = getTargetBase(rootSide);
  const oppTarget = getOwnBase(rootSide);
  const oppRoot: Side = rootSide === 'RED' ? 'BLUE' : 'RED';

  if (getPieceSide(board[myTarget.r][myTarget.c]) === rootSide) return 100000 + depth * 100;
  if (getPieceSide(board[oppTarget.r][oppTarget.c]) === oppRoot) return -100000 - depth * 100;
  if (depth === 0) return evaluateBoardClient(board, rootSide, advanced);

  const moves = getLegalMovesForSide(board, currentSide);
  if (moves.length === 0) return currentSide === rootSide ? -95000 : 95000;

  const target = getTargetBase(currentSide);
  const ordered = moves
    .sort((a, b) => {
      const aCap = a.captured ? 500 : 0;
      const bCap = b.captured ? 500 : 0;
      const aStep =
        Math.abs(a.fromR - target.r) +
        Math.abs(a.fromC - target.c) -
        (Math.abs(a.toR - target.r) + Math.abs(a.toC - target.c));
      const bStep =
        Math.abs(b.fromR - target.r) +
        Math.abs(b.fromC - target.c) -
        (Math.abs(b.toR - target.r) + Math.abs(b.toC - target.c));
      return bCap + bStep * 20 - (aCap + aStep * 20);
    })
    .slice(0, 12);

  const nextSide: Side = currentSide === 'RED' ? 'BLUE' : 'RED';
  if (maximizing) {
    let maxEv = -Infinity;
    for (const m of ordered) {
      const ev = minimaxClient(
        applyClientMove(board, m),
        depth - 1,
        alpha,
        beta,
        false,
        nextSide,
        rootSide,
        advanced
      );
      if (ev > maxEv) maxEv = ev;
      if (ev > alpha) alpha = ev;
      if (beta <= alpha) break;
    }
    return maxEv;
  } else {
    let minEv = Infinity;
    for (const m of ordered) {
      const ev = minimaxClient(
        applyClientMove(board, m),
        depth - 1,
        alpha,
        beta,
        true,
        nextSide,
        rootSide,
        advanced
      );
      if (ev < minEv) minEv = ev;
      if (ev < beta) beta = ev;
      if (beta <= alpha) break;
    }
    return minEv;
  }
}

/**
 * Thực thi 4 Bot AI trực tiếp ngay tại Client (Trình duyệt)
 */
export function chooseClientBotMove(
  level: number,
  board: CellChar[][],
  side: Side
): ClientBotMove | null {
  const moves = getLegalMovesForSide(board, side);
  if (moves.length === 0) return null;

  const target = getTargetBase(side);
  for (const m of moves) {
    if (m.toR === target.r && m.toC === target.c) return m;
  }

  if (level === 1) {
    const scored = moves.map(m => {
      const oldD = Math.abs(m.fromR - target.r) + Math.abs(m.fromC - target.c);
      const newD = Math.abs(m.toR - target.r) + Math.abs(m.toC - target.c);
      return { m, s: (oldD - newD) * 10 + (m.captured ? 25 : 0) + Math.random() * 35 };
    });
    scored.sort((a, b) => b.s - a.s);
    return scored[0].m;
  }

  if (level === 2) {
    let best = moves[0];
    let bestS = -Infinity;
    for (const m of moves) {
      const nextB = applyClientMove(board, m);
      const oldD = Math.abs(m.fromR - target.r) + Math.abs(m.fromC - target.c);
      const newD = Math.abs(m.toR - target.r) + Math.abs(m.toC - target.c);
      let s = (oldD - newD) * 18 + (16 - newD) * 2 + (m.captured ? 85 : 0);
      if (isThreatened(nextB, m.toR, m.toC, m.piece)) s -= 75;
      s += Math.random() * 4;
      if (s > bestS) {
        bestS = s;
        best = m;
      }
    }
    return best;
  }

  const depth = level === 3 ? 3 : 4;
  const adv = level >= 4;
  const nextSide: Side = side === 'RED' ? 'BLUE' : 'RED';
  let best = moves[0];
  let bestVal = -Infinity;
  let alpha = -Infinity;

  for (const m of moves) {
    const val =
      minimaxClient(applyClientMove(board, m), depth - 1, alpha, Infinity, false, nextSide, side, adv) +
      (Math.random() * 1.2 - 0.6);
    if (val > bestVal) {
      bestVal = val;
      best = m;
    }
    if (val > alpha) alpha = val;
  }

  return best;
}
