import { RankedLeaderboardEntryDto } from '../../../application/dto/LeaderboardEntryDto';
import { ILeaderboardRepositoryPort } from '../../../application/ports/outbound/ILeaderboardRepositoryPort';
import { ISubmissionRepositoryPort } from '../../../application/ports/outbound/ISubmissionRepositoryPort';
import { Submission } from '../../../domain/evaluation/entities/Submission';
import { Competitor } from '../../../domain/ranking/entities/Competitor';

export class PostgresRepository implements ILeaderboardRepositoryPort, ISubmissionRepositoryPort {
  constructor(private readonly connectionString: string) {}

  public getOrderedCompetitors(): Competitor[] {
    throw new Error(`PostgresRepository (${this.connectionString}) not connected`);
  }

  public saveOrderedCompetitors(_competitors: Competitor[]): void {
    throw new Error('PostgresRepository.saveOrderedCompetitors not connected');
  }

  public findCompetitorByUsername(_username: string): Competitor | null {
    throw new Error('PostgresRepository.findCompetitorByUsername not connected');
  }

  public upsertCompetitor(_competitor: Competitor): void {
    throw new Error('PostgresRepository.upsertCompetitor not connected');
  }

  public getRankedLeaderboard(): RankedLeaderboardEntryDto[] {
    throw new Error('PostgresRepository.getRankedLeaderboard not connected');
  }

  public saveSubmission(_submission: Submission): void {
    throw new Error('PostgresRepository.saveSubmission not connected');
  }

  public findById(_id: string): Submission | null {
    throw new Error('PostgresRepository.findById not connected');
  }

  public findRecent(_limit: number): Submission[] {
    throw new Error('PostgresRepository.findRecent not connected');
  }
}
