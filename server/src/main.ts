import cors from 'cors';
import express from 'express';
import path from 'path';
import { LeaderboardController } from './adapters/inbound/http/controllers/LeaderboardController';
import { MatchController } from './adapters/inbound/http/controllers/MatchController';
import { SubmissionController } from './adapters/inbound/http/controllers/SubmissionController';
import { createArenaRouter } from './adapters/inbound/http/routes';
import { JsonLeaderboardRepository } from './adapters/outbound/persistence/JsonLeaderboardRepository';
import { LocalProcessSandboxAdapter } from './adapters/outbound/sandbox/LocalProcessSandboxAdapter';
import { GetLeaderboardService } from './application/use-cases/GetLeaderboardService';
import { PlayManualMoveUseCase } from './application/use-cases/PlayManualMoveUseCase';
import { RunTestMatchUseCase } from './application/use-cases/RunTestMatchUseCase';
import { SubmitCodeGauntletUseCase } from './application/use-cases/SubmitCodeGauntletUseCase';
import { BotDecisionDomainService } from './domain/game/services/BotDecisionDomainService';

/**
 * COMPOSITION ROOT (Dependency Injection Container cho Kiến trúc Hexagonal DDD)
 */
export function bootstrapServer() {
  // 1. Khởi tạo Domain Services
  const botDecisionService = new BotDecisionDomainService();

  // 2. Khởi tạo Outbound Adapters (Driven Adapters)
  const sandboxAdapter = new LocalProcessSandboxAdapter();
  const jsonRepository = new JsonLeaderboardRepository();

  // 3. Khởi tạo Application Use Cases (Inbound Ports implementations)
  const runTestMatchUseCase = new RunTestMatchUseCase(sandboxAdapter, botDecisionService);
  const submitGauntletUseCase = new SubmitCodeGauntletUseCase(
    sandboxAdapter,
    jsonRepository,
    jsonRepository,
    runTestMatchUseCase
  );
  const playManualMoveUseCase = new PlayManualMoveUseCase(botDecisionService);
  const getLeaderboardService = new GetLeaderboardService(jsonRepository, jsonRepository);

  // 4. Khởi tạo Inbound HTTP Controllers (Driving Adapters)
  const submissionController = new SubmissionController(
    submitGauntletUseCase,
    runTestMatchUseCase,
    getLeaderboardService
  );
  const matchController = new MatchController(playManualMoveUseCase);
  const leaderboardController = new LeaderboardController(getLeaderboardService);

  // 5. Cấu hình Express Server & Phục vụ Client tĩnh
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;
  const clientDir = path.join(process.cwd(), 'client');

  app.use(cors());
  app.use(express.json({ limit: '512kb' }));
  app.use('/api', createArenaRouter(submissionController, matchController, leaderboardController));
  app.use(express.static(clientDir));

  app.listen(PORT, () => {
    console.log(`=============================================================`);
    console.log(` RPS 9x9 AI Arena [TypeScript Hexagonal DDD]`);
    console.log(` Server URL : http://localhost:${PORT}`);
    console.log(` Languages  : Python 3 | C++ (G++17) | Java (JDK)`);
    console.log(`=============================================================`);
  });

  return app;
}

if (require.main === module) {
  bootstrapServer();
}
