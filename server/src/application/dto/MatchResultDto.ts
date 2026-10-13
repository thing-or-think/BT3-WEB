import {
  LadderMatchSummary,
  SingleMatchSummary,
  Submission
} from '../../domain/evaluation/entities/Submission';
import { CellChar, Side } from '../../domain/game/types/GameTypes';
import { RankedLeaderboardEntryDto } from './LeaderboardEntryDto';

export interface TestMatchResultDto {
  readonly status: 'COMPLETED' | 'COMPILE_ERROR';
  readonly compileError?: string;
  readonly match?: SingleMatchSummary;
  readonly botMatches?: SingleMatchSummary[];
}

export interface SubmitGauntletResultDto {
  readonly submission: Submission;
  readonly userRank: number | null;
  readonly stoppedBy: string | null;
  readonly ladderMatches: LadderMatchSummary[];
  readonly leaderboard: RankedLeaderboardEntryDto[];
}

export interface ManualBotMoveResponseDto {
  readonly move: {
    readonly from: string;
    readonly to: string;
    readonly fromR: number;
    readonly fromC: number;
    readonly toR: number;
    readonly toC: number;
    readonly piece: CellChar;
    readonly captured: CellChar | null;
  } | null;
  readonly board?: CellChar[][];
  readonly gameOver: boolean;
  readonly winner?: Side | null;
  readonly reason?: string | null;
}
