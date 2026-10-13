import { SupportedLanguage } from '../../game/types/GameTypes';

export class Competitor {
  constructor(
    public readonly id: string,
    public readonly username: string,
    public readonly isBot: boolean,
    public bestLanguage: SupportedLanguage | 'system',
    public bestScore: number,
    public elo: number,
    public highestBotDefeated: number,
    public winsCount: number,
    public totalMatches: number,
    public bestExecTimeMs: number,
    public submissionsCount: number,
    public updatedAt: string | null,
    public sourceCode: string = '',
    public stoppedBy: string | null = null,
    public readonly botLevel?: number,
    public readonly badge?: string
  ) {}
}
