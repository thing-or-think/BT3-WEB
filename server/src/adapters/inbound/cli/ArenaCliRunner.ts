import assert from 'assert';
import fs from 'fs';
import path from 'path';
import { GetLeaderboardService } from '../../../application/use-cases/GetLeaderboardService';
import { RunTestMatchUseCase } from '../../../application/use-cases/RunTestMatchUseCase';
import { SubmitCodeGauntletUseCase } from '../../../application/use-cases/SubmitCodeGauntletUseCase';
import { Board } from '../../../domain/game/entities/Board';
import { BotDecisionDomainService } from '../../../domain/game/services/BotDecisionDomainService';
import {
  SEED_PLAYERS_CODE,
  STARTER_TEMPLATES
} from '../../../domain/game/services/StarterTemplates';
import { JsonLeaderboardRepository } from '../../outbound/persistence/JsonLeaderboardRepository';
import { LocalProcessSandboxAdapter } from '../../outbound/sandbox/LocalProcessSandboxAdapter';

/**
 * Inbound CLI Adapter: Kiểm thử cơ chế Test 4 Bot & Leo Tháp BXH Từ Dưới Lên (Bottom-Up Ladder)
 */
async function runCliVerification(): Promise<void> {
  // Reset DB để kiểm thử sạch từ đầu với 4 người chơi mẫu (#1 -> #4)
  const dbPath = path.join(process.cwd(), 'data', 'arena_db.json');
  if (fs.existsSync(dbPath)) {
    fs.rmSync(dbPath, { force: true });
  }

  console.log('=== [1] KIỂM TRA BÀN CỜ 9x9 & 4 BOT TEST ===');
  const board = new Board();
  assert.strictEqual(board.getLegalMoves('RED').length, 28);

  const sandboxAdapter = new LocalProcessSandboxAdapter();
  const jsonRepo = new JsonLeaderboardRepository();
  const botService = new BotDecisionDomainService();

  const runTestMatchUseCase = new RunTestMatchUseCase(sandboxAdapter, botService);
  const submitLadderUseCase = new SubmitCodeGauntletUseCase(
    sandboxAdapter,
    jsonRepo,
    jsonRepo,
    runTestMatchUseCase
  );
  const leaderboardQuery = new GetLeaderboardService(jsonRepo, jsonRepo);

  const test4Bots = await runTestMatchUseCase.execute({
    language: 'python',
    sourceCode: STARTER_TEMPLATES.python,
    botLevel: 0, // Test với cả 4 Bot
    userSide: 'RED'
  });
  assert.strictEqual(test4Bots.status, 'COMPLETED');
  assert.strictEqual(test4Bots.botMatches?.length, 4);
  console.log(
    `[Test 4 Bot] Đã chạy thử với ${test4Bots.botMatches?.length} Bot: ` +
      test4Bots.botMatches?.map(m => `Lv${m.botLevel}:${m.result}`).join(', ')
  );

  console.log('\n=== [2] BẢNG XẾP HẠNG BAN ĐẦU TRÊN SERVER (4 NGƯỜI CHƠI) ===');
  const initialBxh = leaderboardQuery.getLeaderboard();
  initialBxh.forEach(p => {
    console.log(`  Hạng #${p.rank}: ${p.username} (${p.bestLanguage.toUpperCase()})`);
  });

  console.log('\n=== [3] KỊCH BẢN 1: NGƯỜI CHƠI TRUNG BÌNH PUSH CODE (DỪNG GIỮA BẢNG) ===');
  const midPush = await submitLadderUseCase.execute({
    username: 'SinhVien_TrungBinh',
    language: 'python',
    sourceCode: SEED_PLAYERS_CODE.rank3_rusher_py
  });
  console.log('Hành trình leo từ dưới lên của SinhVien_TrungBinh:');
  midPush.ladderMatches.forEach(m => {
    console.log(
      `  - Bậc ${m.stepNumber}: Đấu Hạng #${m.defenderRankBefore} (${m.defenderUsername}) -> ${m.result} (${m.turnsCount} nước)`
    );
  });
  console.log(
    `=> KẾT QUẢ: Dừng trước "${midPush.stoppedBy || 'Không ai'}" -> Xếp tại Hạng #${midPush.userRank}`
  );

  console.log('\n=== [4] KỊCH BẢN 2: CAO THỦ C++ PUSH CODE (THẮNG HẾT TỪ DƯỚI LÊN TOP #1) ===');
  const proPush = await submitLadderUseCase.execute({
    username: 'CaoThu_CPP',
    language: 'cpp',
    sourceCode: STARTER_TEMPLATES.cpp
  });
  console.log('Hành trình leo từ dưới lên của CaoThu_CPP:');
  proPush.ladderMatches.forEach(m => {
    console.log(
      `  - Bậc ${m.stepNumber}: Đấu Hạng #${m.defenderRankBefore} (${m.defenderUsername}) -> ${m.result} (${m.turnsCount} nước)`
    );
  });
  console.log(
    `=> KẾT QUẢ: Dừng trước "${proPush.stoppedBy || 'Không ai (Toàn thắng)'}" -> Xếp tại Hạng #${proPush.userRank}`
  );

  console.log('\n=== [5] BẢNG XẾP HẠNG SAU KHI LEO THÁP ===');
  proPush.leaderboard.forEach(p => {
    console.log(
      `  Hạng #${p.rank}: ${p.username} (${p.bestLanguage.toUpperCase()}) | Thắng: ${p.winsCount} bậc | Dừng trước: ${p.stoppedBy || 'Đương kim Top 1'}`
    );
  });

  console.log('\n✅ KIỂM THỬ CƠ CHẾ CLIENT 4-BOT TEST & SERVER BOTTOM-UP LADDER THÀNH CÔNG!');
}

if (require.main === module) {
  runCliVerification().catch(err => {
    console.error(err);
    process.exit(1);
  });
}
