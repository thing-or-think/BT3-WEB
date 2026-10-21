import { apiRequest } from './httpClient';
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
  public fetchMySubmissions(): Promise<Array<Pick<SubmissionDto, 'id' | 'language' | 'status' | 'finalRank' | 'createdAt'>>> {
    return apiRequest('/my/submissions');
  }
  public fetchSubmission(id: string): Promise<SubmissionDto> {
    return apiRequest(`/submissions/${encodeURIComponent(id)}`);
  }

  public async fetchMeta(): Promise<ArenaMetaResponse> {
    return apiRequest('/meta');
  }

  public async fetchLeaderboard(): Promise<{
    leaderboard: LeaderboardEntryDto[];
    recentSubmissions: Array<Pick<SubmissionDto, 'id' | 'username' | 'language' | 'status' | 'finalRank' | 'winsCount' | 'createdAt'>>;
  }> {
    return apiRequest('/leaderboard');
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
    return apiRequest('/test-match', params);
  }

  public async submitGauntlet(params: {
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
    return apiRequest('/submit', params);
  }
}
