import { cloneGrid, coordToRC } from '../domain/boardModel';
import { CellChar, MatchSummary, ReplayFrame } from '../domain/types';

export class ReplayController {
  private states: ReplayFrame[] = [];
  private index = 0;
  private timer: number | null = null;
  private intervalMs = 380;

  constructor(private readonly onFrameChanged: (frame: ReplayFrame, index: number, total: number) => void) {}

  public loadMatch(initialGrid: CellChar[][], match: Pick<MatchSummary, 'moves'>): void {
    this.stop();
    const frames: ReplayFrame[] = [];
    const b = cloneGrid(initialGrid);

    frames.push({
      board: cloneGrid(b),
      move: null,
      turn: 0
    });

    for (const m of match.moves || []) {
      const f = coordToRC(m.from);
      const t = coordToRC(m.to);
      b[t.r][t.c] = b[f.r][f.c];
      b[f.r][f.c] = '.';
      frames.push({
        board: cloneGrid(b),
        move: m,
        turn: m.turn
      });
    }

    this.states = frames;
    this.index = 0;
    this.notify();
  }

  public getStatesCount(): number {
    return this.states.length;
  }

  public getCurrentIndex(): number {
    return this.index;
  }

  public isPlaying(): boolean {
    return this.timer !== null;
  }

  public jumpTo(step: number): void {
    this.stop();
    if (this.states.length === 0) return;
    this.index = Math.max(0, Math.min(this.states.length - 1, Math.floor(step)));
    this.notify();
  }

  public first(): void {
    this.jumpTo(0);
  }

  public prev(): void {
    this.jumpTo(this.index - 1);
  }

  public next(): void {
    this.jumpTo(this.index + 1);
  }

  public last(): void {
    this.jumpTo(this.states.length - 1);
  }

  public togglePlay(onStateChange?: (playing: boolean) => void): void {
    if (this.timer !== null) {
      this.stop();
      if (onStateChange) onStateChange(false);
    } else {
      if (this.index >= this.states.length - 1) {
        this.index = 0;
      }
      this.start(onStateChange);
    }
  }

  public start(onStateChange?: (playing: boolean) => void): void {
    this.stop();
    if (this.states.length <= 1) return;
    if (onStateChange) onStateChange(true);

    this.timer = window.setInterval(() => {
      if (this.index < this.states.length - 1) {
        this.index++;
        this.notify();
      } else {
        this.stop();
        if (onStateChange) onStateChange(false);
      }
    }, this.intervalMs);
  }

  public stop(): void {
    if (this.timer !== null) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  public setSpeed(ms: number, onStateChange?: (playing: boolean) => void): void {
    this.intervalMs = ms || 380;
    if (this.timer !== null) {
      this.start(onStateChange);
    }
  }

  public notify(): void {
    if (this.states.length === 0) return;
    this.onFrameChanged(this.states[this.index], this.index, this.states.length - 1);
  }
}
