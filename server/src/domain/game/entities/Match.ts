import { BotProfile, MatchOutcome, MoveRecord, Side, WinReason } from '../types/GameTypes';
import { Move } from '../value-objects/Move';
import { Board } from './Board';

export class Match {
  private board: Board;
  private readonly moves: MoveRecord[] = [];
  private outcome: MatchOutcome = 'DRAW';
  private winnerSide: Side | null = null;
  private winReason: WinReason = 'MAX_TURNS';
  private errorDetail: string | null = null;
  private userExecTimeMs = 0;
  private userTurns = 0;

  constructor(
    public readonly botProfile: BotProfile,
    public readonly userSide: Side
  ) {
    this.board = new Board();
  }

  public getBoard(): Board {
    return this.board;
  }

  public recordMove(
    turn: number,
    actor: 'USER' | 'BOT',
    side: Side,
    move: Move,
    timeMs: number
  ): boolean {
    this.board = this.board.applyMove(move);
    if (actor === 'USER') {
      this.userExecTimeMs += timeMs;
      this.userTurns += 1;
    }

    this.moves.push({
      turn,
      actor,
      side,
      piece: move.piece,
      from: move.from,
      to: move.to,
      captured: move.captured,
      timeMs
    });

    if (Board.isEnemyBase(side, move.toR, move.toC)) {
      this.winnerSide = side;
      this.outcome = side === this.userSide ? 'WIN' : 'LOSS';
      this.winReason = 'BASE_CAPTURE';
      return true;
    }

    return false;
  }

  public finishByNoMoves(stuckSide: Side): void {
    this.winnerSide = stuckSide === 'RED' ? 'BLUE' : 'RED';
    this.outcome = this.winnerSide === this.userSide ? 'WIN' : 'LOSS';
    this.winReason = 'NO_MOVES';
  }

  public finishByTurnLimit(): void {
    this.winnerSide = this.board.resolveTieBreakWinner();
    this.outcome = this.winnerSide === this.userSide ? 'WIN' : 'LOSS';
    this.winReason = 'MAX_TURNS';
  }

  public finishByUserFault(
    faultOutcome: 'TLE' | 'RE' | 'INVALID_MOVE',
    reason: WinReason,
    detail: string,
    addedTimeMs = 0
  ): void {
    this.userExecTimeMs += addedTimeMs;
    this.userTurns += 1;
    this.winnerSide = this.userSide === 'RED' ? 'BLUE' : 'RED';
    this.outcome = faultOutcome;
    this.winReason = reason;
    this.errorDetail = detail;
  }

  public getMoves(): MoveRecord[] {
    return [...this.moves];
  }

  public getTurnsCount(): number {
    return this.moves.length;
  }

  public getOutcome(): MatchOutcome {
    return this.outcome;
  }

  public getWinnerSide(): Side | null {
    return this.winnerSide;
  }

  public getWinReason(): WinReason {
    return this.winReason;
  }

  public getErrorDetail(): string | null {
    return this.errorDetail;
  }

  public getUserExecTimeMs(): number {
    return this.userExecTimeMs;
  }

  public getUserTurns(): number {
    return this.userTurns;
  }
}
