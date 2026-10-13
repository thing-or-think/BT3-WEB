import { MatchOutcome, MoveRecord, Side, SupportedLanguage, WinReason } from '../../game/types/GameTypes';

export interface SingleMatchSummary {
  readonly botId: number;
  readonly botLevel: number;
  readonly botName: string;
  readonly botElo: number;
  readonly userSide: Side;
  readonly result: MatchOutcome;
  readonly winnerSide: Side | null;
  readonly winReason: WinReason;
  readonly errorDetail: string | null;
  readonly turnsCount: number;
  readonly userTurns: number;
  readonly execTimeMs: number;
  readonly score: number;
  readonly moves: MoveRecord[];
}

export interface LadderMatchSummary {
  readonly stepNumber: number;
  readonly defenderRankBefore: number;
  readonly defenderUsername: string;
  readonly defenderLanguage: SupportedLanguage;
  readonly userSide: Side;
  readonly result: MatchOutcome;
  readonly winnerSide: Side | null;
  readonly winReason: WinReason;
  readonly errorDetail: string | null;
  readonly turnsCount: number;
  readonly execTimeMs: number;
  readonly moves: MoveRecord[];
}

export class Submission {
  constructor(
    public readonly id: string,
    public readonly userId: string,
    public readonly username: string,
    public readonly language: SupportedLanguage,
    public readonly sourceCode: string,
    public readonly status: 'COMPLETED' | 'COMPILE_ERROR',
    public readonly compileError: string | null,
    public readonly totalScore: number,
    public readonly winsCount: number,
    public readonly drawsCount: number,
    public readonly lossesCount: number,
    public readonly highestBotDefeated: number,
    public readonly totalTurns: number,
    public readonly totalExecTimeMs: number,
    public readonly eloAfter: number,
    public readonly matches: SingleMatchSummary[],
    public readonly createdAt: string,
    public readonly ladderMatches: LadderMatchSummary[] = [],
    public readonly finalRank: number | null = null,
    public readonly stoppedBy: string | null = null
  ) {}
}
