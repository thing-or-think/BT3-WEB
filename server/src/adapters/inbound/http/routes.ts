import { Router } from 'express';
import { LeaderboardController } from './controllers/LeaderboardController';
import { MatchController } from './controllers/MatchController';
import { SubmissionController } from './controllers/SubmissionController';

export function createArenaRouter(
  submissionController: SubmissionController,
  matchController: MatchController,
  leaderboardController: LeaderboardController
): Router {
  const router = Router();

  router.get('/meta', matchController.getArenaMeta);
  router.get('/leaderboard', leaderboardController.getLeaderboard);
  router.get('/submissions/:id', submissionController.getSubmissionById);
  router.post('/test-match', submissionController.runTestMatch);
  router.post('/submit', submissionController.submitGauntlet);
  router.post('/bot-move', matchController.playBotMove);

  return router;
}
