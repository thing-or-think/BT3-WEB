import { SupportedLanguage } from '../../domain/game/types/GameTypes';

export interface RankedLeaderboardEntryDto {
  readonly rank: number;
  readonly id: string;
  readonly username: string;
  readonly isBot: boolean;
  readonly botLevel?: number;
  readonly badge?: string;
  readonly bestLanguage: SupportedLanguage | 'system';
  readonly bestScore: number;
  readonly elo: number;
  readonly highestBotDefeated: number;
  readonly winsCount: number;
  readonly totalMatches: number;
  readonly bestExecTimeMs: number;
  readonly stoppedBy?: string | null;
  readonly updatedAt: string | null;
}
