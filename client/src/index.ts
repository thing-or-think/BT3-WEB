import { ArenaApiClient } from './adapters/arenaApiClient';
import { ArenaStore, MainTabId } from './application/arenaStore';
import { ReplayController } from './application/replayController';
import {
  cloneGrid,
  computeRedLegalTargets,
  getPieceSide,
  rcToCoord
} from './domain/boardModel';
import { chooseClientBotMove, getLegalMovesForSide } from './domain/clientBots';
import { MatchSummary, ReplayFrame, Side, SupportedLanguage } from './domain/types';
import { BoardView } from './presentation/boardView';
import { EditorView } from './presentation/editorView';
import { LeaderboardView } from './presentation/leaderboardView';

const apiClient = new ArenaApiClient();
const store = new ArenaStore();
const boardView = new BoardView();
const editorView = new EditorView(store);
const leaderboardView = new LeaderboardView();

let clientBotTestMatches: MatchSummary[] = [];

const replayController = new ReplayController(
  (frame: ReplayFrame, index: number, total: number) => {
    store.currentBoard = cloneGrid(frame.board);
    boardView.renderBoard({
      board: store.currentBoard,
      lastMove: frame.move,
      boardMode: store.boardMode,
      selectedRC: store.manualSelectedRC,
      legalTargets: store.manualLegalTargets
    });

    const slider = document.getElementById('replaySlider') as HTMLInputElement | null;
    if (slider) {
      slider.max = String(Math.max(0, total));
      slider.value = String(index);
    }

    const stepText = document.getElementById('replayStepText');
    if (stepText) stepText.textContent = `${index} / ${total}`;

    const badge = document.getElementById('turnStatusBadge');
    if (badge) {
      badge.textContent = frame.move
        ? `Lượt ${frame.turn}: ${frame.move.side} đi ${frame.move.from} → ${frame.move.to}`
        : `Trạng thái khởi tạo (Lượt 0)`;
    }

    document.querySelectorAll('.move-chip').forEach(el => el.classList.remove('active'));
    const activeChip = document.getElementById(`moveChip_${index}`);
    if (activeChip) {
      activeChip.classList.add('active');
      activeChip.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  }
);

function setPlayPauseButtonState(playing: boolean): void {
  const btn = document.getElementById('btnPlayPause');
  if (btn) btn.textContent = playing ? '⏸ Dừng' : '▶ Phát';
}

/**
 * Chuyển đổi giữa 4 Tab chính:
 *  - 'practice'    : Tab 1 (Đấu Tập Tay & Luật Chơi)
 *  - 'studio'      : Tab 2 (Phòng Lab Code & Test 4 Bot Client)
 *  - 'ladder'      : Tab 3 (Đấu Trường Leo Tháp Server)
 *  - 'leaderboard' : Tab 4 (Bảng Xếp Hạng Toàn Server)
 */
function switchMainTab(tabId: MainTabId): void {
  store.activeMainTab = tabId;

  document.querySelectorAll('.main-tab-btn').forEach(btn => {
    const el = btn as HTMLElement;
    el.classList.toggle('active', el.dataset.maintab === tabId);
  });

  const viewMap: Record<MainTabId, string> = {
    practice: 'viewPractice',
    studio: 'viewStudio',
    ladder: 'viewLadder',
    leaderboard: 'viewLeaderboard'
  };

  Object.entries(viewMap).forEach(([key, domId]) => {
    document.getElementById(domId)?.classList.toggle('active', key === tabId);
  });

  const sharedBoard = document.getElementById('sharedBoardSection');
  const boardTitle = document.getElementById('boardContextTitle');

  if (tabId === 'practice') {
    const host = document.getElementById('boardHostPractice');
    if (host && sharedBoard) host.appendChild(sharedBoard);
    if (boardTitle) boardTitle.textContent = '🎮 Bàn Cờ Đấu Tập Tay Với 4 Bot Client';
    switchBoardMode('manual', true);
  } else if (tabId === 'studio') {
    const host = document.getElementById('boardHostStudio');
    if (host && sharedBoard) host.appendChild(sharedBoard);
    if (boardTitle) boardTitle.textContent = '🎬 Replay Kết Quả Test Với 4 Bot Client';
    switchBoardMode('replay', true);
  } else if (tabId === 'ladder') {
    const host = document.getElementById('boardHostLadder');
    if (host && sharedBoard) host.appendChild(sharedBoard);
    if (boardTitle) boardTitle.textContent = '⚔️ Replay Trận Đấu PvP Leo Tháp Trên Server';
    const previewUser = document.getElementById('ladderPreviewUser');
    const previewLang = document.getElementById('ladderPreviewLang');
    if (previewUser) previewUser.textContent = editorView.getUsername();
    if (previewLang) previewLang.textContent = store.currentLang.toUpperCase();
    switchBoardMode('replay', true);
  } else if (tabId === 'leaderboard') {
    replayController.stop();
    setPlayPauseButtonState(false);
    loadLeaderboard();
  }
}

function selectManualBotLevel(level: number): void {
  const sel = document.getElementById('manualBotLevel') as HTMLSelectElement | null;
  if (sel) sel.value = String(level);
  resetManualGame();
}

function switchStudioSubTab(tabId: string): void {
  document.querySelectorAll('#viewStudio .sub-tab').forEach(btn => {
    const el = btn as HTMLElement;
    el.classList.toggle('active', el.dataset.tab === tabId);
  });
  document.querySelectorAll('#viewStudio .tab-content').forEach(pane => {
    pane.classList.toggle('active', pane.id === tabId);
  });
}

function loadMatchIntoReplay(match: MatchSummary, titleLabel = ''): void {
  replayController.stop();
  switchBoardMode('replay', false);

  const userIsRed = match.userSide === 'RED';
  const redName = document.getElementById('redPlayerName');
  const blueName = document.getElementById('bluePlayerName');
  if (redName) {
    redName.textContent = userIsRed
      ? `👤 CODE CỦA BẠN (RED - Đi trước)`
      : `🤖 ${match.botName} (RED - Đi trước)`;
  }
  if (blueName) {
    blueName.textContent = !userIsRed
      ? `👤 CODE CỦA BẠN (BLUE - Đi sau)`
      : `🤖 ${match.botName} (BLUE - Đi sau)`;
  }

  const summaryEl = document.getElementById('matchSummaryTag');
  if (summaryEl) {
    summaryEl.textContent =
      titleLabel ||
      `${match.result} vs ${match.botName} (${match.turnsCount} nước • ${match.execTimeMs}ms)`;
  }

  const errBox = document.getElementById('errorAlertBox');
  if (errBox) {
    if (match.errorDetail) {
      errBox.textContent = `⚠️ Chi tiết lỗi (${match.result}): ${match.errorDetail}`;
      errBox.classList.remove('hidden');
    } else {
      errBox.classList.add('hidden');
    }
  }

  boardView.renderMoveHistoryChips(match.moves || [], stepIdx => {
    setPlayPauseButtonState(false);
    replayController.jumpTo(stepIdx);
  });

  replayController.loadMatch(store.initialBoardTemplate, match);
  replayController.start(setPlayPauseButtonState);
}

function switchBoardMode(mode: 'replay' | 'manual', resetIfNeeded = true): void {
  store.boardMode = mode;
  replayController.stop();
  setPlayPauseButtonState(false);

  document.getElementById('replayControls')?.classList.toggle('hidden', mode !== 'replay');
  document.getElementById('manualControls')?.classList.toggle('hidden', mode !== 'manual');

  if (mode === 'manual' && resetIfNeeded) {
    resetManualGame();
  } else if (mode === 'replay' && resetIfNeeded) {
    if (replayController.getStatesCount() > 0) {
      replayController.notify();
    } else {
      boardView.renderBoard({
        board: store.initialBoardTemplate,
        boardMode: 'replay',
        selectedRC: null,
        legalTargets: []
      });
    }
  }
}

function resetManualGame(): void {
  store.resetManualState();
  const botSelect = document.getElementById('manualBotLevel') as HTMLSelectElement | null;
  const botLv = botSelect ? botSelect.value : '2';

  const redName = document.getElementById('redPlayerName');
  const blueName = document.getElementById('bluePlayerName');
  const badge = document.getElementById('turnStatusBadge');
  const summary = document.getElementById('matchSummaryTag');

  if (redName) redName.textContent = '👤 BẠN (PHE ĐỎ - Đi trước)';
  if (blueName) blueName.textContent = `🤖 CLIENT BOT LV${botLv} (PHE XANH)`;
  if (badge) badge.textContent = 'Đến lượt Bạn (Phe Đỏ)';
  if (summary) summary.textContent = `Đang đánh tay với Client Bot Lv${botLv} (0ms)`;
  document.getElementById('errorAlertBox')?.classList.add('hidden');

  boardView.renderMoveHistoryChips([], () => {});
  boardView.renderBoard({
    board: store.currentBoard,
    boardMode: 'manual',
    selectedRC: store.manualSelectedRC,
    legalTargets: store.manualLegalTargets,
    onCellClick: handleManualCellClick
  });
}

function handleManualCellClick(r: number, c: number): void {
  if (store.boardMode !== 'manual' || store.manualGameOver || store.manualTurnSide !== 'RED') return;

  const chosenTarget = store.manualLegalTargets.find(t => t.r === r && t.c === c);
  if (store.manualSelectedRC && chosenTarget) {
    const fromCoord = rcToCoord(store.manualSelectedRC.r, store.manualSelectedRC.c);
    const toCoord = rcToCoord(r, c);
    const movedPiece = store.currentBoard[store.manualSelectedRC.r][store.manualSelectedRC.c];
    const capturedPiece = store.currentBoard[r][c] === '.' ? null : store.currentBoard[r][c];

    store.currentBoard[r][c] = movedPiece;
    store.currentBoard[store.manualSelectedRC.r][store.manualSelectedRC.c] = '.';
    store.manualSelectedRC = null;
    store.manualLegalTargets = [];

    store.manualMoveHistory.push({
      turn: store.manualMoveHistory.length + 1,
      side: 'RED',
      piece: movedPiece,
      from: fromCoord,
      to: toCoord,
      captured: capturedPiece
    });

    boardView.renderMoveHistoryChips(store.manualMoveHistory, () => {});
    boardView.renderBoard({
      board: store.currentBoard,
      lastMove: { from: fromCoord, to: toCoord },
      boardMode: 'manual',
      selectedRC: null,
      legalTargets: [],
      onCellClick: handleManualCellClick
    });

    if (r === 0 && c === 8) {
      store.manualGameOver = true;
      const badge = document.getElementById('turnStatusBadge');
      if (badge) badge.textContent = '🎉 BẠN THẮNG (Chiếm căn cứ i9)!';
      return;
    }

    store.manualTurnSide = 'BLUE';
    const badge = document.getElementById('turnStatusBadge');
    if (badge) badge.textContent = '🤖 Bot Client đang đi...';

    const botSelect = document.getElementById('manualBotLevel') as HTMLSelectElement | null;
    const botLevel = Number(botSelect?.value || 2);

    setTimeout(() => {
      const botMove = chooseClientBotMove(botLevel, store.currentBoard, 'BLUE');
      if (!botMove) {
        store.manualGameOver = true;
        if (badge) badge.textContent = '🎉 BẠN THẮNG (Bot hết nước đi)!';
        return;
      }

      store.currentBoard[botMove.toR][botMove.toC] =
        store.currentBoard[botMove.fromR][botMove.fromC];
      store.currentBoard[botMove.fromR][botMove.fromC] = '.';

      store.manualMoveHistory.push({
        turn: store.manualMoveHistory.length + 1,
        side: 'BLUE',
        piece: botMove.piece,
        from: botMove.from,
        to: botMove.to,
        captured: botMove.captured
      });

      boardView.renderMoveHistoryChips(store.manualMoveHistory, () => {});
      boardView.renderBoard({
        board: store.currentBoard,
        lastMove: { from: botMove.from, to: botMove.to },
        boardMode: 'manual',
        selectedRC: null,
        legalTargets: [],
        onCellClick: handleManualCellClick
      });

      if (botMove.toR === 8 && botMove.toC === 0) {
        store.manualGameOver = true;
        if (badge) badge.textContent = '💀 BOT THẮNG (Chiếm căn cứ a1)!';
        return;
      }

      const redRemainingMoves = getLegalMovesForSide(store.currentBoard, 'RED');
      if (redRemainingMoves.length === 0) {
        store.manualGameOver = true;
        if (badge) badge.textContent = '💀 BOT THẮNG (Bạn hết nước đi)!';
        return;
      }

      store.manualTurnSide = 'RED';
      if (badge) badge.textContent = 'Đến lượt Bạn (Phe Đỏ)';
    }, 60);
    return;
  }

  const piece = store.currentBoard[r][c];
  if (getPieceSide(piece) === 'RED') {
    store.manualSelectedRC = { r, c };
    store.manualLegalTargets = computeRedLegalTargets(store.currentBoard, r, c);
  } else {
    store.manualSelectedRC = null;
    store.manualLegalTargets = [];
  }

  boardView.renderBoard({
    board: store.currentBoard,
    boardMode: 'manual',
    selectedRC: store.manualSelectedRC,
    legalTargets: store.manualLegalTargets,
    onCellClick: handleManualCellClick
  });
}

async function handleRunTestMatch(): Promise<void> {
  const btn = document.getElementById('btnTestMatch') as HTMLButtonElement | null;
  const botSelect = document.getElementById('testBotSelect') as HTMLSelectElement | null;
  const sideSelect = document.getElementById('testSideSelect') as HTMLSelectElement | null;
  const selectedBotLevel = Number(botSelect?.value ?? 0);

  if (btn) {
    btn.disabled = true;
    btn.textContent =
      selectedBotLevel === 0 ? '⏳ Đang Test với cả 4 Bot...' : '⏳ Đang Test với Bot...';
  }
  document.getElementById('errorAlertBox')?.classList.add('hidden');

  try {
    const data = await apiClient.runTestMatch({
      language: store.currentLang,
      sourceCode: editorView.getCurrentCode(),
      botLevel: selectedBotLevel,
      userSide: (sideSelect?.value === 'BLUE' ? 'BLUE' : 'RED') as Side
    });

    if (data.status === 'COMPILE_ERROR') {
      const errBox = document.getElementById('errorAlertBox');
      if (errBox) {
        errBox.textContent = `❌ LỖI BIÊN DỊCH (${store.currentLang.toUpperCase()}):\n${data.compileError}`;
        errBox.classList.remove('hidden');
      }
      return;
    }

    clientBotTestMatches = data.botMatches || (data.match ? [data.match] : []);
    const badge = document.getElementById('botTestCountBadge');
    if (badge) badge.textContent = String(clientBotTestMatches.length);

    leaderboardView.renderClientBotTestResults(clientBotTestMatches, idx => {
      const m = clientBotTestMatches[idx];
      if (m) {
        loadMatchIntoReplay(
          m,
          `Test Bot Client: ${m.result} vs ${m.botName} (${m.turnsCount} nước)`
        );
      }
    });

    switchStudioSubTab('botTestTab');

    if (data.match) {
      loadMatchIntoReplay(
        data.match,
        `Test Bot Client: ${data.match.result} vs ${data.match.botName} (${data.match.turnsCount} nước)`
      );
    }
  } catch (err: any) {
    alert('Lỗi khi chạy đấu thử với Bot: ' + err?.message);
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.textContent = '🧪 Chạy Test Với 4 Bot (Client)';
    }
  }
}

async function handleSubmitGauntlet(): Promise<void> {
  const btn = document.getElementById('btnSubmitRank') as HTMLButtonElement | null;
  const username = editorView.getUsername();

  if (btn) {
    btn.disabled = true;
    btn.textContent = '⏳ Đang đấu leo BXH từ dưới lên...';
  }
  document.getElementById('errorAlertBox')?.classList.add('hidden');

  try {
    const data = await apiClient.submitGauntlet({
      username,
      language: store.currentLang,
      sourceCode: editorView.getCurrentCode()
    });

    const sub = data.submission;
    if (!sub) {
      alert(data.error || 'Lỗi không xác định');
      return;
    }

    if (sub.status === 'COMPILE_ERROR') {
      const errBox = document.getElementById('errorAlertBox');
      if (errBox) {
        errBox.textContent = `❌ LỖI BIÊN DỊCH (${store.currentLang.toUpperCase()}):\n${sub.compileError}`;
        errBox.classList.remove('hidden');
      }
      return;
    }

    store.currentGauntletMatches = sub.matches || [];
    const countBadge = document.getElementById('gauntletCountBadge');
    if (countBadge) countBadge.textContent = String(store.currentGauntletMatches.length);

    leaderboardView.renderGauntletResults(sub, data.userRank, idx => {
      const m = store.currentGauntletMatches[idx];
      if (m) {
        loadMatchIntoReplay(m, `Leo Tháp Bậc ${idx + 1}: ${m.result} vs ${m.botName}`);
      }
    });
    leaderboardView.renderLeaderboardTable(data.leaderboard || [], username);

    const lastMatch = store.currentGauntletMatches[store.currentGauntletMatches.length - 1];
    if (lastMatch) {
      loadMatchIntoReplay(
        lastMatch,
        `Chốt Hạng #${data.userRank} • ${lastMatch.result} vs ${lastMatch.botName}`
      );
    }
  } catch (err: any) {
    alert('Lỗi khi push code lên server: ' + err?.message);
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.textContent = '🚀 Push Code Lên Server & Đấu Leo BXH Từ Dưới Lên';
    }
  }
}

async function loadLeaderboard(): Promise<void> {
  const data = await apiClient.fetchLeaderboard();
  leaderboardView.renderLeaderboardTable(data.leaderboard || [], editorView.getUsername());
}

Object.assign(window as any, {
  switchMainTab,
  selectManualBotLevel,
  switchStudioSubTab,
  switchBoardMode,
  resetManualGame,
  replayFirst: () => {
    setPlayPauseButtonState(false);
    replayController.first();
  },
  replayPrev: () => {
    setPlayPauseButtonState(false);
    replayController.prev();
  },
  toggleReplayPlay: () => replayController.togglePlay(setPlayPauseButtonState),
  replayNext: () => {
    setPlayPauseButtonState(false);
    replayController.next();
  },
  replayLast: () => {
    setPlayPauseButtonState(false);
    replayController.last();
  },
  onSliderChange: (val: string) => {
    setPlayPauseButtonState(false);
    replayController.jumpTo(Number(val));
  },
  updateReplaySpeed: (ms: string) =>
    replayController.setSpeed(Number(ms), setPlayPauseButtonState),
  selectLanguage: (lang: SupportedLanguage) => editorView.selectLanguage(lang),
  resetTemplateForCurrentLang: () => editorView.resetTemplateForCurrentLang(),
  handleRunTestMatch,
  handleSubmitGauntlet,
  loadLeaderboard
});

async function bootstrapClient(): Promise<void> {
  boardView.renderCoordHeaders();
  editorView.bindTabIndentation();

  const meta = await apiClient.fetchMeta();
  store.initialBoardTemplate = meta.initialBoard;
  store.templatesByLang = meta.templates;
  store.userDraftByLang = { ...meta.templates };
  store.currentBoard = cloneGrid(meta.initialBoard);

  editorView.selectLanguage('python');
  switchMainTab('studio');
  await loadLeaderboard();
}

bootstrapClient();
