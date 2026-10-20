import { AuthService } from './adapters/authService';
import { PlayhtmlAdapter } from './adapters/playhtmlAdapter';
import { ArenaStore, MainTabId } from './application/arenaStore';
import { ReplayController } from './application/replayController';
import { UserProfile } from './domain/authTypes';
import {
  cloneGrid,
  computeRedLegalTargets,
  getPieceSide,
  rcToCoord
} from './domain/boardModel';
import { chooseClientBotMove, CLIENT_BOT_PROFILES, getLegalMovesForSide } from './domain/clientBots';
import { ClientMatchSimulator } from './domain/clientSimulator';
import { STARTER_TEMPLATES } from './domain/starterTemplates';
import { MatchSummary, ReplayFrame, Side, SupportedLanguage } from './domain/types';
import { BoardView } from './presentation/boardView';
import { EditorView } from './presentation/editorView';
import { LeaderboardView } from './presentation/leaderboardView';

const playhtmlAdapter = new PlayhtmlAdapter();
const authService = new AuthService();
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
 *  - 'ladder'      : Tab 3 (Đấu Trường Cướp Cờ CTF Realtime playhtml)
 *  - 'leaderboard' : Tab 4 (Bảng Vàng & Lịch Sử Cướp Cờ)
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
    if (boardTitle) boardTitle.textContent = '⚔️ Replay Trận Đấu Cướp Cờ Realtime CTF';
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
      const summary = document.getElementById('matchSummaryTag');
      if (summary) summary.textContent = '🎬 Sẵn sàng phát Replay (Bấm Chạy Test để xem)';
      const redName = document.getElementById('redPlayerName');
      const blueName = document.getElementById('bluePlayerName');
      if (redName) redName.textContent = '👤 BẠN (PHE ĐỎ - Đi trước)';
      if (blueName) blueName.textContent = '🤖 BOT ĐỐI THỦ (PHE XANH)';
      const badge = document.getElementById('turnStatusBadge');
      if (badge) badge.textContent = 'Lượt 0 • Sẵn sàng';
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
      playhtmlAdapter.triggerConfetti();
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
        playhtmlAdapter.triggerConfetti();
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
 * TAB 2: Chạy Test với 4 Bot hoàn toàn Client-Side trong 0.05 giây!
 */
function handleRunTestMatch(): void {
  const btn = document.getElementById('btnTestMatch') as HTMLButtonElement | null;
  const botSelect = document.getElementById('testBotSelect') as HTMLSelectElement | null;
  const sideSelect = document.getElementById('testSideSelect') as HTMLSelectElement | null;
  const selectedBotLevel = Number(botSelect?.value ?? 0);
  const userSide: Side = sideSelect?.value === 'BLUE' ? 'BLUE' : 'RED';
  const userCode = editorView.getCurrentCode();

  if (btn) {
    btn.disabled = true;
    btn.textContent = '⏳ Đang mô phỏng trận đấu...';
  }
  document.getElementById('errorAlertBox')?.classList.add('hidden');

  try {
    const botsToTest =
      selectedBotLevel === 0
        ? CLIENT_BOT_PROFILES
        : CLIENT_BOT_PROFILES.filter(b => b.level === selectedBotLevel);

    const maxTurns = parseInt(localStorage.getItem('rps_admin_max_turns') || '160', 10);
    const results: MatchSummary[] = [];

    botsToTest.forEach(bot => {
      const match = ClientMatchSimulator.simulateMatch({
        challenger: {
          name: editorView.getUsername(),
          jsCode: userCode,
          side: userSide
        },
        defender: {
          name: bot.name,
          level: bot.level,
          side: userSide === 'RED' ? 'BLUE' : 'RED'
        },
        maxTurns
      });
      results.push(match);
    });

    clientBotTestMatches = results;
    const badge = document.getElementById('botTestCountBadge');
    if (badge) badge.textContent = String(results.length);

    leaderboardView.renderClientBotTestResults(results, idx => {
      const m = results[idx];
      if (m) {
        loadMatchIntoReplay(
          m,
          `Test Bot Client: ${m.result} vs ${m.botName} (${m.turnsCount} nước • ${m.execTimeMs}ms)`
        );
      }
    });

    switchStudioSubTab('botTestTab');

    if (results.length > 0) {
      loadMatchIntoReplay(
        results[results.length - 1],
        `Test Bot Client: ${results[results.length - 1].result} vs ${results[results.length - 1].botName}`
      );
    }
  } catch (err: any) {
    alert('Lỗi khi mô phỏng ván cờ: ' + err?.message);
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.textContent = '🧪 Chạy Test Với 4 Bot (Client)';
    }
  }
}

/**
 * TAB 3: THÁCH ĐẤU CƯỚP CỜ CTF (REALTIME KING OF THE HILL)
 */
function handleSubmitGauntlet(): void {
  const btn = document.getElementById('btnSubmitRank') as HTMLButtonElement | null;
  const username = editorView.getUsername();
  const userCode = editorView.getCurrentCode();
  const currentKing = playhtmlAdapter.getKingState();

  if (btn) {
    btn.disabled = true;
    btn.textContent = '⚔️ Đang đấu cướp cờ với Đương Kim Vua...';
  }
  document.getElementById('errorAlertBox')?.classList.add('hidden');

  setTimeout(() => {
    try {
      const maxTurns = parseInt(localStorage.getItem('rps_admin_max_turns') || '160', 10);
      const match = ClientMatchSimulator.simulateMatch({
        challenger: {
          name: username,
          jsCode: userCode,
          side: 'RED'
        },
        defender: {
          name: currentKing.kingName,
          jsCode: currentKing.kingBotCode,
          side: 'BLUE'
        },
        maxTurns
      });

      store.currentGauntletMatches = [match];
      const countBadge = document.getElementById('gauntletCountBadge');
      if (countBadge) countBadge.textContent = '1';

      const banner = document.getElementById('gauntletSummaryBanner');
      if (match.result === 'WIN') {
        // CƯỚP CỜ THÀNH CÔNG!
        playhtmlAdapter.claimNewKing(username, userCode, currentKing.kingName);
        if (banner) {
          banner.className = 'gauntlet-banner win-card';
          banner.innerHTML = `
            🎉 <b>CHIẾN THẮNG OANH LIỆT!</b> Bạn đã cướp cờ thành công từ <b>${currentKing.kingName}</b> sau ${match.turnsCount} nước đi!
            Tên và mã nguồn bot của bạn hiện đã được đưa lên ngôi vị <b>VUA GIỮ CỜ</b> của toàn bộ đấu trường!
          `;
        }
      } else {
        // THUA TRẬN
        if (banner) {
          banner.className = 'gauntlet-banner loss-card';
          banner.innerHTML = `
            💀 <b>CƯỚP CỜ THẤT BẠI!</b> Bạn bị đánh bại bởi <b>${currentKing.kingName}</b> (${match.winReason}).
            Hãy mở Replay bên phải để phân tích điểm yếu, chỉnh sửa lại thuật toán ở Tab 2 và quay lại cướp cờ!
          `;
        }
      }

      const grid = document.getElementById('gauntletMatchesGrid');
      if (grid) {
        const cardClass = match.result === 'WIN' ? 'win-card' : 'loss-card';
        grid.innerHTML = `
          <div class="match-card ${cardClass}" onclick="loadLastGauntletReplay()">
            <div class="match-card-top">
              <span>👑 Trận Cướp Cờ: vs ${currentKing.kingName}</span>
              <span class="res-pill res-${match.result}">${match.result}</span>
            </div>
            <div class="match-card-metrics">
              Kết quả: <b>${match.result}</b> • Lý do: <b>${match.winReason}</b> • Thời gian: <b>${match.execTimeMs}ms</b>
            </div>
          </div>
        `;
      }

      loadMatchIntoReplay(
        match,
        `Trận Đấu Cướp Cờ: ${match.result} vs ${currentKing.kingName} (${match.turnsCount} nước)`
      );
      loadLeaderboard();
    } catch (err: any) {
      alert('Lỗi trong trận thách đấu cướp cờ: ' + err?.message);
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.textContent = '⚔️ THÁCH ĐẤU CƯỚP CỜ (ĐẤU VỚI VUA HIỆN TẠI)';
      }
    }
  }, 50);
}

function loadLastGauntletReplay(): void {
  const m = store.currentGauntletMatches[0];
  if (m) loadMatchIntoReplay(m, `Trận Cướp Cờ: ${m.result} vs ${m.botName}`);
}

/**
 * Tạo link chia sẻ thách đấu để gửi cho bạn bè
 */
function handleShareChallenge(): void {
  const username = editorView.getUsername();
  const code = editorView.getCurrentCode();
  const url = playhtmlAdapter.generateShareableUrl(username, code);

  navigator.clipboard.writeText(url).then(() => {
    alert(
      `🔗 ĐÃ SAO CHÉP LINK THÁCH ĐẤU VÀO CLIPBOARD!\n\nHãy gửi đường link này cho bạn bè hoặc thầy cô. Khi họ mở link, bot của bạn sẽ lập tức trở thành Boss giữ cờ trên máy của họ để họ thử sức cướp cờ!`
    );
  }).catch(() => {
    prompt('Link thách đấu của bạn:', url);
  });
}

/**
 * Nạp code của Vua hiện tại vào Editor để phân tích
 */
function viewKingCode(): void {
  const king = playhtmlAdapter.getKingState();
  const editor = document.getElementById('codeEditor') as HTMLTextAreaElement | null;
  if (editor && king.kingBotCode) {
    if (confirm(`Bạn có muốn nạp mã nguồn Bot của [${king.kingName}] vào Editor để đọc và phân tích điểm yếu không?`)) {
      editor.value = king.kingBotCode;
      switchMainTab('studio');
    }
  }
}

function loadLeaderboard(): void {
  const entries = playhtmlAdapter.getHallOfFame();
  leaderboardView.renderLeaderboardTable(entries, editorView.getUsername());
}

function renderAuthHeader(user: UserProfile | null): void {
  const container = document.getElementById('authHeaderSection');
  const gateScreen = document.getElementById('authGatewayScreen');
  const arenaContainer = document.getElementById('arenaAppContainer');
  const topbarNav = document.getElementById('mainNavTabs') || (document.querySelector('.main-nav-tabs') as HTMLElement | null);

  if (!user) {
    if (gateScreen) gateScreen.classList.remove('hidden');
    if (arenaContainer) arenaContainer.classList.add('hidden');
    if (topbarNav) topbarNav.style.display = 'none';

    if (container) {
      container.innerHTML = `
        <div class="topbar-guest-tag">🔒 Vui lòng đăng nhập để mở khóa</div>
      `;
    }
  } else {
    if (gateScreen) gateScreen.classList.add('hidden');
    if (arenaContainer) arenaContainer.classList.remove('hidden');
    if (topbarNav) topbarNav.style.display = 'flex';

    const roleBadge = user.role === 'ADMIN'
      ? '<span class="badge-role role-admin">👑 ADMIN</span>'
      : '<span class="badge-role role-user">👤 PLAYER</span>';

    const adminBtn = user.role === 'ADMIN'
      ? '<button class="btn-admin-config" onclick="openAdminModal()" title="Tùy chỉnh luật đấu trường">⚙️ Tùy Chỉnh Luật</button>'
      : '';

    if (container) {
      container.innerHTML = `
        <div class="user-profile-badge">
          <div class="user-avatar-circle">${user.role === 'ADMIN' ? '👑' : '👤'}</div>
          <div class="user-info-text">
            <span class="user-name-title">${user.username}</span>
            <span style="font-size:11px; color:#94a3b8;">${roleBadge} • <b>${user.elo}</b> pts</span>
          </div>
          ${adminBtn}
          <button class="btn-mini" onclick="handleLogout()" title="Đăng xuất">🚪 Thoát</button>
        </div>
      `;
    }

    const userInput = document.getElementById('usernameInput') as HTMLInputElement | null;
    if (userInput) userInput.value = user.username;
    const ladderPreviewUser = document.getElementById('ladderPreviewUser');
    if (ladderPreviewUser) ladderPreviewUser.textContent = user.username;
  }
}

function openAdminModal(): void {
  const modal = document.getElementById('adminModalBackdrop');
  if (modal) {
    const turnsInput = document.getElementById('adminMaxTurnsInput') as HTMLInputElement | null;
    if (turnsInput) {
      turnsInput.value = localStorage.getItem('rps_admin_max_turns') || '160';
    }
    const timeoutSelect = document.getElementById('adminMoveTimeoutSelect') as HTMLSelectElement | null;
    if (timeoutSelect) {
      timeoutSelect.value = localStorage.getItem('rps_admin_timeout') || '100';
    }
    const winSelect = document.getElementById('adminWinConditionSelect') as HTMLSelectElement | null;
    if (winSelect) {
      winSelect.value = localStorage.getItem('rps_admin_win_condition') || 'BASE_CAPTURE';
    }
    modal.classList.add('open');
  }
}

function closeAdminModal(): void {
  const modal = document.getElementById('adminModalBackdrop');
  if (modal) modal.classList.remove('open');
}

function closeAdminModalOnBackdrop(e: MouseEvent): void {
  if ((e.target as HTMLElement).id === 'adminModalBackdrop') {
    closeAdminModal();
  }
}

function saveAdminRules(): void {
  const turnsInput = document.getElementById('adminMaxTurnsInput') as HTMLInputElement | null;
  const timeoutSelect = document.getElementById('adminMoveTimeoutSelect') as HTMLSelectElement | null;
  const winSelect = document.getElementById('adminWinConditionSelect') as HTMLSelectElement | null;

  const turns = turnsInput?.value ? parseInt(turnsInput.value, 10) : 160;
  localStorage.setItem('rps_admin_max_turns', turns.toString());
  if (timeoutSelect) localStorage.setItem('rps_admin_timeout', timeoutSelect.value);
  if (winSelect) localStorage.setItem('rps_admin_win_condition', winSelect.value);

  playhtmlAdapter.triggerConfetti();
  alert(`✅ Đã lưu cấu hình luật chơi Admin thành công!\n• Max Turns: ${turns}\n• Timeout: ${timeoutSelect?.value || 100}ms\n• Ưu tiên: ${winSelect?.value === 'BASE_CAPTURE' ? 'Chiếm căn cứ' : 'Diệt hết quân'}`);
  closeAdminModal();
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
    playhtmlAdapter.triggerConfetti();
  } else {
    showGateAlert(res.error || 'Đăng nhập thất bại!');
  }
}

async function handleGateRegisterSubmit(e: Event): Promise<void> {
  e.preventDefault();
  const userInput = document.getElementById('gateRegUser') as HTMLInputElement | null;
  const emailInput = document.getElementById('gateRegEmail') as HTMLInputElement | null;
  const passInput = document.getElementById('gateRegPass') as HTMLInputElement | null;
  const roleSelect = document.getElementById('gateRegRole') as HTMLSelectElement | null;
  const btn = document.getElementById('btnGateSubmitRegister') as HTMLButtonElement | null;

  if (!userInput || !emailInput || !passInput) return;
  if (btn) {
    btn.disabled = true;
    btn.textContent = '⏳ Đang tạo tài khoản...';
  }

  const role = (roleSelect?.value === 'ADMIN' ? 'ADMIN' : 'USER') as any;
  const res = await authService.register(userInput.value, emailInput.value, passInput.value, role);
  if (btn) {
    btn.disabled = false;
    btn.textContent = 'Tạo Tài Khoản & Vào Chơi →';
  }

  if (res.success && res.user) {
    playhtmlAdapter.triggerConfetti();
  } else {
    showGateAlert(res.error || 'Đăng ký thất bại!');
  }
}

async function quickLogin(user: string, pass: string): Promise<void> {
  const res = await authService.login(user, pass);
  if (res.success && res.user) {
    playhtmlAdapter.triggerConfetti();
  } else {
    alert(res.error || 'Đăng nhập nhanh thất bại');
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
    playhtmlAdapter.triggerConfetti();
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
  const roleSelect = document.getElementById('regRole') as HTMLSelectElement | null;
  const btn = document.getElementById('btnSubmitRegister') as HTMLButtonElement | null;

  if (!userInput || !emailInput || !passInput) return;
  if (btn) {
    btn.disabled = true;
    btn.textContent = '⏳ Đang tạo tài khoản...';
  }

  const role = (roleSelect?.value === 'ADMIN' ? 'ADMIN' : 'USER') as any;
  const res = await authService.register(userInput.value, emailInput.value, passInput.value, role);
  if (btn) {
    btn.disabled = false;
    btn.textContent = 'Tạo Tài Khoản Mới';
  }

  if (res.success && res.user) {
    closeAuthModal();
    playhtmlAdapter.triggerConfetti();
    alert(`🎉 Đăng ký tài khoản thành công! Bạn hiện đang đăng nhập với vai trò [${res.user.role}].`);
  } else {
    showAuthAlert(res.error || 'Đăng ký thất bại!');
  }
}

function handleLogout(): void {
  if (confirm('Bạn có chắc chắn muốn đăng xuất khỏi tài khoản này?')) {
    authService.logout();
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
  handleShareChallenge,
  viewKingCode,
  loadLastGauntletReplay,
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
  handleGateRegisterSubmit,
  quickLogin,
  openAdminModal,
  closeAdminModal,
  closeAdminModalOnBackdrop,
  saveAdminRules
});

function updateKingDisplayCard(): void {
  const king = playhtmlAdapter.getKingState();
  const nameEl = document.getElementById('kingNameDisplay');
  const timeEl = document.getElementById('kingTimeDisplay');
  const eloEl = document.getElementById('kingEloDisplay');
  const bossEl = document.getElementById('ladderCurrentBossName');

  if (nameEl) nameEl.textContent = king.kingName;
  if (timeEl) timeEl.textContent = king.capturedAt;
  if (eloEl) eloEl.textContent = String(king.kingElo);
  if (bossEl) bossEl.textContent = king.kingName;
}

function bootstrapClient(): void {
  boardView.renderCoordHeaders();
  editorView.bindTabIndentation();

  store.initialBoardTemplate = ClientMatchSimulator.INITIAL_BOARD;
  store.templatesByLang = { ...STARTER_TEMPLATES } as any;
  store.userDraftByLang = { ...STARTER_TEMPLATES } as any;
  store.currentBoard = cloneGrid(ClientMatchSimulator.INITIAL_BOARD);

  playhtmlAdapter.onKingStateChange(() => {
    updateKingDisplayCard();
    loadLeaderboard();
  });

  authService.onAuthStateChanged((user) => {
    renderAuthHeader(user);
  });

  editorView.selectLanguage('javascript');
  switchMainTab('studio');
  updateKingDisplayCard();
  loadLeaderboard();
}

bootstrapClient();
