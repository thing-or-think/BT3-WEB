import { Competitor } from '../../../domain/ranking/entities/Competitor';
import { RankedLeaderboardEntryDto } from '../../dto/LeaderboardEntryDto';

export interface ILeaderboardRepositoryPort {
  getOrderedCompetitors(): Competitor[];
  saveOrderedCompetitors(competitors: Competitor[]): void;
  findCompetitorByUsername(username: string): Competitor | null;
  upsertCompetitor(competitor: Competitor): void;
  getRankedLeaderboard(): RankedLeaderboardEntryDto[];
}
