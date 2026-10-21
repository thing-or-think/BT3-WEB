import { AuthService } from './adapters/authService';
import { ServerArena } from './application/serverArena';
import { ArenaStore, MainTabId } from './application/arenaStore';
import { ReplayController } from './application/replayController';
import { UserProfile } from './domain/authTypes';
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

const authService = new AuthService();
const store = new ArenaStore();
const boardView = new BoardView();
const editorView = new EditorView(store);
const leaderboardView = new LeaderboardView();

const serverArena = new ServerArena(store, authService, editorView, leaderboardView, loadMatchIntoReplay, switchMainTab, clearReplay);
function celebrate(): void { (window as any).confetti?.({ particleCount: 80 }); }

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
      const list = activeChip.parentElement;
      if (list) {
        const chipRect = activeChip.getBoundingClientRect();
        const listRect = list.getBoundingClientRect();
        if (chipRect.bottom > listRect.bottom) list.scrollTop += chipRect.bottom - listRect.bottom;
        else if (chipRect.top < listRect.top) list.scrollTop -= listRect.top - chipRect.top;
      }
    }
  }
);

function clearReplay(): void {
  replayController.loadMatch(store.initialBoardTemplate, { moves: [] });
  boardView.renderMoveHistoryChips([], () => {});
  setPlayPauseButtonState(false);
  const labels: Record<string, string> = {
    redPlayerName: 'PHE ĐỎ', bluePlayerName: 'PHE XANH',
    matchSummaryTag: 'Chọn một trận đấu để xem replay.'
  };
  for (const [id, value] of Object.entries(labels)) {
    const el = document.getElementById(id);
    if (el) el.textContent = value;
  }
  document.getElementById('errorAlertBox')?.classList.add('hidden');
}

function setPlayPauseButtonState(playing: boolean): void {
  const btn = document.getElementById('btnPlayPause');
  if (btn) btn.textContent = playing ? '⏸ Dừng' : '▶ Phát';
}

/**
 * Chuyển đổi giữa 4 Tab chính:
 *  - 'practice'    : Tab 1 (Đấu Tập Tay & Luật Chơi)
 *  - 'studio'      : Tab 2 (Phòng Lab Code & Chạy thử bot)
 *  - 'ladder'      : Tab 3 (Đấu xếp hạng trên máy chủ)
 *  - 'leaderboard' : Tab 4 (Bảng xếp hạng và lịch sử bài nộp)
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
    if (boardTitle) boardTitle.textContent = '🎬 Replay Kết Quả Chạy Thử Bot';
    switchBoardMode('replay', true);
  } else if (tabId === 'ladder') {
    const host = document.getElementById('boardHostLadder');
    if (host && sharedBoard) host.appendChild(sharedBoard);
    if (boardTitle) boardTitle.textContent = '⚔️ Replay Trận Đấu Xếp Hạng';
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
      errBox.textContent = `⚠️ Chi tiết trận đấu (${match.result}): ${match.errorDetail}`;
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
      celebrate();
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
        celebrate();
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

/**
 * Các thao tác thi đấu được xử lý qua API máy chủ.
 */
function handleRunTestMatch(): void { void serverArena.runTest(); }
function handleSubmitGauntlet(): void { void serverArena.submit(); }
function loadLeaderboard(): void { void serverArena.refresh(); }
function downloadMatchLog(): void { serverArena.downloadLog(); }

function renderAuthHeader(user: UserProfile | null): void {
  const container = document.getElementById('authHeaderSection');
  const gateScreen = document.getElementById('authGatewayScreen');
  const arenaContainer = document.getElementById('arenaAppContainer');
  const topbarNav = document.querySelector('.main-nav-tabs') as HTMLElement | null;

  if (!user) {
    switchGateAuthTab('login');
    document.querySelectorAll<HTMLInputElement>('input[type="password"]').forEach(input => { input.value = ''; });
    if (gateScreen) gateScreen.classList.remove('hidden');
    if (arenaContainer) arenaContainer.classList.add('hidden');
    if (topbarNav) topbarNav.style.display = 'none';

    if (container) {
      container.innerHTML = `
        <button class="btn-primary" style="padding:7px 15px; font-size:13px;" onclick="openAuthModal('login')">
          🔑 Đăng Nhập / Đăng Ký
        </button>
      `;
    }
  } else {
    if (gateScreen) gateScreen.classList.add('hidden');
    if (arenaContainer) arenaContainer.classList.remove('hidden');
    if (topbarNav) topbarNav.style.display = 'flex';

    const roleBadge = user.role === 'ADMIN'
      ? '<span class="badge-role role-admin">👑 ADMIN</span>'
      : '<span class="badge-role role-user">👤 PLAYER</span>';

    if (container) {
      container.innerHTML = `
        <div class="user-profile-badge">
          <div class="user-avatar-circle">${user.role === 'ADMIN' ? '👑' : '👤'}</div>
          <div class="user-info-text">
            <span class="user-name-title">${user.username}</span>
            <span style="font-size:11px; color:#94a3b8;">${roleBadge}</span>
          </div>
          <button class="btn-mini" onclick="handleLogout()" title="Đăng xuất">🚪 Thoát</button>
        </div>
      `;
    }

    const userInput = document.getElementById('usernameInput') as HTMLInputElement | null;
    if (userInput) { userInput.value = user.username; userInput.readOnly = true; }
    const ladderPreviewUser = document.getElementById('ladderPreviewUser');
    if (ladderPreviewUser) ladderPreviewUser.textContent = user.username;
  }
}

function switchGateAuthTab(tab: 'login' | 'register'): void {
  const isLogin = tab === 'login';
  document.getElementById('gateTabLogin')?.classList.toggle('active', isLogin);
  document.getElementById('gateTabRegister')?.classList.toggle('active', !isLogin);
  document.getElementById('gateFormLogin')?.classList.toggle('hidden', !isLogin);
  document.getElementById('gateFormRegister')?.classList.toggle('hidden', isLogin);
  document.getElementById('gateAlertBox')?.classList.add('hidden');
}

function showGateAlert(msg: string): void {
  const alertEl = document.getElementById('gateAlertBox');
  if (alertEl) {
    alertEl.textContent = msg;
    alertEl.classList.remove('hidden');
  }
}

async function handleGateLoginSubmit(e: Event): Promise<void> {
  e.preventDefault();
  const idInput = document.getElementById('gateLoginId') as HTMLInputElement | null;
  const passInput = document.getElementById('gateLoginPass') as HTMLInputElement | null;
  const btn = document.getElementById('btnGateSubmitLogin') as HTMLButtonElement | null;

  if (!idInput || !passInput) return;
  if (btn) {
    btn.disabled = true;
    btn.textContent = '⏳ Đang xác thực...';
  }

  const res = await authService.login(idInput.value, passInput.value);
  if (btn) {
    btn.disabled = false;
    btn.textContent = 'Vào Đấu Trường Chơi Ngay →';
  }

  if (res.success && res.user) {
    celebrate();
  } else {
    showGateAlert(res.error || 'Đăng nhập thất bại!');
  }
}

async function handleGateRegisterSubmit(e: Event): Promise<void> {
  e.preventDefault();
  const userInput = document.getElementById('gateRegUser') as HTMLInputElement | null;
  const emailInput = document.getElementById('gateRegEmail') as HTMLInputElement | null;
  const passInput = document.getElementById('gateRegPass') as HTMLInputElement | null;
  const btn = document.getElementById('btnGateSubmitRegister') as HTMLButtonElement | null;

  if (!userInput || !emailInput || !passInput) return;
  if (btn) {
    btn.disabled = true;
    btn.textContent = '⏳ Đang tạo tài khoản...';
  }

  const res = await authService.register(userInput.value, emailInput.value, passInput.value);
  if (btn) {
    btn.disabled = false;
    btn.textContent = 'Tạo Tài Khoản & Vào Chơi →';
  }

  if (res.success && res.user) {
    celebrate();
  } else {
    showGateAlert(res.error || 'Đăng ký thất bại!');
  }
}

function openAuthModal(tab: 'login' | 'register' = 'login'): void {
  const modal = document.getElementById('authModalBackdrop');
  if (modal) modal.classList.add('open');
  switchAuthTab(tab);
  hideAuthAlert();
}

function closeAuthModal(): void {
  const modal = document.getElementById('authModalBackdrop');
  if (modal) modal.classList.remove('open');
  hideAuthAlert();
}

function closeAuthModalOnBackdrop(e: MouseEvent): void {
  if ((e.target as HTMLElement).id === 'authModalBackdrop') {
    closeAuthModal();
  }
}

function switchAuthTab(tab: 'login' | 'register'): void {
  const isLogin = tab === 'login';
  document.getElementById('tabBtnLogin')?.classList.toggle('active', isLogin);
  document.getElementById('tabBtnRegister')?.classList.toggle('active', !isLogin);
  document.getElementById('formLogin')?.classList.toggle('hidden', !isLogin);
  document.getElementById('formRegister')?.classList.toggle('hidden', isLogin);
  hideAuthAlert();
}

function showAuthAlert(msg: string): void {
  const alertEl = document.getElementById('authAlertBox');
  if (alertEl) {
    alertEl.textContent = msg;
    alertEl.classList.remove('hidden');
  }
}

function hideAuthAlert(): void {
  document.getElementById('authAlertBox')?.classList.add('hidden');
}

async function handleLoginSubmit(e: Event): Promise<void> {
  e.preventDefault();
  const idInput = document.getElementById('loginIdentifier') as HTMLInputElement | null;
  const passInput = document.getElementById('loginPassword') as HTMLInputElement | null;
  const btn = document.getElementById('btnSubmitLogin') as HTMLButtonElement | null;

  if (!idInput || !passInput) return;
  if (btn) {
    btn.disabled = true;
    btn.textContent = '⏳ Đang xác thực...';
  }

  const res = await authService.login(idInput.value, passInput.value);
  if (btn) {
    btn.disabled = false;
    btn.textContent = 'Đăng Nhập Vào Đấu Trường';
  }

  if (res.success && res.user) {
    closeAuthModal();
    celebrate();
    alert(`🎉 Đăng nhập thành công! Chào mừng ${res.user.role === 'ADMIN' ? 'Quản trị viên' : 'người chơi'} [${res.user.username}].`);
  } else {
    showAuthAlert(res.error || 'Đăng nhập thất bại!');
  }
}

async function handleRegisterSubmit(e: Event): Promise<void> {
  e.preventDefault();
  const userInput = document.getElementById('regUsername') as HTMLInputElement | null;
  const emailInput = document.getElementById('regEmail') as HTMLInputElement | null;
  const passInput = document.getElementById('regPassword') as HTMLInputElement | null;
  const btn = document.getElementById('btnSubmitRegister') as HTMLButtonElement | null;

  if (!userInput || !emailInput || !passInput) return;
  if (btn) {
    btn.disabled = true;
    btn.textContent = '⏳ Đang tạo tài khoản...';
  }

  const res = await authService.register(userInput.value, emailInput.value, passInput.value);
  if (btn) {
    btn.disabled = false;
    btn.textContent = 'Tạo Tài Khoản Mới';
  }

  if (res.success && res.user) {
    closeAuthModal();
    celebrate();
    alert(`🎉 Đăng ký tài khoản thành công! Bạn hiện đang đăng nhập với vai trò [${res.user.role}].`);
  } else {
    showAuthAlert(res.error || 'Đăng ký thất bại!');
  }
}

async function handleLogout(): Promise<void> {
  if (confirm('Bạn có chắc chắn muốn đăng xuất khỏi tài khoản này?')) {
    try { await authService.logout(); } catch (error) { showAuthAlert((error as Error).message); alert((error as Error).message); }
  }
}

// Gắn các hàm toàn cục cho HTML gọi
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
  downloadMatchLog,
  loadLeaderboard,
  openAuthModal,
  closeAuthModal,
  closeAuthModalOnBackdrop,
  switchAuthTab,
  handleLoginSubmit,
  handleRegisterSubmit,
  handleLogout,
  switchGateAuthTab,
  handleGateLoginSubmit,
  handleGateRegisterSubmit
});

async function bootstrapClient(): Promise<void> {
  boardView.renderCoordHeaders();
  editorView.bindTabIndentation();
  authService.onAuthStateChanged(user => {
    renderAuthHeader(user);
    if (user) { void serverArena.refresh(); }
    else {
      replayController.stop();
      serverArena.clearPrivateState();
    }
  });
  switchMainTab('studio');
  await serverArena.initialize();
  try { await authService.restoreSession(); } catch { /* The login form remains available. */ }
}
void bootstrapClient();
