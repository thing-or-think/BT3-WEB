import { DEFAULT_GRANDMASTER_JS_CODE } from '../domain/starterTemplates';
import { LeaderboardEntryDto } from '../domain/types';

export interface KingState {
  kingName: string;
  kingBotCode: string;
  kingElo: number;
  capturedAt: string;
  conquestCount: number;
}

export class PlayhtmlAdapter {
  private static readonly STORAGE_KEY_KING = 'rps_arena_king_state_v1';
  private static readonly STORAGE_KEY_HOF = 'rps_arena_hall_of_fame_v1';

  private kingState: KingState = {
    kingName: 'Bot Lv4: Đại Sư (Grandmaster AI)',
    kingBotCode: DEFAULT_GRANDMASTER_JS_CODE,
    kingElo: 1800,
    capturedAt: 'Khởi tạo đấu trường',
    conquestCount: 0
  };

  private listeners: Array<(state: KingState) => void> = [];

  constructor() {
    this.loadPersistedLocalState();
    this.setupPlayhtmlSync();
    this.listenToUrlHash();
  }

  private loadPersistedLocalState(): void {
    try {
      const saved = localStorage.getItem(PlayhtmlAdapter.STORAGE_KEY_KING);
      if (saved) {
        this.kingState = JSON.parse(saved);
      }
    } catch (_) {}
  }

  private setupPlayhtmlSync(): void {
    // Nếu playhtml đã được nhúng qua unpkg / window
    const w = window as any;
    if (w.playhtml) {
      try {
        w.playhtml.init({
          room: 'rps-chess-arena-ctf',
          cursors: true
        });

        const cardEl = document.getElementById('flagHolderCard');
        if (cardEl && w.playhtml.setupPlayElement) {
          w.playhtml.setupPlayElement(cardEl, {
            defaultData: this.kingState,
            updateElement: (_el: HTMLElement, data: KingState) => {
              if (data && data.kingName) {
                this.kingState = data;
                this.notifyListeners();
              }
            }
          });
        }
      } catch (e) {
        console.warn('playhtml init fallback:', e);
      }
    }
  }

  private listenToUrlHash(): void {
    const parse = () => {
      const hash = window.location.hash.slice(1);
      if (!hash) return;
      const params = new URLSearchParams(hash);
      const boss = params.get('boss');
      const encodedCode = params.get('code');

      if (boss && encodedCode) {
        let code = '';
        const w = window as any;
        if (w.LZString) {
          code = w.LZString.decompressFromEncodedURIComponent(encodedCode) || '';
        } else {
          try {
            code = decodeURIComponent(atob(encodedCode));
          } catch (_) {}
        }

        if (code) {
          this.kingState = {
            kingName: `[Thách Đấu] ${boss}`,
            kingBotCode: code,
            kingElo: 1650,
            capturedAt: 'Được chia sẻ qua Link URL',
            conquestCount: 1
          };
          this.notifyListeners();
        }
      }
    };

    window.addEventListener('hashchange', parse);
    parse();
  }

  public getKingState(): KingState {
    return { ...this.kingState };
  }

  public onKingStateChange(cb: (state: KingState) => void): void {
    this.listeners.push(cb);
    cb(this.getKingState());
  }

  private notifyListeners(): void {
    this.listeners.forEach(cb => cb(this.getKingState()));
  }

  /**
   * Cập nhật Vua Giữ Cờ mới và phát tín hiệu Realtime qua playhtml
   */
  public claimNewKing(username: string, botCode: string, oldKingName: string): void {
    const newElo = Math.min(2200, this.kingState.kingElo + 60);
    this.kingState = {
      kingName: username,
      kingBotCode: botCode,
      kingElo: newElo,
      capturedAt: new Date().toLocaleTimeString('vi-VN', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
      }),
      conquestCount: this.kingState.conquestCount + 1
    };

    // Lưu cục bộ
    try {
      localStorage.setItem(PlayhtmlAdapter.STORAGE_KEY_KING, JSON.stringify(this.kingState));
    } catch (_) {}

    // Cập nhật playhtml
    const w = window as any;
    const cardEl = document.getElementById('flagHolderCard');
    if (w.playhtml && cardEl && (cardEl as any).play) {
      try {
        (cardEl as any).play.setData(this.kingState);
      } catch (_) {}
    }

    // Lưu vào Hall of Fame
    this.addHallOfFameEntry({
      rank: 1,
      id: `user_${Date.now()}`,
      username,
      isBot: false,
      bestLanguage: 'javascript',
      bestScore: 1200 + this.kingState.conquestCount * 150,
      elo: newElo,
      highestBotDefeated: 4,
      winsCount: this.kingState.conquestCount,
      totalMatches: this.kingState.conquestCount,
      bestExecTimeMs: 12,
      stoppedBy: `Cướp cờ từ [${oldKingName}]`,
      updatedAt: this.kingState.capturedAt
    });

    this.notifyListeners();
    this.triggerConfetti();
  }

  /**
   * Bắn pháo hoa ăn mừng cướp cờ thành công
   */
  public triggerConfetti(): void {
    const w = window as any;
    if (typeof w.confetti === 'function') {
      w.confetti({
        particleCount: 120,
        spread: 80,
        origin: { y: 0.6 }
      });
      setTimeout(() => {
        w.confetti({ particleCount: 80, angle: 60, spread: 55, origin: { x: 0 } });
        w.confetti({ particleCount: 80, angle: 120, spread: 55, origin: { x: 1 } });
      }, 250);
    }
  }

  /**
   * Tạo link chia sẻ bot để bạn bè cướp cờ
   */
  public generateShareableUrl(username: string, botCode: string): string {
    const w = window as any;
    let encoded = '';
    if (w.LZString) {
      encoded = w.LZString.compressToEncodedURIComponent(botCode);
    } else {
      encoded = btoa(encodeURIComponent(botCode));
    }
    const cleanUser = encodeURIComponent(username);
    const base = window.location.origin + window.location.pathname;
    return `${base}#boss=${cleanUser}&code=${encoded}`;
  }

  /**
   * Lấy Bảng Vàng (Hall of Fame)
   */
  public getHallOfFame(): LeaderboardEntryDto[] {
    try {
      const raw = localStorage.getItem(PlayhtmlAdapter.STORAGE_KEY_HOF);
      if (raw) return JSON.parse(raw);
    } catch (_) {}

    // Bảng khởi tạo mặc định
    return [
      {
        rank: 1,
        id: 'king_1',
        username: this.kingState.kingName,
        isBot: false,
        bestLanguage: 'javascript',
        bestScore: 1500,
        elo: this.kingState.kingElo,
        highestBotDefeated: 4,
        winsCount: 3,
        totalMatches: 3,
        bestExecTimeMs: 15,
        stoppedBy: '👑 Đang giữ cờ tối thượng',
        updatedAt: this.kingState.capturedAt
      },
      {
        rank: 2,
        id: 'bot_gm',
        username: 'Bot Lv4: Đại Sư (Grandmaster AI)',
        isBot: true,
        bestLanguage: 'system',
        bestScore: 1200,
        elo: 1800,
        highestBotDefeated: 4,
        winsCount: 2,
        totalMatches: 2,
        bestExecTimeMs: 25,
        stoppedBy: 'Mốc Boss Cao Cấp',
        updatedAt: 'Hệ thống'
      },
      {
        rank: 3,
        id: 'bot_tactician',
        username: 'Bot Lv3: Chiến Thuật (Tactician AI)',
        isBot: true,
        bestLanguage: 'system',
        bestScore: 900,
        elo: 1450,
        highestBotDefeated: 3,
        winsCount: 1,
        totalMatches: 1,
        bestExecTimeMs: 18,
        stoppedBy: 'Mốc Boss Trung Cấp',
        updatedAt: 'Hệ thống'
      },
      {
        rank: 4,
        id: 'bot_scout',
        username: 'Bot Lv2: Trinh Sát (Scout AI)',
        isBot: true,
        bestLanguage: 'system',
        bestScore: 600,
        elo: 1100,
        highestBotDefeated: 2,
        winsCount: 1,
        totalMatches: 1,
        bestExecTimeMs: 8,
        stoppedBy: 'Mốc Boss Cơ Bản',
        updatedAt: 'Hệ thống'
      }
    ];
  }

  private addHallOfFameEntry(entry: LeaderboardEntryDto): void {
    const list = this.getHallOfFame();
    const existingIdx = list.findIndex(
      e => e.username.toLowerCase() === entry.username.toLowerCase()
    );
    if (existingIdx !== -1) {
      list.splice(existingIdx, 1);
    }
    list.unshift(entry);
    list.forEach((e, idx) => {
      e.rank = idx + 1;
    });

    try {
      localStorage.setItem(
        PlayhtmlAdapter.STORAGE_KEY_HOF,
        JSON.stringify(list.slice(0, 15))
      );
    } catch (_) {}
  }
}
