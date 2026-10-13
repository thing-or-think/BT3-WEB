import {
  ArenaMetaResponse,
  LadderMatchSummary,
  LeaderboardEntryDto,
  MatchSummary,
  Side,
  SubmissionDto,
  SupportedLanguage
} from '../domain/types';

export class ArenaApiClient {
  public async fetchMeta(): Promise<ArenaMetaResponse> {
    const res = await fetch('/api/meta');
    return res.json();
  }

  public async fetchLeaderboard(): Promise<{
    leaderboard: LeaderboardEntryDto[];
    recentSubmissions: SubmissionDto[];
  }> {
    const res = await fetch('/api/leaderboard');
    return res.json();
  }

  public async runTestMatch(params: {
    language: SupportedLanguage;
    sourceCode: string;
    botLevel: number;
    userSide: Side;
  }): Promise<{
    status: 'COMPLETED' | 'COMPILE_ERROR';
    compileError?: string;
    match?: MatchSummary;
    botMatches?: MatchSummary[];
  }> {
    const res = await fetch('/api/test-match', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params)
    });
    return res.json();
  }

  public async submitGauntlet(params: {
    username: string;
    language: SupportedLanguage;
    sourceCode: string;
  }): Promise<{
    submission: SubmissionDto;
    userRank: number | null;
    stoppedBy: string | null;
    ladderMatches: LadderMatchSummary[];
    leaderboard: LeaderboardEntryDto[];
    error?: string;
  }> {
    const res = await fetch('/api/submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params)
    });
    return res.json();
  }
}
