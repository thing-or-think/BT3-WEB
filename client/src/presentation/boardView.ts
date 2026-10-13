import { coordToRC, FILES, getPieceSide, rcToCoord } from '../domain/boardModel';
import { CellChar, LegalTargetHint, MoveRecord } from '../domain/types';

export class BoardView {
  public renderCoordHeaders(): void {
    const topEl = document.getElementById('topCoords');
    const botEl = document.getElementById('bottomCoords');
    const leftEl = document.getElementById('leftRanks');
    const rightEl = document.getElementById('rightRanks');

    const filesHtml = FILES.map(f => `<span>${f}</span>`).join('');
    if (topEl) topEl.innerHTML = filesHtml;
    if (botEl) botEl.innerHTML = filesHtml;

    let ranksHtml = '';
    for (let rank = 9; rank >= 1; rank--) {
      ranksHtml += `<span>${rank}</span>`;
    }
    if (leftEl) leftEl.innerHTML = ranksHtml;
    if (rightEl) rightEl.innerHTML = ranksHtml;
  }

  public getPieceSvgAndLabel(pieceChar: string): { label: string; svg: string } {
    const type = pieceChar.toUpperCase();
    if (type === 'R') {
      return {
        label: 'ĐẤM',
        svg: `<svg class="piece-svg" viewBox="0 0 24 24">
          <path d="M8 5a2 2 0 0 1 4 0v1a2 2 0 0 1 4 0v1a2 2 0 0 1 3 1.73V14a6 6 0 0 1-6 6h-2a6 6 0 0 1-5.66-4H5a2 2 0 0 1-2-2v-2a2 2 0 0 1 2-2h1V7a2 2 0 0 1 2-2z"/>
        </svg>`
      };
    }
    if (type === 'P') {
      return {
        label: 'LÁ',
        svg: `<svg class="piece-svg" viewBox="0 0 24 24">
          <path d="M12 2a1.5 1.5 0 0 1 1.5 1.5v6h1V3.5a1.5 1.5 0 0 1 3 0v6.5h1V5.5a1.5 1.5 0 0 1 3 0V14a8 8 0 0 1-8 8h-1.5a7.5 7.5 0 0 1-6.9-4.6l-2.3-5.2a1.5 1.5 0 0 1 2.7-1.2L7 14V4.5a1.5 1.5 0 0 1 3 0v5h.5V3.5A1.5 1.5 0 0 1 12 2z"/>
        </svg>`
      };
    }
    return {
      label: 'KÉO',
      svg: `<svg class="piece-svg" viewBox="0 0 24 24">
        <path d="M9.5 2A1.5 1.5 0 0 1 11 3.5V10h1.5V3.5a1.5 1.5 0 0 1 3 0V10h1a2 2 0 0 1 2 2v3a7 7 0 0 1-7 7h-1a7 7 0 0 1-6.5-4.4l-1.5-3.6a1.5 1.5 0 0 1 2.7-1.2L6.5 14V9.5A1.5 1.5 0 0 1 8 8V3.5A1.5 1.5 0 0 1 9.5 2z"/>
      </svg>`
    };
  }

  public renderBoard(params: {
    board: CellChar[][];
    lastMove?: { from: string; to: string } | null;
    boardMode: 'replay' | 'manual';
    selectedRC: { r: number; c: number } | null;
    legalTargets: LegalTargetHint[];
    onCellClick?: (r: number, c: number) => void;
  }): void {
    const boardEl = document.getElementById('chessBoard');
    if (!boardEl) return;
    boardEl.innerHTML = '';

    let redCount = 0;
    let blueCount = 0;

    const fromRC = params.lastMove?.from ? coordToRC(params.lastMove.from) : null;
    const toRC = params.lastMove?.to ? coordToRC(params.lastMove.to) : null;

    for (let r = 0; r < 9; r++) {
      for (let c = 0; c < 9; c++) {
        const cell = document.createElement('div');
        const isLight = (r + c) % 2 === 1;
        cell.className = `board-cell ${isLight ? 'cell-light' : 'cell-dark'}`;

        if (r === 0 && c === 8) {
          cell.classList.add('base-blue');
          const flag = document.createElement('span');
          flag.className = 'base-flag-label base-flag-blue';
          flag.innerHTML = '🚩 i9';
          cell.appendChild(flag);
        } else if (r === 8 && c === 0) {
          cell.classList.add('base-red');
          const flag = document.createElement('span');
          flag.className = 'base-flag-label base-flag-red';
          flag.innerHTML = '🚩 a1';
          cell.appendChild(flag);
        }

        if (fromRC && fromRC.r === r && fromRC.c === c) {
          cell.classList.add('last-from');
        }
        if (toRC && toRC.r === r && toRC.c === c) {
          cell.classList.add('last-to');
        }

        if (params.boardMode === 'manual') {
          if (params.selectedRC && params.selectedRC.r === r && params.selectedRC.c === c) {
            cell.classList.add('selected-cell');
          }
          const targetHint = params.legalTargets.find(t => t.r === r && t.c === c);
          if (targetHint) {
            cell.classList.add(targetHint.isCapture ? 'legal-move-capture' : 'legal-move-empty');
          }
          if (params.onCellClick) {
            cell.onclick = () => params.onCellClick!(r, c);
          }
        }

        const piece = params.board[r][c];
        if (piece && piece !== '.') {
          const side = getPieceSide(piece);
          if (side === 'RED') redCount++;
          else blueCount++;

          const { svg, label } = this.getPieceSvgAndLabel(piece);
          const pieceEl = document.createElement('div');
          pieceEl.className = `rps-piece ${side === 'RED' ? 'piece-red' : 'piece-blue'}`;
          pieceEl.title = `${rcToCoord(r, c)}: ${label} (${side})`;
          pieceEl.innerHTML = `${svg}<span class="piece-label">${label}</span>`;
          cell.appendChild(pieceEl);
        }

        boardEl.appendChild(cell);
      }
    }

    const redStats = document.getElementById('redStats');
    const blueStats = document.getElementById('blueStats');
    if (redStats) redStats.textContent = `Quân còn: ${redCount}`;
    if (blueStats) blueStats.textContent = `Quân còn: ${blueCount}`;
  }

  public renderMoveHistoryChips(moves: MoveRecord[], onChipClick: (stepIndex: number) => void): void {
    const container = document.getElementById('moveHistoryList');
    if (!container) return;

    if (!moves || moves.length === 0) {
      container.innerHTML = `<div class="empty-hint">Trận đấu chưa có nước đi nào.</div>`;
      return;
    }

    container.innerHTML = '';
    moves.forEach((m, idx) => {
      const stepIdx = idx + 1;
      const chip = document.createElement('div');
      chip.className = 'move-chip';
      chip.id = `moveChip_${stepIdx}`;
      chip.innerHTML = `
        <span><b>#${m.turn}</b> ${m.piece}: ${m.from}→${m.to}</span>
        ${m.captured ? `<span class="capture-badge">⚔️${m.captured}</span>` : ''}
      `;
      chip.onclick = () => onChipClick(stepIdx);
      container.appendChild(chip);
    });
  }
}
