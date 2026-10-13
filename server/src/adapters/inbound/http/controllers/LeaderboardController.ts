import { Request, Response } from 'express';
import { IGetLeaderboardQuery } from '../../../../application/ports/inbound/IGetLeaderboardQuery';

export class LeaderboardController {
  constructor(private readonly leaderboardQuery: IGetLeaderboardQuery) {}

  public getLeaderboard = (_req: Request, res: Response): void => {
    res.json({
      leaderboard: this.leaderboardQuery.getLeaderboard(),
      recentSubmissions: this.leaderboardQuery.getRecentSubmissions(15)
    });
  };
}
