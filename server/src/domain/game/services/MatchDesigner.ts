import { CellChar, PieceType, Side } from '../types/GameTypes';
import { Board } from '../entities/Board';
import { Coordinate } from '../value-objects/Coordinate';
import { Piece } from '../value-objects/Piece';

export interface BasePosition {
  readonly r: number;
  readonly c: number;
}

export interface ObstaclePosition {
  readonly r: number;
  readonly c: number;
}

export interface MatchDesignOptions {
  /** Số hàng bàn cờ (rows). Mặc định: 9 */
  rows?: number;
  /** Số cột bàn cờ (cols). Mặc định: 9 */
  cols?: number;
  /** Vị trí căn cứ Phe Đỏ (Bắt buộc thuộc nửa dưới lãnh địa: r >= Math.ceil(rows/2)) */
  redBase?: BasePosition;
  /** Vị trí căn cứ Phe Xanh (Bắt buộc thuộc nửa trên lãnh địa: r < Math.floor(rows/2)) */
  blueBase?: BasePosition;
  /** Danh sách chướng ngại vật cố định hoặc số lượng sinh ngẫu nhiên */
  obstacles?: ObstaclePosition[] | number;
  /** Số lượng quân cờ tối đa mỗi bên. Mặc định: Math.min(rows, cols) */
  piecesPerSide?: number;
  /** Hạt giống thời gian khởi tạo ván đấu (Date.now()) */
  seed?: number;
  /** Chế độ sinh ngẫu nhiên vị trí căn cứ trong nửa lãnh địa */
  randomizeBases?: boolean;
}

export interface GeneratedMatchBoard {
  readonly grid: CellChar[][];
  readonly rows: number;
  readonly cols: number;
  readonly redBase: BasePosition;
  readonly blueBase: BasePosition;
  readonly obstacles: ReadonlyArray<ObstaclePosition>;
  readonly piecesPerSide: number;
  readonly pieceCounts: {
    readonly R: number;
    readonly P: number;
    readonly S: number;
  };
  readonly timestamp: number;
}

/**
 * THƯ VIỆN THIẾT KẾ VÁN ĐẤU (MATCH DESIGNER LIBRARY)
 * Hỗ trợ tùy biến kích thước bàn cờ, chướng ngại vật, vị trí căn cứ trong nửa lãnh địa,
 * và thuật toán sinh quân cờ ngẫu nhiên cân bằng tuyệt đối cả về số lượng và chất lượng (R = P = S).
 */
export class MatchDesigner {
  /**
   * Bộ tạo số ngẫu nhiên có hạt giống (Linear Congruential Generator)
   */
  public static createRng(seed: number): () => number {
    let s = (seed ^ 0x6d2b79f5) >>> 0;
    return () => {
      s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
      return (s >>> 0) / 4294967296;
    };
  }

  /**
   * Kiểm tra một tọa độ có nằm trong đúng 1 nửa lãnh địa của phe đó hay không:
   * - Phe Xanh (BLUE): Nửa trên (0 <= r < Math.floor(totalRows / 2))
   * - Phe Đỏ (RED): Nửa dưới (Math.ceil(totalRows / 2) <= r < totalRows)
   */
  public static isWithinTerritory(side: Side, r: number, totalRows: number): boolean {
    if (side === 'BLUE') {
      const maxRowExclusive = Math.floor(totalRows / 2);
      return r >= 0 && r < maxRowExclusive;
    } else {
      const minRowInclusive = Math.ceil(totalRows / 2);
      return r >= minRowInclusive && r < totalRows;
    }
  }

  /**
   * Tính toán phân phối số lượng từng loại quân (Đấm R, Lá P, Kéo S) sao cho đồng đều tuyệt đối
   * về cả số lượng và chất lượng giữa 2 bên.
   */
  public static calculatePieceDistribution(totalPieces: number): { R: number; P: number; S: number } {
    const base = Math.floor(totalPieces / 3);
    const rem = totalPieces % 3;
    return {
      R: base + (rem > 0 ? 1 : 0),
      P: base + (rem > 1 ? 1 : 0),
      S: base
    };
  }

  /**
   * Tạo ván đấu ngẫu nhiên với đầy đủ kích thước, căn cứ, chướng ngại vật và quân cờ cân bằng
   */
  public static generateMatch(options: MatchDesignOptions = {}): GeneratedMatchBoard {
    const rows = Math.max(5, Math.min(15, options.rows ?? 9));
    const cols = Math.max(5, Math.min(15, options.cols ?? 9));
    const timestamp = options.seed ?? Date.now();
    const rng = MatchDesigner.createRng(timestamp);

    const maxPiecesLimit = Math.min(rows, cols);
    const piecesPerSide = Math.max(
      3,
      Math.min(maxPiecesLimit, options.piecesPerSide ?? maxPiecesLimit)
    );

    const blueMaxRow = Math.floor(rows / 2);
    const redMinRow = Math.ceil(rows / 2);

    // 1. Xác định vị trí Căn cứ Phe Xanh (BLUE) - Nửa trên
    let blueBase: BasePosition;
    if (options.randomizeBases) {
      blueBase = {
        r: Math.floor(rng() * blueMaxRow),
        c: Math.floor(rng() * cols)
      };
    } else if (options.blueBase && MatchDesigner.isWithinTerritory('BLUE', options.blueBase.r, rows)) {
      blueBase = { r: options.blueBase.r, c: Math.min(cols - 1, Math.max(0, options.blueBase.c)) };
    } else {
      blueBase = { r: 0, c: cols - 1 }; // Mặc định góc trên bên phải (i9)
    }

    // 2. Xác định vị trí Căn cứ Phe Đỏ (RED) - Nửa dưới
    let redBase: BasePosition;
    if (options.randomizeBases) {
      redBase = {
        r: redMinRow + Math.floor(rng() * (rows - redMinRow)),
        c: Math.floor(rng() * cols)
      };
    } else if (options.redBase && MatchDesigner.isWithinTerritory('RED', options.redBase.r, rows)) {
      redBase = { r: options.redBase.r, c: Math.min(cols - 1, Math.max(0, options.redBase.c)) };
    } else {
      redBase = { r: rows - 1, c: 0 }; // Mặc định góc dưới bên trái (a1)
    }

    // 3. Khởi tạo lưới rỗng
    const grid: CellChar[][] = Array.from({ length: rows }, () => Array(cols).fill('.'));

    // 4. Bố trí chướng ngại vật (Obstacles - '#')
    const obstaclesList: ObstaclePosition[] = [];
    const isBase = (r: number, c: number) =>
      (r === blueBase.r && c === blueBase.c) || (r === redBase.r && c === redBase.c);

    if (Array.isArray(options.obstacles)) {
      for (const obs of options.obstacles) {
        if (obs.r >= 0 && obs.r < rows && obs.c >= 0 && obs.c < cols && !isBase(obs.r, obs.c)) {
          grid[obs.r][obs.c] = '#';
          obstaclesList.push({ r: obs.r, c: obs.c });
        }
      }
    } else {
      const obstacleCount = typeof options.obstacles === 'number' ? Math.max(0, options.obstacles) : 0;
      if (obstacleCount > 0) {
        // Sinh chướng ngại vật ưu tiên ở khu vực trung tâm/trung lập giữa 2 phe
        const midRowStart = Math.max(0, Math.floor(rows / 2) - 1);
        const midRowEnd = Math.min(rows - 1, Math.ceil(rows / 2));
        const candidateCoords: BasePosition[] = [];

        for (let r = midRowStart; r <= midRowEnd; r++) {
          for (let c = 0; c < cols; c++) {
            if (!isBase(r, c)) candidateCoords.push({ r, c });
          }
        }

        // Trộn ngẫu nhiên
        for (let i = candidateCoords.length - 1; i > 0; i--) {
          const j = Math.floor(rng() * (i + 1));
          [candidateCoords[i], candidateCoords[j]] = [candidateCoords[j], candidateCoords[i]];
        }

        const picked = candidateCoords.slice(0, Math.min(obstacleCount, candidateCoords.length));
        for (const p of picked) {
          grid[p.r][p.c] = '#';
          obstaclesList.push(p);
        }
      }
    }

    // 5. Tính toán phân bổ quân cờ đồng đều cả chất và lượng
    const pieceCounts = MatchDesigner.calculatePieceDistribution(piecesPerSide);
    const bluePiecesPool: CellChar[] = [
      ...Array(pieceCounts.R).fill('r'),
      ...Array(pieceCounts.P).fill('p'),
      ...Array(pieceCounts.S).fill('s')
    ];
    const redPiecesPool: CellChar[] = [
      ...Array(pieceCounts.R).fill('R'),
      ...Array(pieceCounts.P).fill('P'),
      ...Array(pieceCounts.S).fill('S')
    ];

    // Trộn ngẫu nhiên thứ tự quân cờ
    const shuffle = <T>(arr: T[]): T[] => {
      const a = [...arr];
      for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(rng() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
      }
      return a;
    };

    const shuffledBluePieces = shuffle(bluePiecesPool);
    const shuffledRedPieces = shuffle(redPiecesPool);

    // 6. Thu thập các ô hợp lệ để đặt quân cờ
    // Phe Xanh: các ô trong lãnh địa BLUE (hàng 0 đến blueMaxRow - 1) trừ căn cứ và chướng ngại vật
    const blueSlots: BasePosition[] = [];
    for (let r = 0; r < blueMaxRow; r++) {
      for (let c = 0; c < cols; c++) {
        if (r === blueBase.r && c === blueBase.c) continue;
        if (grid[r][c] === '#') continue;
        blueSlots.push({ r, c });
      }
    }
    const pickedBlueSlots = shuffle(blueSlots).slice(0, piecesPerSide);
    pickedBlueSlots.forEach((slot, idx) => {
      grid[slot.r][slot.c] = shuffledBluePieces[idx];
    });

    // Phe Đỏ: các ô trong lãnh địa RED (hàng redMinRow đến rows - 1) trừ căn cứ và chướng ngại vật
    const redSlots: BasePosition[] = [];
    for (let r = redMinRow; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if (r === redBase.r && c === redBase.c) continue;
        if (grid[r][c] === '#') continue;
        redSlots.push({ r, c });
      }
    }
    const pickedRedSlots = shuffle(redSlots).slice(0, piecesPerSide);
    pickedRedSlots.forEach((slot, idx) => {
      grid[slot.r][slot.c] = shuffledRedPieces[idx];
    });

    return {
      grid,
      rows,
      cols,
      redBase,
      blueBase,
      obstacles: obstaclesList,
      piecesPerSide,
      pieceCounts,
      timestamp
    };
  }

  /**
   * Tạo thực thể Board từ cấu hình thiết kế
   */
  public static createBoard(options: MatchDesignOptions = {}): Board {
    const generated = MatchDesigner.generateMatch(options);
    const redCoord = new Coordinate(generated.redBase.r, generated.redBase.c);
    const blueCoord = new Coordinate(generated.blueBase.r, generated.blueBase.c);
    return new Board(generated.grid, redCoord, blueCoord);
  }
}
