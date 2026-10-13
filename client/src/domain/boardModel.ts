import { CellChar, LegalTargetHint, Side } from './types';

export const FILES = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i'] as const;
export const DIRS: ReadonlyArray<readonly [number, number]> = [
  [-1, 0],
  [1, 0],
  [0, -1],
  [0, 1]
];

export function cloneGrid(grid: CellChar[][]): CellChar[][] {
  return grid.map(row => [...row]);
}

export function rcToCoord(r: number, c: number): string {
  return `${FILES[c]}${9 - r}`;
}

export function coordToRC(coord: string): { r: number; c: number } {
  const c = FILES.indexOf(coord[0] as typeof FILES[number]);
  const r = 9 - parseInt(coord[1], 10);
  return { r, c };
}

export function getPieceSide(ch: CellChar | string): Side | null {
  if (!ch || ch === '.') return null;
  return ch === ch.toUpperCase() ? 'RED' : 'BLUE';
}

export function canCapture(attacker: string, defender: string): boolean {
  if (!attacker || !defender || attacker === '.' || defender === '.') return false;
  if (getPieceSide(attacker) === getPieceSide(defender)) return false;
  const A = attacker.toUpperCase();
  const D = defender.toUpperCase();
  return (A === 'R' && D === 'S') || (A === 'S' && D === 'P') || (A === 'P' && D === 'R');
}

export function computeRedLegalTargets(
  board: CellChar[][],
  fromR: number,
  fromC: number
): LegalTargetHint[] {
  const piece = board[fromR][fromC];
  if (getPieceSide(piece) !== 'RED') return [];

  const targets: LegalTargetHint[] = [];
  for (const [dr, dc] of DIRS) {
    const nr = fromR + dr;
    const nc = fromC + dc;
    if (nr < 0 || nr >= 9 || nc < 0 || nc >= 9) continue;
    if (nr === 8 && nc === 0) continue; // Không đi vào căn cứ nhà a1
    const target = board[nr][nc];
    if (target === '.') {
      targets.push({ r: nr, c: nc, isCapture: false });
    } else if (canCapture(piece, target)) {
      targets.push({ r: nr, c: nc, isCapture: true });
    }
  }
  return targets;
}
