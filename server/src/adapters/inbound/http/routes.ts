import { RequestHandler, Router } from 'express';
import { LeaderboardController } from './controllers/LeaderboardController';
import { MatchController } from './controllers/MatchController';
import { SubmissionController } from './controllers/SubmissionController';

export function createArenaRouter(
  submissionController: SubmissionController,
  matchController: MatchController,
  leaderboardController: LeaderboardController,
  requireUser: RequestHandler
): Router {
  const router = Router();

  router.get('/meta', matchController.getArenaMeta);
  router.get('/leaderboard', leaderboardController.getLeaderboard);
  router.get('/my/submissions', requireUser, submissionController.getMySubmissions);
  router.get('/submissions/:id', requireUser, submissionController.getSubmissionById);
  router.post('/test-match', requireUser, submissionController.runTestMatch);
  router.post('/submit', requireUser, submissionController.submitGauntlet);
  router.post('/bot-move', requireUser, matchController.playBotMove);

  return router;
}
