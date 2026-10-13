import { Submission } from '../../domain/evaluation/entities/Submission';
import { RankedLeaderboardEntryDto } from '../dto/LeaderboardEntryDto';
import { IGetLeaderboardQuery } from '../ports/inbound/IGetLeaderboardQuery';
import { ILeaderboardRepositoryPort } from '../ports/outbound/ILeaderboardRepositoryPort';
import { ISubmissionRepositoryPort } from '../ports/outbound/ISubmissionRepositoryPort';

export class GetLeaderboardService implements IGetLeaderboardQuery {
  constructor(
    private readonly leaderboardRepo: ILeaderboardRepositoryPort,
    private readonly submissionRepo: ISubmissionRepositoryPort
  ) {}

  public getLeaderboard(): RankedLeaderboardEntryDto[] {
    return this.leaderboardRepo.getRankedLeaderboard();
  }

  public getRecentSubmissions(limit = 15): Submission[] {
    return this.submissionRepo.findRecent(limit);
  }

  public getSubmissionById(id: string): Submission | null {
    return this.submissionRepo.findById(id);
  }
}
