import { escapeHtml } from './escapeHtml';
import { LeaderboardEntryDto, MatchSummary, SubmissionDto } from '../domain/types';

export class LeaderboardView {
  /**
   * Hiển thị Bục Vinh Danh Top 3 & Bảng Xếp Hạng Người Chơi trên Server (Tab 4)
   */
  public renderLeaderboardTable(entries: LeaderboardEntryDto[], highlightUsername = ''): void {
    const podiumEl = document.getElementById('top3PodiumContainer');
    if (podiumEl) {
      const top3 = entries.slice(0, 3);
      const medals = ['🥇 HẠNG #1 — ĐƯƠNG KIM VÔ ĐỊCH', '🥈 HẠNG #2 — Á QUÂN', '🥉 HẠNG #3 — QUÝ QUÂN'];
      podiumEl.innerHTML = top3
        .map((item, idx) => {
          const langClass = `lang-${item.bestLanguage || 'python'}`;
          const langLabel = (item.bestLanguage || 'py').toUpperCase();
          return `<div class="podium-card podium-${idx + 1}">
            <div class="podium-rank-title">
              <span>${medals[idx]}</span>
              <span class="badge-lang ${langClass}">${langLabel}</span>
            </div>
            <div class="podium-username">👤 ${escapeHtml(item.username)}</div>
            <div class="podium-metrics">
              Điểm: <b>${item.bestScore} pts</b> • Chỉ số hạng: <b>${item.elo}</b> • Vượt qua: <b>${item.winsCount || 0} bậc</b> • Thời gian: <b>${item.bestExecTimeMs || '-'} ms</b>
            </div>
          </div>`;
        })
        .join('');
    }

    const tbody = document.getElementById('leaderboardBody');
    if (!tbody) return;

    tbody.innerHTML = entries
      .map(item => {
        const isMe =
          highlightUsername &&
          item.username.toLowerCase() === highlightUsername.toLowerCase();
        const rowClass = isMe ? 'highlight-user-row' : '';
        const medal =
          item.rank === 1
            ? '🥇 #1'
            : item.rank === 2
            ? '🥈 #2'
            : item.rank === 3
            ? '🥉 #3'
            : `#${item.rank}`;
        const langClass = `lang-${item.bestLanguage || 'python'}`;
        const langLabel = (item.bestLanguage || 'py').toUpperCase();

        const statusNote =
          item.rank === 1
            ? `<span style="color:#fbbf24;font-weight:700;">👑 Đương kim Top 1</span>`
            : item.stoppedBy
            ? `🛑 Dừng trước <b>${escapeHtml(item.stoppedBy)}</b>`
            : `Đang giữ hạng #${item.rank}`;

        return `<tr class="${rowClass}">
          <td><b>${medal}</b></td>
          <td>👤 <b>${escapeHtml(item.username)}</b></td>
          <td><span class="badge-lang ${langClass}">${langLabel}</span></td>
          <td><b>${item.bestScore} pts</b></td>
          <td>${item.elo}</td>
          <td>${statusNote}</td>
          <td>Thắng ${item.winsCount || 0} bậc</td>
          <td>${item.bestExecTimeMs ? item.bestExecTimeMs + ' ms' : '-'}</td>
        </tr>`;
      })
      .join('');
  }

  /**
   * Hiển thị Kết quả Test với 4 Bot trên máy chủ (Tab 2)
   */
  public renderClientBotTestResults(
    botMatches: MatchSummary[],
    onSelectReplay: (idx: number) => void
  ): void {
    const banner = document.getElementById('botTestSummaryBanner');
    const wins = botMatches.filter(m => m.result === 'WIN').length;
    if (banner) {
      banner.innerHTML = `
        🧪 <b>Kết quả Test với ${botMatches.length} Bot trên máy chủ:</b>
        Thắng <b>${wins}/${botMatches.length}</b> Bot •
        Bấm vào từng thẻ bên dưới để xem Replay bên phải, hoặc chuyển sang <b>Tab 3 (🧗 Đấu Trường Leo Tháp)</b> để Push Code!
      `;
    }

    const grid = document.getElementById('botTestMatchesGrid');
    if (!grid) return;
    grid.innerHTML = '';

    botMatches.forEach((m, idx) => {
      const cardClass =
        m.result === 'WIN' ? 'win-card' : m.result === 'DRAW' ? 'draw-card' : 'loss-card';
      const card = document.createElement('div');
      card.className = `match-card ${cardClass}`;
      card.innerHTML = `
        <div class="match-card-top">
          <span>🤖 ${escapeHtml(m.botName)}</span>
          <span class="res-pill res-${m.result}">${m.result}</span>
        </div>
        <div style="font-size:11.5px; color:#94a3b8;">
          Phe: <b>${m.userSide}</b> • Lượt: <b>${m.turnsCount}</b> • Thời gian: <b>${m.execTimeMs}ms</b>
        </div>
      `;
      const btn = document.createElement('button');
      btn.className = 'btn-mini';
      btn.textContent = '🎬 Xem Replay với Bot này';
      btn.onclick = () => onSelectReplay(idx);
      card.appendChild(btn);
      grid.appendChild(card);
    });
  }

  /**
   * Hiển thị Hành trình Leo Tháp từ dưới lên trên Server (Tab 3)
   */
  public renderGauntletResults(
    sub: SubmissionDto,
    userRank: number | null,
    onSelectMatchReplay: (matchIndex: number) => void
  ): void {
    const banner = document.getElementById('gauntletSummaryBanner');
    const ladderMatches = sub.ladderMatches || [];
    if (banner) {
      banner.innerHTML = `
        🚀 <b>Kết quả Leo BXH của ${escapeHtml(sub.username)} (${sub.language.toUpperCase()}):</b>
        Đã đấu từ dưới lên qua <b>${ladderMatches.length} người chơi</b> (Thắng <b>${sub.winsCount}</b>) •
        ${
          sub.stoppedBy
            ? `🛑 Dừng chân trước <b>${escapeHtml(sub.stoppedBy)}</b> → 📌 <b>Chốt Hạng #${userRank}</b>`
            : `👑 <b>Toàn thắng tất cả đối thủ → Chiếm ngôi TOP #1 Toàn Server!</b>`
        }
      `;
    }

    const grid = document.getElementById('gauntletMatchesGrid');
    if (!grid) return;
    grid.innerHTML = '';

    ladderMatches.forEach((lm, idx) => {
      const isWin = lm.result === 'WIN';
      const cardClass = isWin ? 'win-card' : 'loss-card';
      const stepStatus = isWin
        ? `✅ Vượt qua Hạng #${lm.defenderRankBefore} (${escapeHtml(lm.defenderUsername)}) → Leo tiếp lên bậc cao hơn ↑`
        : `🛑 Thua Hạng #${lm.defenderRankBefore} (${escapeHtml(lm.defenderUsername)}) → 📌 Chốt vị trí tại Hạng #${lm.defenderRankBefore + 1}`;

      const card = document.createElement('div');
      card.className = `match-card ${cardClass}`;
      card.innerHTML = `
        <div class="match-card-top">
          <span>Bậc ${lm.stepNumber} (Đấu từ dưới lên): vs #${lm.defenderRankBefore} ${escapeHtml(lm.defenderUsername)}</span>
          <span class="res-pill res-${lm.result}">${lm.result}</span>
        </div>
        <div style="font-size:12px; color:#e2e8f0; font-weight:600;">
          ${stepStatus}
        </div>
        <div style="font-size:11.5px; color:#94a3b8;">
          Code đối thủ: <b>${lm.defenderLanguage.toUpperCase()}</b> • Số nước đi: <b>${lm.turnsCount}</b> • Thời gian của bạn: <b>${lm.execTimeMs}ms</b>
        </div>
      `;
      const btn = document.createElement('button');
      btn.className = 'btn-mini';
      btn.textContent = '🎬 Xem Replay trận PvP này trên Bàn cờ bên phải';
      btn.onclick = () => onSelectMatchReplay(idx);
      card.appendChild(btn);
      grid.appendChild(card);
    });
  }
}
