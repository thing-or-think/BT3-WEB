export type Side = 'RED' | 'BLUE';
export type CellChar = '.' | 'R' | 'P' | 'S' | 'r' | 'p' | 's' | '#';
export type SupportedLanguage = 'javascript' | 'python' | 'cpp' | 'java';

export interface MoveRecord {
  turn: number;
  actor?: 'USER' | 'BOT';
  side: Side;
  piece: CellChar;
  from: string;
  to: string;
  captured: CellChar | null;
  timeMs?: number;
}

export interface MatchSummary {
  botId: number;
  botLevel: number;
  botName: string;
  botElo: number;
  userName?: string;
  userSide: Side;
  result: string;
  winnerSide: Side | null;
  winReason: string;
  errorDetail: string | null;
  turnsCount: number;
  userTurns: number;
  execTimeMs: number;
  score: number;
  moves: MoveRecord[];
}

export interface LadderMatchSummary {
  stepNumber: number;
  defenderRankBefore: number;
  defenderUsername: string;
  defenderLanguage: SupportedLanguage;
  userSide: Side;
  result: string;
  winnerSide: Side | null;
  winReason: string;
  errorDetail: string | null;
  turnsCount: number;
  execTimeMs: number;
  moves: MoveRecord[];
}

export interface SubmissionDto {
  id: string;
  userId: string;
  username: string;
  language: SupportedLanguage;
  sourceCode: string;
  status: 'COMPLETED' | 'COMPILE_ERROR';
  compileError: string | null;
  totalScore: number;
  winsCount: number;
  drawsCount: number;
  lossesCount: number;
  highestBotDefeated: number;
  totalTurns: number;
  totalExecTimeMs: number;
  eloAfter: number;
  matches: MatchSummary[];
  ladderMatches?: LadderMatchSummary[];
  finalRank?: number | null;
  stoppedBy?: string | null;
  createdAt: string;
}

export interface LeaderboardEntryDto {
  rank: number;
  id: string;
  username: string;
  isBot: boolean;
  botLevel?: number;
  badge?: string;
  bestLanguage: SupportedLanguage | 'system';
  bestScore: number;
  elo: number;
  highestBotDefeated: number;
  winsCount: number;
  totalMatches: number;
  bestExecTimeMs: number;
  stoppedBy?: string | null;
  updatedAt: string | null;
}

export interface ArenaMetaResponse {
  initialBoard: CellChar[][];
  bots: Array<{
    id: number;
    level: number;
    name: string;
    elo: number;
    basePoints: number;
    badge: string;
  }>;
  templates: Record<SupportedLanguage, string>;
}

export interface ReplayFrame {
  board: CellChar[][];
  move: MoveRecord | null;
  turn: number;
}

export interface LegalTargetHint {
  r: number;
  c: number;
  isCapture: boolean;
}
