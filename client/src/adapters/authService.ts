import { AuthResult, UserProfile, UserRole } from '../domain/authTypes';

export class AuthService {
  public static readonly COOKIE_SESSION = 'rps_arena_user_session';
  public static readonly COOKIE_USERNAME = 'rps_auth_username';
  public static readonly COOKIE_ROLE = 'rps_auth_role';

  private static readonly STORAGE_USERS = 'rps_arena_users_v2';
  private static readonly STORAGE_SESSION = 'rps_arena_session_v2';

  private currentUser: UserProfile | null = null;
  private listeners: Array<(user: UserProfile | null) => void> = [];

  constructor() {
    this.ensureDefaultUsers();
    this.loadSession();
    // Expose công khai cho việc kiểm tra qua F12 Console của trình duyệt
    if (typeof window !== 'undefined') {
      (window as any).authService = this;
      (window as any).cookieHelper = {
        getCookie: AuthService.getCookie,
        setCookie: AuthService.setCookie,
        deleteCookie: AuthService.deleteCookie,
        getAllCookies: AuthService.getAllCookies
      };
    }
  }

  // ============================================================================
  // CÁC HÀM TIỆN ÍCH QUẢN LÝ COOKIE (DOCUMENT.COOKIE)
  // ============================================================================

  /**
   * Thiết lập Cookie với thời hạn (ngày), đường dẫn và SameSite an toàn
   */
  public static setCookie(name: string, value: string, days = 7): void {
    if (typeof document === 'undefined') return;
    let expires = '';
    if (days > 0) {
      const date = new Date();
      date.setTime(date.getTime() + days * 24 * 60 * 60 * 1000);
      expires = '; expires=' + date.toUTCString();
    }
    const secureFlag = window.location && window.location.protocol === 'https:' ? '; Secure' : '';
    document.cookie = `${name}=${encodeURIComponent(value)}${expires}; path=/; SameSite=Lax${secureFlag}`;
  }

  /**
   * Đọc giá trị Cookie theo tên
   */
  public static getCookie(name: string): string | null {
    if (typeof document === 'undefined') return null;
    const nameEQ = name + '=';
    const parts = document.cookie.split(';');
    for (let i = 0; i < parts.length; i++) {
      let c = parts[i];
      while (c.charAt(0) === ' ') c = c.substring(1, c.length);
      if (c.indexOf(nameEQ) === 0) {
        try {
          return decodeURIComponent(c.substring(nameEQ.length, c.length));
        } catch (_) {
          return c.substring(nameEQ.length, c.length);
        }
      }
    }
    return null;
  }

  /**
   * Xóa Cookie bằng cách đặt ngày hết hạn về quá khứ (Epoch 1970)
   */
  public static deleteCookie(name: string): void {
    if (typeof document === 'undefined') return;
    const secureFlag = window.location && window.location.protocol === 'https:' ? '; Secure' : '';
    document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/; SameSite=Lax${secureFlag}`;
  }

  /**
   * Lấy toàn bộ danh sách cookies hiện tại dạng key-value
   */
  public static getAllCookies(): Record<string, string> {
    if (typeof document === 'undefined') return {};
    const result: Record<string, string> = {};
    const parts = document.cookie.split(';');
    for (const part of parts) {
      const trimmed = part.trim();
      if (!trimmed) continue;
      const eqIdx = trimmed.indexOf('=');
      if (eqIdx !== -1) {
        const key = trimmed.substring(0, eqIdx);
        const val = trimmed.substring(eqIdx + 1);
        try {
          result[key] = decodeURIComponent(val);
        } catch (_) {
          result[key] = val;
        }
      }
    }
    return result;
  }

  // ============================================================================
  // BĂM MẬT KHẨU AN TOÀN
  // ============================================================================

  /**
   * Băm mật khẩu an toàn bằng Web Crypto API (SHA-256)
   */
  public async hashPassword(password: string): Promise<string> {
    try {
      if (typeof window !== 'undefined' && window.crypto && window.crypto.subtle) {
        const msgBuffer = new TextEncoder().encode(password);
        const hashBuffer = await window.crypto.subtle.digest('SHA-256', msgBuffer);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
      }
    } catch (_) {}
    // Fallback băm đơn giản nếu môi trường không hỗ trợ crypto.subtle
    let hash = 0;
    for (let i = 0; i < password.length; i++) {
      hash = (hash << 5) - hash + password.charCodeAt(i);
      hash |= 0;
    }
    return 'fb_' + Math.abs(hash).toString(16);
  }

  // ============================================================================
  // TÀI KHOẢN MẶC ĐỊNH & KHỞI TẠO HỆ THỐNG
  // ============================================================================

  /**
   * Khởi tạo tài khoản Admin và tài khoản mẫu nếu chưa có
   */
  private async ensureDefaultUsers(): Promise<void> {
    const users = this.getAllUsers();
    let updated = false;

    // 1. Tạo tài khoản ADMIN mặc định: admin / admin123
    if (!users.some(u => u.username.toLowerCase() === 'admin')) {
      const adminHash = await this.hashPassword('admin123');
      users.push({
        id: 'usr_admin_001',
        username: 'admin',
        email: 'admin@arena.vn',
        passwordHash: adminHash,
        role: 'ADMIN',
        elo: 2000,
        createdAt: new Date().toISOString(),
        lastLogin: new Date().toISOString()
      });
      updated = true;
    }

    // 2. Tạo tài khoản USER mẫu: MinhKiet_Top1 / 123456
    if (!users.some(u => u.username.toLowerCase() === 'minhkiet_top1')) {
      const kietHash = await this.hashPassword('123456');
      users.push({
        id: 'usr_seed_002',
        username: 'MinhKiet_Top1',
        email: 'kiet@arena.vn',
        passwordHash: kietHash,
        role: 'USER',
        elo: 1650,
        createdAt: new Date().toISOString(),
        lastLogin: new Date().toISOString()
      });
      updated = true;
    }

    if (updated) {
      this.saveUsers(users);
    }
  }

  public getAllUsers(): UserProfile[] {
    try {
      const raw = localStorage.getItem(AuthService.STORAGE_USERS);
      return raw ? JSON.parse(raw) : [];
    } catch (_) {
      return [];
    }
  }

  private saveUsers(users: UserProfile[]): void {
    try {
      localStorage.setItem(AuthService.STORAGE_USERS, JSON.stringify(users));
    } catch (_) {}
  }

  // ============================================================================
  // QUẢN LÝ PHIÊN ĐĂNG NHẬP (LƯU VÀ PHỤC HỒI TỪ COOKIE)
  // ============================================================================

  /**
   * Khôi phục phiên làm việc: Ưu tiên đọc từ COOKIE trình duyệt
   */
  private loadSession(): void {
    try {
      // 1. ƯU TIÊN HÀNG ĐẦU: Đọc Cookie lưu tài khoản
      const cookieSession = AuthService.getCookie(AuthService.COOKIE_SESSION);
      if (cookieSession) {
        try {
          const parsed = JSON.parse(cookieSession);
          if (parsed && (parsed.id || parsed.username)) {
            const users = this.getAllUsers();
            const matched = users.find(
              u => u.id === parsed.id || u.username.toLowerCase() === String(parsed.username).toLowerCase()
            );
            if (matched) {
              this.currentUser = matched;
              console.log(`[AuthService] 🍪 Khôi phục tài khoản từ COOKIE: [${matched.username}] (${matched.role})`);
              return;
            }
            this.currentUser = parsed as UserProfile;
            console.log(`[AuthService] 🍪 Khôi phục tài khoản từ COOKIE payload: [${parsed.username}]`);
            return;
          }
        } catch (e) {
          console.warn('[AuthService] Lỗi parse Cookie session:', e);
        }
      }

      // 2. Fallback dự phòng: Nếu cookie rỗng nhưng localStorage còn lưu
      const raw = localStorage.getItem(AuthService.STORAGE_SESSION);
      if (raw) {
        this.currentUser = JSON.parse(raw);
        if (this.currentUser) {
          // Tự động đồng bộ sang Cookie
          this.syncSessionToCookie(this.currentUser, 7);
        }
      }
    } catch (_) {
      this.currentUser = null;
    }
  }

  /**
   * Lưu thông tin phiên tài khoản vào Cookie và LocalStorage
   */
  private saveSession(user: UserProfile | null, remember = true): void {
    this.currentUser = user;
    try {
      if (user) {
        const days = remember ? 7 : 1;
        this.syncSessionToCookie(user, days);
        localStorage.setItem(AuthService.STORAGE_SESSION, JSON.stringify(user));
        console.log(`[AuthService] 🍪 Đã lưu tài khoản [${user.username}] vào Cookie (Hạn: ${days} ngày).`);
      } else {
        // Đăng xuất: Xóa sạch Cookie phiên đăng nhập
        AuthService.deleteCookie(AuthService.COOKIE_SESSION);
        AuthService.deleteCookie(AuthService.COOKIE_USERNAME);
        AuthService.deleteCookie(AuthService.COOKIE_ROLE);
        localStorage.removeItem(AuthService.STORAGE_SESSION);
        console.log(`[AuthService] 🍪 Đã xóa Cookie phiên tài khoản khỏi trình duyệt.`);
      }
    } catch (_) {}
    this.notifyListeners();
  }

  /**
   * Đồng bộ dữ liệu người dùng vào các Cookie cụ thể
   */
  private syncSessionToCookie(user: UserProfile, days: number): void {
    const sessionPayload = {
      id: user.id,
      username: user.username,
      email: user.email,
      role: user.role,
      elo: user.elo,
      lastLogin: user.lastLogin
    };
    AuthService.setCookie(AuthService.COOKIE_SESSION, JSON.stringify(sessionPayload), days);
    AuthService.setCookie(AuthService.COOKIE_USERNAME, user.username, days);
    AuthService.setCookie(AuthService.COOKIE_ROLE, user.role, days);
  }

  public getCurrentUser(): UserProfile | null {
    return this.currentUser ? { ...this.currentUser } : null;
  }

  public isAdmin(): boolean {
    return this.currentUser?.role === 'ADMIN';
  }

  public onAuthStateChanged(cb: (user: UserProfile | null) => void): void {
    this.listeners.push(cb);
    cb(this.getCurrentUser());
  }

  private notifyListeners(): void {
    this.listeners.forEach(cb => cb(this.getCurrentUser()));
  }

  /**
   * Cập nhật điểm ELO cho người dùng hiện tại và lưu lại vào Cookie
   */
  public updateUserElo(delta: number): void {
    if (!this.currentUser) return;
    this.currentUser.elo = Math.max(100, this.currentUser.elo + delta);
    
    // Cập nhật trong danh sách tổng
    const users = this.getAllUsers();
    const idx = users.findIndex(u => u.id === this.currentUser!.id);
    if (idx !== -1) {
      users[idx].elo = this.currentUser.elo;
      this.saveUsers(users);
    }

    // Cập nhật Cookie
    this.syncSessionToCookie(this.currentUser, 7);
    this.notifyListeners();
  }

  // ============================================================================
  // ĐĂNG KÝ, ĐĂNG NHẬP, ĐĂNG XUẤT
  // ============================================================================

  /**
   * Đăng ký tài khoản người chơi mới
   */
  public async register(
    email: string,
    password: string,
    confirmPassword?: string,
    role: UserRole = 'USER',
    remember = true
  ): Promise<AuthResult> {
    const cleanEmail = (email || '').trim().toLowerCase();
    const cleanPass = password || '';

    if (!cleanEmail || !cleanEmail.includes('@') || !cleanEmail.includes('.')) {
      return { success: false, error: 'Email không hợp lệ! Vui lòng nhập đúng định dạng (VD: user@arena.vn).' };
    }
    if (cleanPass.length < 6) {
      return { success: false, error: 'Mật khẩu phải từ 6 ký tự trở lên!' };
    }
    if (confirmPassword !== undefined && confirmPassword !== cleanPass) {
      return { success: false, error: 'Mật khẩu xác nhận không trùng khớp! Vui lòng nhập lại.' };
    }

    const users = this.getAllUsers();
    if (users.some(u => u.email.toLowerCase() === cleanEmail)) {
      return { success: false, error: `Email "${cleanEmail}" đã được sử dụng! Vui lòng đăng nhập hoặc dùng email khác.` };
    }

    // Tự động sinh tên hiển thị (username) từ email
    let generatedUsername = (cleanEmail.split('@')[0] || 'Player')
      .trim()
      .replace(/[^a-zA-Z0-9_]/g, '_');
    if (generatedUsername.length < 3) {
      generatedUsername = (generatedUsername + '_user').slice(0, 20);
    }
    if (generatedUsername.length > 20) {
      generatedUsername = generatedUsername.slice(0, 20);
    }

    let finalUsername = generatedUsername;
    let counter = 1;
    while (users.some(u => u.username.toLowerCase() === finalUsername.toLowerCase())) {
      const suffix = `_${Math.floor(Math.random() * 899 + 100)}`;
      finalUsername = (generatedUsername.slice(0, 20 - suffix.length) + suffix);
      counter++;
      if (counter > 10) break;
    }

    const passwordHash = await this.hashPassword(cleanPass);
    const newUser: UserProfile = {
      id: `usr_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      username: finalUsername,
      email: cleanEmail,
      passwordHash,
      role,
      elo: role === 'ADMIN' ? 2000 : 1000,
      createdAt: new Date().toISOString(),
      lastLogin: new Date().toISOString()
    };

    users.push(newUser);
    this.saveUsers(users);
    this.saveSession(newUser, remember);

    return { success: true, user: newUser };
  }

  /**
   * Đăng nhập bằng Tên tài khoản hoặc Email, lưu phiên vào Cookie
   */
  public async login(
    identifier: string,
    password: string,
    remember = true
  ): Promise<AuthResult> {
    const cleanId = identifier.trim().toLowerCase();
    if (!cleanId || !password) {
      return { success: false, error: 'Vui lòng nhập đầy đủ tài khoản và mật khẩu!' };
    }

    const users = this.getAllUsers();
    const user = users.find(
      u => u.username.toLowerCase() === cleanId || u.email.toLowerCase() === cleanId
    );

    if (!user) {
      return { success: false, error: 'Tài khoản hoặc email không tồn tại trong hệ thống!' };
    }

    const inputHash = await this.hashPassword(password);
    if (user.passwordHash !== inputHash) {
      return { success: false, error: 'Mật khẩu không chính xác. Vui lòng thử lại!' };
    }

    user.lastLogin = new Date().toISOString();
    this.saveUsers(users);
    // Lưu tài khoản vào Cookie
    this.saveSession(user, remember);

    return { success: true, user };
  }

  /**
   * Đăng xuất khỏi hệ thống và xóa Cookie
   */
  public logout(): void {
    this.saveSession(null);
  }
}
