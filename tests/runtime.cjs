const assert = require('node:assert/strict');
const { LocalProcessSandboxAdapter } = require('../dist/server/adapters/outbound/sandbox/LocalProcessSandboxAdapter.js');
const { Board } = require('../dist/server/domain/game/entities/Board.js');
const { STARTER_TEMPLATES } = require('../dist/server/domain/game/services/StarterTemplates.js');
const { RunTestMatchUseCase } = require('../dist/server/application/use-cases/RunTestMatchUseCase.js');
const { BotDecisionDomainService } = require('../dist/server/domain/game/services/BotDecisionDomainService.js');

async function main() {
  const sandbox = new LocalProcessSandboxAdapter();
  for (const language of ['python', 'java']) {
    const artifact = await sandbox.compile(language, STARTER_TEMPLATES[language]);
    assert.equal(artifact.ok, true, artifact.compileError);
    const session = sandbox.createSession(artifact);
    try {
      for (const side of ['RED', 'BLUE']) {
        const board = new Board();
        const result = await session.runTurn(board.formatStdin(side, 1, 1200), 1200);
        assert.equal(result.status, 'OK', result.errorMessage);
        assert.equal(board.validateMoveOutput(side, result.stdout).valid, true, result.stdout);
      }
    } finally {
      session.dispose();
      sandbox.cleanup(artifact.workDir);
    }
    console.log(`PASS: ${language} compiles and returns legal RED/BLUE moves.`);
  }
  const useCase = new RunTestMatchUseCase(sandbox, new BotDecisionDomainService());
  const result = await useCase.execute({ language: 'python', sourceCode: STARTER_TEMPLATES.python, botLevel: 1, userSide: 'RED' });
  assert.equal(result.status, 'COMPLETED');
  assert.ok(result.match.moves.length > 0);
  assert.ok(['WIN', 'LOSS'].includes(result.match.result), JSON.stringify(result.match));
  console.log(`PASS: full Python match (${result.match.turnsCount} moves, ${result.match.winReason}).`);
  const infinite = await sandbox.compile('python', 'while True: pass');
  const session = sandbox.createSession(infinite);
  try {
    assert.equal((await session.runTurn(new Board().formatStdin('RED', 1, 100), 100)).status, 'TLE');
  } finally { session.dispose(); sandbox.cleanup(infinite.workDir); }
  console.log('PASS: infinite bot is terminated as TLE.');
}
main().catch(error => { console.error(error); process.exitCode = 1; });
