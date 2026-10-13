import { Side } from '../types/GameTypes';

export class Coordinate {
  public static readonly BOARD_SIZE = 9;
  public static readonly FILES = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i'] as const;
  public static readonly RED_BASE = new Coordinate(8, 0);  // a1
  public static readonly BLUE_BASE = new Coordinate(0, 8); // i9

  constructor(
    public readonly row: number,
    public readonly col: number
  ) {}

  public isValid(): boolean {
    return (
      this.row >= 0 &&
      this.row < Coordinate.BOARD_SIZE &&
      this.col >= 0 &&
      this.col < Coordinate.BOARD_SIZE
    );
  }

  public toNotation(): string {
    if (!this.isValid()) return '';
    return `${Coordinate.FILES[this.col]}${Coordinate.BOARD_SIZE - this.row}`;
  }

  public manhattanDistanceTo(other: Coordinate): number {
    return Math.abs(this.row - other.row) + Math.abs(this.col - other.col);
  }

  public equals(other: Coordinate): boolean {
    return this.row === other.row && this.col === other.col;
  }

  public static fromNotation(notation: string): Coordinate | null {
    if (!notation || typeof notation !== 'string') return null;
    const clean = notation.trim().toLowerCase();
    if (clean.length !== 2) return null;
    const col = Coordinate.FILES.indexOf(clean[0] as typeof Coordinate.FILES[number]);
    const rank = parseInt(clean[1], 10);
    if (col === -1 || isNaN(rank) || rank < 1 || rank > 9) return null;
    return new Coordinate(Coordinate.BOARD_SIZE - rank, col);
  }

  public static getOwnBase(side: Side): Coordinate {
    return side === 'RED' ? Coordinate.RED_BASE : Coordinate.BLUE_BASE;
  }

  public static getTargetBase(side: Side): Coordinate {
    return side === 'RED' ? Coordinate.BLUE_BASE : Coordinate.RED_BASE;
  }
}
