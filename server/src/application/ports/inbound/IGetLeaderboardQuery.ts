import { Submission } from '../../../domain/evaluation/entities/Submission';
import { RankedLeaderboardEntryDto } from '../../dto/LeaderboardEntryDto';

export interface IGetLeaderboardQuery {
  getLeaderboard(): RankedLeaderboardEntryDto[];
  getRecentSubmissions(limit?: number): Submission[];
  getSubmissionById(id: string): Submission | null;
}
