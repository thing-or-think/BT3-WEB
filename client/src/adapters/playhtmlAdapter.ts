import { DEFAULT_GRANDMASTER_JS_CODE } from '../domain/starterTemplates';
import { LeaderboardEntryDto } from '../domain/types';

export interface KingState {
  kingName: string;
  kingBotCode: string;
  kingElo: number;
  capturedAt: string;
  conquestCount: number;
}

export interface ArenaRules {
  maxTurns: number;
  timeoutMs: number;
  winCondition: string;
}

export interface ArenaSharedState {
  kingName: string;
  kingBotCode: string;
  kingElo: number;
  capturedAt: string;
  conquestCount: number;
  hallOfFame: LeaderboardEntryDto[];
  rules: ArenaRules;
}

export class PlayhtmlAdapter {
  private static readonly STORAGE_KEY_STATE = 'rps_arena_shared_state_v2';
  private static readonly ADMIN_DEFAULT_PIN = 'admin123';

  private arenaState: ArenaSharedState = {
    kingName: 'Bot Lv4: Đại Sư (Grandmaster AI)',
    kingBotCode: DEFAULT_GRANDMASTER_JS_CODE,
    kingElo: 1800,
    capturedAt: 'Khởi tạo đấu trường',
    conquestCount: 0,
    hallOfFame: this.getDefaultSeedHallOfFame(),
    rules: {
      maxTurns: 160,
      timeoutMs: 100,
      winCondition: 'BASE_CAPTURE'
    }
  };

  private listeners: Array<(state: ArenaSharedState) => void> = [];

  constructor() {
    this.loadPersistedLocalState();
    this.setupPlayhtmlSync();
    this.listenToUrlHash();
  }

  private getDefaultSeedHallOfFame(): LeaderboardEntryDto[] {
    return [
      {
        rank: 1,
        id: 'king_gm',
        username: 'Bot Lv4: Đại Sư (Grandmaster AI)',
        isBot: true,
        bestLanguage: 'system',
        bestScore: 2200,
        elo: 1800,
        highestBotDefeated: 4,
        winsCount: 5,
        totalMatches: 5,
        bestExecTimeMs: 14,
        stoppedBy: '👑 Đang giữ cờ tối thượng',
        updatedAt: 'Khởi tạo hệ thống'
      },
      {
        rank: 2,
        id: 'user_seed_1',
        username: 'MinhKiet_Top1',
        isBot: false,
        bestLanguage: 'python',
        bestScore: 1850,
        elo: 1650,
        highestBotDefeated: 4,
        winsCount: 4,
        totalMatches: 5,
        bestExecTimeMs: 16,
        stoppedBy: 'Bot Lv4: Đại Sư (Bậc 5)',
        updatedAt: '2026-10-20'
      },
      {
        rank: 3,
        id: 'user_seed_2',
        username: 'CaoThu_CPP',
        isBot: false,
        bestLanguage: 'cpp',
        bestScore: 1600,
        elo: 1590,
        highestBotDefeated: 3,
        winsCount: 3,
        totalMatches: 4,
        bestExecTimeMs: 9,
        stoppedBy: 'MinhKiet_Top1 (Bậc 4)',
        updatedAt: '2026-10-20'
      },
      {
        rank: 4,
        id: 'user_seed_3',
        username: 'SinhVien_TrungBinh',
        isBot: false,
        bestLanguage: 'python',
        bestScore: 1300,
        elo: 1450,
        highestBotDefeated: 3,
        winsCount: 3,
        totalMatches: 4,
        bestExecTimeMs: 18,
        stoppedBy: 'CaoThu_CPP (Bậc 4)',
        updatedAt: '2026-10-20'
      },
      {
        rank: 5,
        id: 'user_seed_4',
        username: 'HoangAnh_Pro',
        isBot: false,
        bestLanguage: 'python',
        bestScore: 920,
        elo: 1350,
        highestBotDefeated: 2,
        winsCount: 2,
        totalMatches: 3,
        bestExecTimeMs: 15,
        stoppedBy: 'SinhVien_TrungBinh (Bậc 3)',
        updatedAt: '2026-10-20'
      },
      {
        rank: 6,
        id: 'user_seed_5',
        username: 'TuanHung_Coder',
        isBot: false,
        bestLanguage: 'python',
        bestScore: 640,
        elo: 1100,
        highestBotDefeated: 1,
        winsCount: 1,
        totalMatches: 2,
        bestExecTimeMs: 22,
        stoppedBy: 'HoangAnh_Pro (Bậc 2)',
        updatedAt: '2026-10-20'
      },
      {
        rank: 7,
        id: 'user_seed_6',
        username: 'BaoNam_Newbie',
        isBot: false,
        bestLanguage: 'python',
        bestScore: 320,
        elo: 850,
        highestBotDefeated: 0,
        winsCount: 0,
        totalMatches: 1,
        bestExecTimeMs: 25,
        stoppedBy: 'Bot Lv1: Tập Sự (Bậc 1)',
        updatedAt: '2026-10-20'
      }
    ];
  }

  private loadPersistedLocalState(): void {
    try {
      const saved = localStorage.getItem(PlayhtmlAdapter.STORAGE_KEY_STATE);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.kingName) this.arenaState.kingName = parsed.kingName;
        if (parsed.kingBotCode) this.arenaState.kingBotCode = parsed.kingBotCode;
        if (parsed.kingElo) this.arenaState.kingElo = parsed.kingElo;
        if (parsed.capturedAt) this.arenaState.capturedAt = parsed.capturedAt;
        if (parsed.conquestCount !== undefined) this.arenaState.conquestCount = parsed.conquestCount;
        if (Array.isArray(parsed.hallOfFame) && parsed.hallOfFame.length > 0) {
          this.arenaState.hallOfFame = parsed.hallOfFame;
        }
        if (parsed.rules) this.arenaState.rules = { ...this.arenaState.rules, ...parsed.rules };
      }
    } catch (_) {}
  }

  private saveToLocalStorage(): void {
    try {
      localStorage.setItem(PlayhtmlAdapter.STORAGE_KEY_STATE, JSON.stringify(this.arenaState));
    } catch (_) {}
  }

  public setupPlayhtmlSync(): void {
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
            defaultData: this.arenaState,
            updateElement: (_el: HTMLElement, data: ArenaSharedState) => {
              if (data && data.kingName) {
                this.arenaState.kingName = data.kingName;
                if (data.kingBotCode) this.arenaState.kingBotCode = data.kingBotCode;
                if (data.kingElo) this.arenaState.kingElo = data.kingElo;
                if (data.capturedAt) this.arenaState.capturedAt = data.capturedAt;
                if (data.conquestCount !== undefined) this.arenaState.conquestCount = data.conquestCount;
                if (Array.isArray(data.hallOfFame) && data.hallOfFame.length > 0) {
                  this.arenaState.hallOfFame = data.hallOfFame;
                }
                if (data.rules) this.arenaState.rules = { ...this.arenaState.rules, ...data.rules };
                this.saveToLocalStorage();
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
          this.arenaState.kingName = `[Thách Đấu] ${boss}`;
          this.arenaState.kingBotCode = code;
          this.arenaState.kingElo = 1700;
          this.arenaState.capturedAt = 'Được chia sẻ qua Link URL';
          this.arenaState.conquestCount = 1;
          this.notifyListeners();
        }
      }
    };

    window.addEventListener('hashchange', parse);
    parse();
  }

  public getKingState(): KingState {
    return {
      kingName: this.arenaState.kingName,
      kingBotCode: this.arenaState.kingBotCode,
      kingElo: this.arenaState.kingElo,
      capturedAt: this.arenaState.capturedAt,
      conquestCount: this.arenaState.conquestCount
    };
  }

  public getHallOfFame(): LeaderboardEntryDto[] {
    return [...(this.arenaState.hallOfFame || [])];
  }

  public getArenaRules(): ArenaRules {
    return { ...this.arenaState.rules };
  }

  public onKingStateChange(cb: (state: ArenaSharedState) => void): void {
    this.listeners.push(cb);
    cb(this.arenaState);
  }

  private notifyListeners(): void {
    this.listeners.forEach(cb => cb(this.arenaState));
  }

  private broadcastState(): void {
    this.saveToLocalStorage();
    this.notifyListeners();

    const w = window as any;
    const cardEl = document.getElementById('flagHolderCard');
    if (w.playhtml && cardEl && (cardEl as any).play) {
      try {
        (cardEl as any).play.setData({ ...this.arenaState });
      } catch (e) {
        console.warn('playhtml setData broadcast error:', e);
      }
    }
  }

  /**
   * Cập nhật Vua Giữ Cờ mới và phát tín hiệu Realtime qua playhtml
   */
  public claimNewKing(username: string, botCode: string, oldKingName: string): void {
    const newElo = Math.min(2400, Math.max(1900, this.arenaState.kingElo + 50));
    this.arenaState.kingName = username;
    this.arenaState.kingBotCode = botCode;
    this.arenaState.kingElo = newElo;
    this.arenaState.capturedAt = new Date().toLocaleTimeString('vi-VN', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
    this.arenaState.conquestCount += 1;

    this.recordLadderResult({
      username,
      stepsConquered: 5,
      bestExecTimeMs: 12,
      stoppedBy: `Cướp cờ từ [${oldKingName}]`
    });

    this.triggerConfetti();
  }

  /**
   * Ghi nhận thành tích leo tháp của người chơi và đồng bộ toàn mạng qua playhtml
   */
  public recordLadderResult(params: {
    username: string;
    stepsConquered: number; // 0 đến 5
    bestExecTimeMs: number;
    stoppedBy: string;
  }): void {
    const tierScoreMap = [150, 450, 850, 1300, 1800, 2400];
    const tierEloMap = [800, 1050, 1300, 1550, 1800, 2100];
    const score = tierScoreMap[params.stepsConquered] ?? 150;
    const elo = tierEloMap[params.stepsConquered] ?? 800;

    const entry: LeaderboardEntryDto = {
      rank: 99,
      id: `user_${Date.now()}`,
      username: params.username,
      isBot: false,
      bestLanguage: 'javascript',
      bestScore: score,
      elo,
      highestBotDefeated: params.stepsConquered,
      winsCount: params.stepsConquered,
      totalMatches: params.stepsConquered === 5 ? 5 : params.stepsConquered + 1,
      bestExecTimeMs: params.bestExecTimeMs,
      stoppedBy: params.stepsConquered === 5 ? '👑 Đã cướp cờ thành công' : params.stoppedBy,
      updatedAt: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
    };

    const list = this.arenaState.hallOfFame || [];
    const existingIdx = list.findIndex(
      e => e.username.toLowerCase() === params.username.toLowerCase()
    );

    if (existingIdx !== -1) {
      if (entry.bestScore >= list[existingIdx].bestScore) {
        list[existingIdx] = { ...list[existingIdx], ...entry };
      }
    } else {
      list.push(entry);
    }

    list.sort((a, b) => (b.bestScore - a.bestScore) || (b.elo - a.elo));
    list.forEach((item, idx) => {
      item.rank = idx + 1;
    });

    this.arenaState.hallOfFame = list.slice(0, 30);
    this.broadcastState();
  }

  /**
   * Quyền Quản trị viên: Reset Vua cờ và Bảng xếp hạng về mặc định
   */
  public adminResetArena(adminPin: string): { success: boolean; message: string } {
    if (adminPin.trim() !== PlayhtmlAdapter.ADMIN_DEFAULT_PIN) {
      return { success: false, message: 'Sai mã PIN quản trị viên! (Mặc định: admin123)' };
    }

    this.arenaState = {
      kingName: 'Bot Lv4: Đại Sư (Grandmaster AI)',
      kingBotCode: DEFAULT_GRANDMASTER_JS_CODE,
      kingElo: 1800,
      capturedAt: 'Reset bởi Quản trị viên',
      conquestCount: 0,
      hallOfFame: this.getDefaultSeedHallOfFame(),
      rules: {
        maxTurns: 160,
        timeoutMs: 100,
        winCondition: 'BASE_CAPTURE'
      }
    };

    this.broadcastState();
    return {
      success: true,
      message: 'Đã reset toàn bộ Vua Cờ, Bảng Xếp Hạng & Luật chơi về mặc định và đồng bộ qua playhtml!'
    };
  }

  /**
   * Quyền Quản trị viên: Xóa một người chơi khỏi Bảng Vàng (chống gian lận)
   */
  public adminRemovePlayer(adminPin: string, username: string): { success: boolean; message: string } {
    if (adminPin.trim() !== PlayhtmlAdapter.ADMIN_DEFAULT_PIN) {
      return { success: false, message: 'Sai mã PIN quản trị viên! (Mặc định: admin123)' };
    }

    const clean = username.trim().toLowerCase();
    const before = (this.arenaState.hallOfFame || []).length;
    this.arenaState.hallOfFame = (this.arenaState.hallOfFame || []).filter(
      e => e.username.toLowerCase() !== clean
    );
    this.arenaState.hallOfFame.forEach((e, idx) => {
      e.rank = idx + 1;
    });

    this.broadcastState();
    return {
      success: true,
      message: `Đã xóa thành công người chơi "${username}" (${before - this.arenaState.hallOfFame.length} bản ghi) khỏi Bảng Vàng!`
    };
  }

  /**
   * Quyền Quản trị viên: Cập nhật luật chơi cho toàn bộ đấu trường
   */
  public adminUpdateRules(adminPin: string, rules: ArenaRules): { success: boolean; message: string } {
    if (adminPin.trim() !== PlayhtmlAdapter.ADMIN_DEFAULT_PIN) {
      return { success: false, message: 'Sai mã PIN quản trị viên! (Mặc định: admin123)' };
    }

    this.arenaState.rules = { ...rules };
    this.broadcastState();
    return {
      success: true,
      message: 'Đã cập nhật luật thi đấu mới và phát sóng qua playhtml!'
    };
  }

  /**
   * Xuất toàn bộ cơ sở dữ liệu Master DB dạng JSON để lưu trữ hoặc commit lên Git
   */
  public getMasterDbExport(): ArenaSharedState {
    return JSON.parse(JSON.stringify(this.arenaState));
  }

  /**
   * Bắn pháo hoa ăn mừng cướp cờ hoặc thăng hạng thành công
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
}
