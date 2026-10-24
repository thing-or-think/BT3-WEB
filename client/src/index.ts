import { AuthService } from './adapters/authService';
import { ServerArena } from './application/serverArena';
import { ArenaStore, MainTabId } from './application/arenaStore';
import { ReplayController } from './application/replayController';
import { UserProfile } from './domain/authTypes';
import {
  canCapture,
  cloneGrid,
  computeRedLegalTargets,
  DIRS,
  getPieceSide,
  rcToCoord
} from './domain/boardModel';
import { chooseClientBotMove, getLegalMovesForSide } from './domain/clientBots';
import { LegalTargetHint, MatchSummary, ReplayFrame, Side, SupportedLanguage } from './domain/types';
import { BoardView } from './presentation/boardView';
import { EditorView } from './presentation/editorView';
import { LeaderboardView } from './presentation/leaderboardView';

const authService = new AuthService();
const store = new ArenaStore();
const boardView = new BoardView();
const editorView = new EditorView(store);
const leaderboardView = new LeaderboardView();

function celebrate(): void { (window as any).confetti?.({ particleCount: 80 }); }
const serverArena = new ServerArena(store, authService, editorView, leaderboardView, loadMatchIntoReplay, switchMainTab, clearReplay);

let clientBotTestMatches: MatchSummary[] = [];
let currentActiveMatch: MatchSummary | null = null;

function handleCellClick(r: number, c: number): void {
  if (store.boardMode === 'manual') {
    handleManualCellClick(r, c);
  }
  inspectUnitAt(r, c);
}

function inspectUnitAt(r: number, c: number): void {
  const piece = store.currentBoard[r][c];
  const hud = document.getElementById('unitInspectorCard');
  if (!hud) return;

  if (!piece || piece === '.') {
    hud.classList.add('hidden');
    store.manualSelectedRC = null;
    store.manualLegalTargets = [];
    boardView.renderBoard({
      board: store.currentBoard,
      boardMode: store.boardMode,
      selectedRC: null,
      legalTargets: [],
      onCellClick: handleCellClick
    });
    return;
  }

  const side = getPieceSide(piece);
  const coord = rcToCoord(r, c);
  const targetBase = side === 'RED' ? { r: 0, c: 8, name: 'i9' } : { r: 8, c: 0, name: 'a1' };
  const dist = Math.abs(r - targetBase.r) + Math.abs(c - targetBase.c);

  const upper = piece.toUpperCase();
  const pieceMap: Record<string, { name: string; icon: string; beats: string; loses: string }> = {
    R: { name: 'ĐẤM (ROCK)', icon: '✊', beats: '✌️ Kéo', loses: '✋ Lá' },
    P: { name: 'LÁ (PAPER)', icon: '✋', beats: '✊ Đấm', loses: '✌️ Kéo' },
    S: { name: 'KÉO (SCISSORS)', icon: '✌️', beats: '✋ Lá', loses: '✊ Đấm' }
  };
  const info = pieceMap[upper] || { name: 'QUÂN CỜ', icon: '♟️', beats: '?', loses: '?' };

  const iconEl = document.getElementById('inspectPieceIcon');
  const nameEl = document.getElementById('inspectPieceName');
  const sideEl = document.getElementById('inspectPieceSide');
  const coordEl = document.getElementById('inspectPieceCoord');
  const targetEl = document.getElementById('inspectPieceTarget');
  const movesEl = document.getElementById('inspectPieceMoves');
  const matchEl = document.getElementById('inspectPieceMatchup');

  if (iconEl) iconEl.textContent = info.icon;
  if (nameEl) nameEl.textContent = info.name;
  if (sideEl) {
    sideEl.textContent = side === 'RED' ? 'PHE ĐỎ (RED)' : 'PHE XANH (BLUE)';
    sideEl.className = `inspect-badge ${side === 'RED' ? 'badge-side-red' : 'badge-side-blue'}`;
  }
  if (coordEl) coordEl.textContent = coord;
  if (targetEl) targetEl.textContent = `${targetBase.name} (${dist} bước)`;
  if (matchEl) matchEl.textContent = `Thắng: ${info.beats} • Sợ: ${info.loses}`;

  const targets: LegalTargetHint[] = [];
  const ownBase = side === 'RED' ? { r: 8, c: 0 } : { r: 0, c: 8 };
  for (const [dr, dc] of DIRS) {
    const nr = r + dr;
    const nc = c + dc;
    if (nr < 0 || nr >= 9 || nc < 0 || nc >= 9) continue;
    if (nr === ownBase.r && nc === ownBase.c) continue;
    const targetPiece = store.currentBoard[nr][nc];
    if (targetPiece === '.') {
      targets.push({ r: nr, c: nc, isCapture: false });
    } else if (canCapture(piece, targetPiece)) {
      targets.push({ r: nr, c: nc, isCapture: true });
    }
  }

  if (movesEl) movesEl.textContent = `${targets.length} hướng hợp lệ`;
  hud.classList.remove('hidden');

  store.manualSelectedRC = { r, c };
  store.manualLegalTargets = targets;
  boardView.renderBoard({
    board: store.currentBoard,
    boardMode: store.boardMode,
    selectedRC: { r, c },
    legalTargets: targets,
    onCellClick: handleCellClick
  });
}

function closeUnitInspector(): void {
  const hud = document.getElementById('unitInspectorCard');
  if (hud) hud.classList.add('hidden');
  store.manualSelectedRC = null;
  store.manualLegalTargets = [];
  boardView.renderBoard({
    board: store.currentBoard,
    boardMode: store.boardMode,
    selectedRC: null,
    legalTargets: [],
    onCellClick: handleCellClick
  });
}

function renderTimelineMarkers(match: MatchSummary): void {
  const track = document.getElementById('timelineMarkersTrack');
  if (!track) return;
  track.innerHTML = '';

  const total = match.moves?.length || 0;
  if (total === 0) return;

  match.moves.forEach((m, idx) => {
    if (m.captured) {
      const pct = (idx / total) * 100;
      const marker = document.createElement('div');
      const isRed = m.side === 'RED';
      marker.className = `timeline-event-marker ${isRed ? 'marker-red' : 'marker-blue'}`;
      marker.style.left = `${pct}%`;
      marker.title = `Nước ${m.turn}: ${m.side} ăn quân ${m.captured} tại ${m.to}`;
      marker.onclick = (e) => {
        e.stopPropagation();
        setPlayPauseButtonState(false);
        replayController.jumpTo(idx + 1);
      };
      track.appendChild(marker);
    }
  });

  const winMarker = document.createElement('div');
  winMarker.className = 'timeline-event-marker marker-win';
  winMarker.style.left = '100%';
  winMarker.title = `Kết thúc: ${match.winnerSide} chiến thắng (${match.winReason})!`;
  winMarker.onclick = (e) => {
    e.stopPropagation();
    replayController.last();
  };
  track.appendChild(winMarker);
}

function renderMatchTelemetry(match: MatchSummary): void {
  const container = document.getElementById('telemetryChartContainer');
  const statsRow = document.getElementById('telemetryStatsRow');
  if (!container || !statsRow) return;

  const frames = replayController.getStates();
  if (frames.length === 0) {
    container.innerHTML = `<div class="telemetry-empty-hint">Chưa có dữ liệu ván đấu.</div>`;
    return;
  }

  const turnsData: Array<{ turn: number; red: number; blue: number }> = [];
  frames.forEach((f, idx) => {
    let r = 0;
    let b = 0;
    for (let row = 0; row < 9; row++) {
      for (let col = 0; col < 9; col++) {
        const p = f.board[row][col];
        if (p && p !== '.') {
          if (getPieceSide(p) === 'RED') r++;
          else b++;
        }
      }
    }
    turnsData.push({ turn: idx, red: r, blue: b });
  });

  const W = 580;
  const H = 170;
  const padL = 35;
  const padR = 20;
  const padT = 20;
  const padB = 30;
  const plotW = W - padL - padR;
  const plotH = H - padT - padB;
  const maxTurn = Math.max(1, turnsData.length - 1);
  const maxPieces = 9;

  const toX = (t: number) => padL + (t / maxTurn) * plotW;
  const toY = (count: number) => padT + plotH - (count / maxPieces) * plotH;

  const redPts = turnsData.map(d => `${toX(d.turn).toFixed(1)},${toY(d.red).toFixed(1)}`).join(' ');
  const bluePts = turnsData.map(d => `${toX(d.turn).toFixed(1)},${toY(d.blue).toFixed(1)}`).join(' ');

  container.innerHTML = `
    <svg viewBox="0 0 ${W} ${H}" class="telemetry-svg" style="width:100%; height:auto;">
      <defs>
        <linearGradient id="redGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#ef4444" stop-opacity="0.3" />
          <stop offset="100%" stop-color="#ef4444" stop-opacity="0.0" />
        </linearGradient>
        <linearGradient id="blueGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#06b6d4" stop-opacity="0.3" />
          <stop offset="100%" stop-color="#06b6d4" stop-opacity="0.0" />
        </linearGradient>
      </defs>

      <line x1="${padL}" y1="${toY(9)}" x2="${W - padR}" y2="${toY(9)}" stroke="#222d42" stroke-dasharray="3" />
      <line x1="${padL}" y1="${toY(6)}" x2="${W - padR}" y2="${toY(6)}" stroke="#222d42" stroke-dasharray="3" />
      <line x1="${padL}" y1="${toY(3)}" x2="${W - padR}" y2="${toY(3)}" stroke="#222d42" stroke-dasharray="3" />
      <line x1="${padL}" y1="${toY(0)}" x2="${W - padR}" y2="${toY(0)}" stroke="#334155" />

      <text x="${padL - 8}" y="${toY(9) + 4}" fill="#64748b" font-size="10" text-anchor="end">9</text>
      <text x="${padL - 8}" y="${toY(6) + 4}" fill="#64748b" font-size="10" text-anchor="end">6</text>
      <text x="${padL - 8}" y="${toY(3) + 4}" fill="#64748b" font-size="10" text-anchor="end">3</text>
      <text x="${padL - 8}" y="${toY(0) + 4}" fill="#64748b" font-size="10" text-anchor="end">0</text>

      <polyline fill="none" stroke="#ef4444" stroke-width="2.5" points="${redPts}" />
      <polyline fill="none" stroke="#06b6d4" stroke-width="2.5" points="${bluePts}" />

      <circle cx="${W - 160}" cy="12" r="4" fill="#ef4444" />
      <text x="${W - 150}" y="15" fill="#f87171" font-size="11" font-weight="700">PHE ĐỎ (YOU)</text>
      <circle cx="${W - 65}" cy="12" r="4" fill="#06b6d4" />
      <text x="${W - 55}" y="15" fill="#67e8f9" font-size="11" font-weight="700">PHE XANH</text>
    </svg>
  `;

  statsRow.innerHTML = `
    <div class="telemetry-stat-card">
      <span class="t-label">⏱️ Tổng số nước:</span>
      <b class="t-val">${match.turnsCount} turns</b>
    </div>
    <div class="telemetry-stat-card">
      <span class="t-label">⚡ Benchmark tính:</span>
      <b class="t-val">${match.execTimeMs} ms (${(match.execTimeMs / Math.max(1, match.turnsCount)).toFixed(2)}ms/nước)</b>
    </div>
    <div class="telemetry-stat-card">
      <span class="t-label">🏆 Kết quả:</span>
      <b class="t-val ${match.result === 'WIN' ? 'val-win' : 'val-loss'}">${match.result} (${match.winReason})</b>
    </div>
    <div class="telemetry-stat-card">
      <span class="t-label">🤖 Đối thủ:</span>
      <b class="t-val">${match.botName}</b>
    </div>
  `;
}

function appendDebugLog(msg: string, type: 'info' | 'warn' | 'success' | 'system' = 'info'): void {
  const terminal = document.getElementById('botDebugConsole');
  if (!terminal) return;
  const line = document.createElement('div');
  line.className = `term-line term-${type}`;
  line.textContent = `[${new Date().toLocaleTimeString()}] ${msg}`;
  terminal.appendChild(line);
  terminal.scrollTop = terminal.scrollHeight;
}

function clearDebugConsole(): void {
  const terminal = document.getElementById('botDebugConsole');
  if (terminal) {
    terminal.innerHTML = `
      <div class="term-line term-system">[SYSTEM] Console buffer cleared by user.</div>
    `;
  }
}

function logMatchToConsole(match: MatchSummary): void {
  const playerName = authService.getCurrentUser()?.username || 'Player';
  appendDebugLog(`[INIT] Running MIT Local Scrimmage vs ${match.botName}...`, 'system');
  appendDebugLog(`[CONFIG] User: ${playerName} (${match.userSide}) | Opponent: ${match.botName} | Turns: ${match.turnsCount}`, 'info');

  const moves = match.moves || [];
  const sampleMoves = moves.slice(0, 6);
  sampleMoves.forEach(m => {
    const act = m.actor === 'USER' ? 'USR' : 'BOT';
    const cap = m.captured ? ` -> ĂN QUÂN [${m.captured}]` : '';
    appendDebugLog(`[Turn ${m.turn.toString().padStart(2, '0')}] ${m.side} (${act}): ${m.piece} ${m.from} -> ${m.to}${cap}`, m.captured ? 'warn' : 'info');
  });

  if (moves.length > 6) {
    appendDebugLog(`[STREAM] ... [${moves.length - 6} turns omitted for brevity] ...`, 'info');
    const lastM = moves[moves.length - 1];
    appendDebugLog(`[Turn ${lastM.turn}] Final Move: ${lastM.side} ${lastM.piece} ${lastM.from} -> ${lastM.to}`, 'info');
  }

  if (match.result === 'WIN') {
    appendDebugLog(`[VICTORY] Match won by ${playerName} in ${match.turnsCount} turns (${match.winReason})! Benchmark: ${match.execTimeMs}ms`, 'success');
  } else {
    appendDebugLog(`[DEFEAT] Match finished in ${match.result} (${match.winReason}). Benchmark: ${match.execTimeMs}ms`, 'warn');
  }
}

function exportMatchReplayJson(): void {
  if (!currentActiveMatch) {
    alert('Chưa có dữ liệu ván đấu để xuất replay. Hãy chạy test đối kháng trước!');
    return;
  }
  const payload = {
    competition: 'MIT Battlecode 9x9 AI Arena',
    version: '2.0.0-mit',
    exportedAt: new Date().toISOString(),
    match: currentActiveMatch,
    framesCount: replayController.getStatesCount()
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  const playerName = authService.getCurrentUser()?.username || 'player';
  a.download = `mit_battlecode_${playerName}_vs_${currentActiveMatch.botName}_${Date.now()}.json`;
  a.click();
  URL.revokeObjectURL(url);
  celebrate();
}

const replayController = new ReplayController(
  (frame: ReplayFrame, index: number, total: number) => {
    store.currentBoard = cloneGrid(frame.board);
    boardView.renderBoard({
      board: store.currentBoard,
      lastMove: frame.move,
      boardMode: store.boardMode,
      selectedRC: store.manualSelectedRC,
      legalTargets: store.manualLegalTargets,
      onCellClick: handleCellClick
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

function toggleReplayPlay(): void {
  replayController.togglePlay(setPlayPauseButtonState);
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

  currentActiveMatch = match;
  renderTimelineMarkers(match);
  renderMatchTelemetry(match);
  logMatchToConsole(match);

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
  const topbarNav = document.getElementById('mainNavTabs') || (document.querySelector('.main-nav-tabs') as HTMLElement | null);

  if (!user) {
    switchGateAuthTab('login');
    document.querySelectorAll<HTMLInputElement>('input[type="password"]').forEach(input => { input.value = ''; });
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
            <span style="font-size:11px; color:#94a3b8;">${roleBadge}</span>
          </div>
          ${adminBtn}
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

  celebrate();
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
  toggleReplayPlay,
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
  handleGateRegisterSubmit,
  openAdminModal,
  closeAdminModal,
  closeAdminModalOnBackdrop,
  saveAdminRules,
  closeUnitInspector,
  clearDebugConsole,
  exportMatchReplayJson
});

window.addEventListener('keydown', (e: KeyboardEvent) => {
  const target = e.target as HTMLElement;
  if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT')) {
    return;
  }

  if (e.code === 'Space') {
    e.preventDefault();
    toggleReplayPlay();
  } else if (e.code === 'ArrowLeft') {
    e.preventDefault();
    setPlayPauseButtonState(false);
    replayController.prev();
  } else if (e.code === 'ArrowRight') {
    e.preventDefault();
    setPlayPauseButtonState(false);
    replayController.next();
  } else if (e.code === 'Home') {
    e.preventDefault();
    setPlayPauseButtonState(false);
    replayController.first();
  } else if (e.code === 'End') {
    e.preventDefault();
    setPlayPauseButtonState(false);
    replayController.last();
  } else if (e.code === 'Escape') {
    closeUnitInspector();
  }
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
