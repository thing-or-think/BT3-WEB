import { Request, Response } from 'express';
import { IGetLeaderboardQuery } from '../../../../application/ports/inbound/IGetLeaderboardQuery';

export class LeaderboardController {
  constructor(private readonly leaderboardQuery: IGetLeaderboardQuery) {}

  public getLeaderboard = (_req: Request, res: Response): void => {
    res.json({
      leaderboard: this.leaderboardQuery.getLeaderboard(),
      recentSubmissions: this.leaderboardQuery.getRecentSubmissions(15).map(sub => ({
        id: sub.id, username: sub.username, language: sub.language, status: sub.status,
        finalRank: sub.finalRank, winsCount: sub.winsCount, createdAt: sub.createdAt
      }))
    });
  };
}
