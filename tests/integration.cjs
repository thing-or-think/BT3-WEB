const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { once } = require('node:events');
const { createApp } = require('../dist/server/main.js');
const { Board } = require('../dist/server/domain/game/entities/Board.js');
const { Match } = require('../dist/server/domain/game/entities/Match.js');
const { BotDecisionDomainService } = require('../dist/server/domain/game/services/BotDecisionDomainService.js');

async function main() {
  const root = path.resolve('.test-data');
  fs.mkdirSync(root, { recursive: true });
  const dataDir = fs.mkdtempSync(path.join(root, 'http-'));
  const sandbox = {
    async compile(language, sourceCode) {
      await new Promise(resolve => setTimeout(resolve, 5));
      return sourceCode === 'compile-error'
        ? { ok: false, compileError: 'Invalid source' }
        : { ok: true, language, workDir: sourceCode };
    },
    createSession() {
      return {
        async runTurn() {
          return { status: 'OK', stdout: 'a1 a9', execTimeMs: 1, errorMessage: null };
        },
        dispose() {}
      };
    },
    cleanup() {}
  };
  let server;
  let base;
  const previousOrigins = process.env.ALLOWED_ORIGINS;
  process.env.ALLOWED_ORIGINS = 'https://thing-or-think.github.io';
  async function start() {
    server = createApp({ dataDir, sandbox }).listen(0, '127.0.0.1');
    await once(server, 'listening');
    base = `http://127.0.0.1:${server.address().port}`;
  }
  async function stop() {
    await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  }
  async function request(route, body, token) {
    const response = await fetch(`${base}/api${route}`, {
      method: body === undefined ? 'GET' : 'POST',
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: body === undefined ? undefined : JSON.stringify(body)
    });
    return { status: response.status, data: await response.json() };
  }
  try {
    await start();
    assert.equal((await fetch(base)).status, 200);
    assert.equal((await fetch(`${base}/data/users/admin.json`)).status, 404);
    const meta = await request('/meta');
    assert.equal(meta.data.initialBoard.length, 9);
    assert.ok(meta.data.templates.python && meta.data.templates.java);
    const preflight = await fetch(`${base}/api/submit`, {
      method: 'OPTIONS',
      headers: {
        Origin: 'https://thing-or-think.github.io',
        'Access-Control-Request-Method': 'POST',
        'Access-Control-Request-Headers': 'authorization,content-type'
      }
    });
    assert.equal(preflight.status, 204);
    assert.equal(preflight.headers.get('access-control-allow-origin'), 'https://thing-or-think.github.io');
    const otherOrigin = await fetch(`${base}/api/meta`, { headers: { Origin: 'https://other.example' } });
    assert.equal(otherOrigin.headers.get('access-control-allow-origin'), null);
    assert.equal((await request('/submit', { language: 'python', sourceCode: 'bot' })).status, 401);
    const [alice, bob] = await Promise.all([
      request('/auth/register', { username: 'Alice', email: 'alice@example.test', password: 'password123', role: 'ADMIN' }),
      request('/auth/register', { username: 'Bob', email: 'bob@example.test', password: 'password123' })
    ]);
    assert.equal(alice.status, 200);
    assert.equal(bob.status, 200);
    assert.equal(alice.data.user.role, 'USER');
    assert.equal(alice.data.user.passwordHash, undefined);
    assert.equal(alice.data.user.salt, undefined);
    assert.equal((await request('/auth/login', { identifier: 'Alice', password: 'wrong' })).status, 401);
    const login = await request('/auth/login', { identifier: 'ALICE@example.test', password: 'password123' });
    assert.equal(login.status, 200);
    assert.equal((await request('/auth/me', undefined, login.data.token)).data.user.id, alice.data.user.id);
    assert.equal((await request('/auth/register', { username: 'alice', email: 'other@example.test', password: 'password123' })).status, 409);
    assert.equal((await request('/auth/register', { username: 'MinhKiet_Top1', email: 'seed@example.test', password: 'password123' })).status, 409);
    assert.equal((await request('/test-match', { language: 'javascript', sourceCode: 'bot' }, alice.data.token)).status, 400);
    assert.equal((await request('/test-match', { language: 'python', sourceCode: 'bot', botLevel: 99 }, alice.data.token)).status, 400);
    const [a, b] = await Promise.all([
      request('/submit', { username: 'Bob', language: 'python', sourceCode: 'alice-code' }, alice.data.token),
      request('/submit', { username: 'Alice', language: 'java', sourceCode: 'bob-code' }, bob.data.token)
    ]);
    assert.equal(a.status, 200);
    assert.equal(b.status, 200);
    assert.equal(a.data.submission.username, 'Alice');
    assert.equal(a.data.submission.userId, alice.data.user.id);
    assert.equal(b.data.submission.username, 'Bob');
    assert.equal(a.data.submission.matches[0].result, 'INVALID_MOVE');
    const leaderboard = await request('/leaderboard');
    assert.ok(leaderboard.data.leaderboard.some(p => p.username === 'Alice'));
    assert.ok(leaderboard.data.leaderboard.some(p => p.username === 'Bob'));
    assert.equal(JSON.stringify(leaderboard.data).includes('alice-code'), false);
    assert.equal((await request(`/submissions/${a.data.submission.id}`, undefined, bob.data.token)).status, 403);
    const failure = await request('/submit', { language: 'python', sourceCode: 'compile-error' }, alice.data.token);
    assert.equal(failure.data.submission.status, 'COMPILE_ERROR');
    assert.equal(failure.data.submission.userId, alice.data.user.id);
    assert.equal((await request('/my/submissions', undefined, alice.data.token)).data.length, 2);
    const test = await request('/test-match', { language: 'python', sourceCode: 'bot', botLevel: 1 }, alice.data.token);
    assert.equal(test.data.match.result, 'INVALID_MOVE');
    assert.equal(test.data.match.turnsCount, 0); // An illegal move must never be silently substituted.
    await stop();
    await start();
    assert.equal((await request('/auth/me', undefined, alice.data.token)).status, 200);
    assert.equal((await request(`/submissions/${a.data.submission.id}`, undefined, alice.data.token)).data.sourceCode, 'alice-code');
    await request('/auth/logout', {}, alice.data.token);
    assert.equal((await request('/auth/me', undefined, alice.data.token)).status, 401);
    const game = new Match(BotDecisionDomainService.getBotProfile(1), 'RED');
    game.finishByTurnLimit();
    assert.equal(game.getWinnerSide(), new Board().resolveTieBreakWinner());
    console.log('PASS: accounts, restart persistence, session revocation, ownership, input validation, concurrent submissions, history and tie-break.');
  } finally {
    if (server?.listening) await stop();
    if (previousOrigins === undefined) delete process.env.ALLOWED_ORIGINS;
    else process.env.ALLOWED_ORIGINS = previousOrigins;
    // Only delete the disposable directory created for this test.
    if (!dataDir.startsWith(root + path.sep)) throw new Error('Unexpected test directory');
    fs.rmSync(dataDir, { recursive: true, force: true });
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
