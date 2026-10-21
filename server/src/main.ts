import cors from 'cors';
import express, { ErrorRequestHandler } from 'express';
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
import { AuthController } from './adapters/inbound/http/AuthController';
import { ICodeSandboxPort } from './application/ports/outbound/ICodeSandboxPort';

/**
 * COMPOSITION ROOT (Dependency Injection Container cho Kiến trúc Hexagonal DDD)
 */
export function createApp(options: { dataDir?: string; sandbox?: ICodeSandboxPort } = {}) {
  // 1. Khởi tạo Domain Services
  const botDecisionService = new BotDecisionDomainService();

  // 2. Khởi tạo Outbound Adapters (Driven Adapters)
  const dataDir = options.dataDir || process.env.ARENA_DATA_DIR || path.join(process.cwd(), '.arena-data');
  const sandboxAdapter = options.sandbox || new LocalProcessSandboxAdapter();
  const jsonRepository = new JsonLeaderboardRepository(dataDir);
  const auth = new AuthController(dataDir, name => !!jsonRepository.findCompetitorByUsername(name));

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
  const clientDir = path.join(process.cwd(), 'client');

  const allowedOrigins = (process.env.ALLOWED_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean);
  app.disable('x-powered-by');
  app.use(cors({ origin: allowedOrigins, methods: ['GET', 'POST'], allowedHeaders: ['Content-Type', 'Authorization'] }));
  app.use(express.json({ limit: '512kb' }));
  app.use('/api', (_req, res, next) => { res.setHeader('Cache-Control', 'no-store'); next(); });
  app.use('/api/auth', auth.router());
  app.use('/api', createArenaRouter(submissionController, matchController, leaderboardController, auth.requireUser));
  app.use('/api', (_req, res) => { res.status(404).json({ error: 'API không tồn tại.' }); });
  // Legacy demo exports include user records and source code; never expose them as static assets.
  app.use('/data', (_req, res) => { res.sendStatus(404); });
  app.use(express.static(clientDir));
  const handleError: ErrorRequestHandler = (error, _req, res, _next) => {
    const status = error.type === 'entity.too.large' ? 413 : error instanceof SyntaxError ? 400 : 500;
    res.status(status).json({ error: status === 500 ? 'Máy chủ không xử lý được yêu cầu.' : 'Dữ liệu gửi lên không hợp lệ hoặc quá lớn.' });
  };
  app.use(handleError);
  return app;
}

export function bootstrapServer() {
  const app = createApp();
  const PORT = Number(process.env.PORT) || 3000;
  const HOST = process.env.HOST || '127.0.0.1';
  app.listen(PORT, HOST, () => {
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
