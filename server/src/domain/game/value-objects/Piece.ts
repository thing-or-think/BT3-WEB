import { CellChar, PieceType, Side } from '../types/GameTypes';

export class Piece {
  constructor(
    public readonly side: Side,
    public readonly type: PieceType
  ) {}

  public toChar(): CellChar {
    if (this.side === 'RED') return this.type as CellChar;
    return this.type.toLowerCase() as CellChar;
  }

  /**
   * Quy tắc cốt lõi: Đấm (R) > Kéo (S) > Lá (P) > Đấm (R)
   */
  public canCapture(target: Piece): boolean {
    if (this.side === target.side) return false;
    return (
      (this.type === 'R' && target.type === 'S') ||
      (this.type === 'S' && target.type === 'P') ||
      (this.type === 'P' && target.type === 'R')
    );
  }

  public static fromChar(ch: string): Piece | null {
    if (!ch || ch === '.') return null;
    if (ch === 'R' || ch === 'P' || ch === 'S') {
      return new Piece('RED', ch);
    }
    if (ch === 'r' || ch === 'p' || ch === 's') {
      return new Piece('BLUE', ch.toUpperCase() as PieceType);
    }
    return null;
  }

  public static getSide(ch: string): Side | null {
    const p = Piece.fromChar(ch);
    return p ? p.side : null;
  }

  public static canCaptureChar(attackerChar: string, defenderChar: string): boolean {
    const attacker = Piece.fromChar(attackerChar);
    const defender = Piece.fromChar(defenderChar);
    if (!attacker || !defender) return false;
    return attacker.canCapture(defender);
  }
}
