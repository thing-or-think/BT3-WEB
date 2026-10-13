import { CellChar } from '../types/GameTypes';
import { Coordinate } from './Coordinate';

export class Move {
  constructor(
    public readonly fromCoord: Coordinate,
    public readonly toCoord: Coordinate,
    public readonly piece: CellChar,
    public readonly captured: CellChar | null = null
  ) {}

  public get from(): string {
    return this.fromCoord.toNotation();
  }

  public get to(): string {
    return this.toCoord.toNotation();
  }

  public get fromR(): number {
    return this.fromCoord.row;
  }

  public get fromC(): number {
    return this.fromCoord.col;
  }

  public get toR(): number {
    return this.toCoord.row;
  }

  public get toC(): number {
    return this.toCoord.col;
  }
}
