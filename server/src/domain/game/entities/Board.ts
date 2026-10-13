import { CellChar, Side } from '../types/GameTypes';
import { Coordinate } from '../value-objects/Coordinate';
import { Move } from '../value-objects/Move';
import { Piece } from '../value-objects/Piece';

export interface MoveValidationResult {
  readonly valid: boolean;
  readonly move?: Move;
  readonly reason?: string;
}

export class Board {
  public static readonly SIZE = 9;
  public static readonly MAX_TURNS = 160;
  public static readonly DIRS: ReadonlyArray<readonly [number, number]> = [
    [-1, 0],
    [1, 0],
    [0, -1],
    [0, 1]
  ];

  private readonly grid: CellChar[][];

  constructor(grid?: CellChar[][]) {
    this.grid = grid ? grid.map(row => [...row]) : Board.createInitialGrid();
  }

  public static createInitialGrid(): CellChar[][] {
    return [
      ['.', 'r', '.', 'p', '.', 's', '.', 'r', '.'],
      ['p', '.', 's', '.', 'r', '.', 'p', '.', 's'],
      ['.', '.', '.', '.', '.', '.', '.', '.', '.'],
      ['.', '.', '.', '.', '.', '.', '.', '.', '.'],
      ['.', '.', '.', '.', '.', '.', '.', '.', '.'],
      ['.', '.', '.', '.', '.', '.', '.', '.', '.'],
      ['.', '.', '.', '.', '.', '.', '.', '.', '.'],
      ['S', '.', 'P', '.', 'R', '.', 'S', '.', 'P'],
      ['.', 'R', '.', 'S', '.', 'P', '.', 'R', '.']
    ];
  }

  public getGrid(): CellChar[][] {
    return this.grid.map(row => [...row]);
  }

  public getCell(row: number, col: number): CellChar {
    return this.grid[row][col];
  }

  public clone(): Board {
    return new Board(this.grid);
  }

  public static isOwnBase(side: Side, row: number, col: number): boolean {
    const base = Coordinate.getOwnBase(side);
    return base.row === row && base.col === col;
  }

  public static isEnemyBase(side: Side, row: number, col: number): boolean {
    const target = Coordinate.getTargetBase(side);
    return target.row === row && target.col === col;
  }

  public getLegalMoves(side: Side): Move[] {
    const moves: Move[] = [];
    for (let r = 0; r < Board.SIZE; r++) {
      for (let c = 0; c < Board.SIZE; c++) {
        const ch = this.grid[r][c];
        if (Piece.getSide(ch) !== side) continue;

        for (const [dr, dc] of Board.DIRS) {
          const nr = r + dr;
          const nc = c + dc;
          if (nr < 0 || nr >= Board.SIZE || nc < 0 || nc >= Board.SIZE) continue;
          if (Board.isOwnBase(side, nr, nc)) continue;

          const target = this.grid[nr][nc];
          if (target === '.' || Piece.canCaptureChar(ch, target)) {
            moves.push(
              new Move(
                new Coordinate(r, c),
                new Coordinate(nr, nc),
                ch,
                target === '.' ? null : target
              )
            );
          }
        }
      }
    }
    return moves;
  }

  public validateMoveOutput(side: Side, rawOutput: string): MoveValidationResult {
    if (!rawOutput || typeof rawOutput !== 'string') {
      return { valid: false, reason: 'Không có output nước đi (Empty stdout)' };
    }
    const lines = rawOutput
      .trim()
      .split(/\r?\n/)
      .map(l => l.trim())
      .filter(Boolean);

    if (lines.length === 0) {
      return { valid: false, reason: 'Output rỗng' };
    }

    const tokens = lines[0].split(/\s+/);
    if (tokens.length < 2) {
      return {
        valid: false,
        reason: `Định dạng nước đi không hợp lệ: "${lines[0]}". Cần định dạng "<từ> <đến>", VD: "e2 e3"`
      };
    }

    const fromCoord = Coordinate.fromNotation(tokens[0]);
    const toCoord = Coordinate.fromNotation(tokens[1]);
    if (!fromCoord || !toCoord) {
      return { valid: false, reason: `Tọa độ ngoài bàn cờ 9x9: "${tokens[0]} ${tokens[1]}"` };
    }

    const piece = this.grid[fromCoord.row][fromCoord.col];
    if (Piece.getSide(piece) !== side) {
      return {
        valid: false,
        reason: `Ô xuất phát ${tokens[0]} (${piece}) không chứa quân của phe ${side}`
      };
    }

    const dist = fromCoord.manhattanDistanceTo(toCoord);
    if (dist !== 1) {
      return {
        valid: false,
        reason: `Quân chỉ được đi 1 ô theo 4 hướng. Nước đi ${tokens[0]} -> ${tokens[1]} có khoảng cách = ${dist}`
      };
    }

    if (Board.isOwnBase(side, toCoord.row, toCoord.col)) {
      return { valid: false, reason: `Không được đi vào ô căn cứ của chính mình (${tokens[1]})` };
    }

    const target = this.grid[toCoord.row][toCoord.col];
    if (target !== '.' && !Piece.canCaptureChar(piece, target)) {
      return {
        valid: false,
        reason: `Quân ${piece} tại ${tokens[0]} không thể ăn quân ${target} tại ${tokens[1]} (Quy tắc: Đấm > Kéo > Lá > Đấm)`
      };
    }

    return {
      valid: true,
      move: new Move(fromCoord, toCoord, piece, target === '.' ? null : target)
    };
  }

  public applyMove(move: Move): Board {
    const nextGrid = this.getGrid();
    nextGrid[move.toR][move.toC] = nextGrid[move.fromR][move.fromC];
    nextGrid[move.fromR][move.fromC] = '.';
    return new Board(nextGrid);
  }

  /**
   * Phân định thắng thua khi chạm giới hạn lượt (Tie-breaker cho đấu Leo Tháp):
   * 1. Nhiều quân hơn -> Thắng
   * 2. Quân gần căn cứ đối phương nhất -> Thắng
   * 3. Nếu bằng nhau -> Defender (BLUE) bảo vệ hạng thành công
   */
  public resolveTieBreakWinner(): Side {
    let redPieces = 0;
    let bluePieces = 0;
    let redMinDist = 99;
    let blueMinDist = 99;

    for (let r = 0; r < Board.SIZE; r++) {
      for (let c = 0; c < Board.SIZE; c++) {
        const ch = this.grid[r][c];
        const side = Piece.getSide(ch);
        if (side === 'RED') {
          redPieces++;
          const d = Math.abs(r - Coordinate.BLUE_BASE.row) + Math.abs(c - Coordinate.BLUE_BASE.col);
          if (d < redMinDist) redMinDist = d;
        } else if (side === 'BLUE') {
          bluePieces++;
          const d = Math.abs(r - Coordinate.RED_BASE.row) + Math.abs(c - Coordinate.RED_BASE.col);
          if (d < blueMinDist) blueMinDist = d;
        }
      }
    }

    if (redPieces !== bluePieces) {
      return redPieces > bluePieces ? 'RED' : 'BLUE';
    }
    if (redMinDist !== blueMinDist) {
      return redMinDist < blueMinDist ? 'RED' : 'BLUE';
    }
    return 'BLUE'; // Defender giữ hạng nếu ngang nhau hoàn toàn
  }

  public formatStdin(side: Side, turn: number, timeLimitMs = 1000): string {
    const header = `${side} ${turn} ${timeLimitMs}`;
    const rows = this.grid.map(row => row.join(' '));
    return [header, ...rows].join('\n') + '\n';
  }
}
