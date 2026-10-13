export type Side = 'RED' | 'BLUE';
export type PieceType = 'R' | 'P' | 'S';
export type CellChar = '.' | 'R' | 'P' | 'S' | 'r' | 'p' | 's';
export type SupportedLanguage = 'python' | 'cpp' | 'java';
export type MatchOutcome = 'WIN' | 'LOSS' | 'DRAW' | 'TLE' | 'RE' | 'INVALID_MOVE';
export type WinReason = 'BASE_CAPTURE' | 'NO_MOVES' | 'TIMEOUT' | 'RUNTIME_ERROR' | 'INVALID_MOVE' | 'MAX_TURNS';

export interface BotProfile {
  readonly id: number;
  readonly level: number;
  readonly code: string;
  readonly name: string;
  readonly elo: number;
  readonly basePoints: number;
  readonly badge: string;
  readonly description: string;
}

export interface MoveRecord {
  readonly turn: number;
  readonly actor: 'USER' | 'BOT';
  readonly side: Side;
  readonly piece: CellChar;
  readonly from: string;
  readonly to: string;
  readonly captured: CellChar | null;
  readonly timeMs: number;
}
