import { AuthResult, UserProfile, UserRole } from '../domain/authTypes';

export class AuthService {
  private static readonly STORAGE_USERS = 'rps_arena_users_v2';
  private static readonly STORAGE_SESSION = 'rps_arena_session_v2';

  private currentUser: UserProfile | null = null;
  private listeners: Array<(user: UserProfile | null) => void> = [];

  constructor() {
    this.ensureDefaultUsers();
    this.loadSession();
  }

  /**
   * Băm mật khẩu an toàn bằng Web Crypto API (SHA-256)
   */
  public async hashPassword(password: string): Promise<string> {
    try {
      if (window.crypto && window.crypto.subtle) {
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

  private getAllUsers(): UserProfile[] {
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

  private loadSession(): void {
    try {
      const raw = localStorage.getItem(AuthService.STORAGE_SESSION);
      if (raw) {
        this.currentUser = JSON.parse(raw);
      }
    } catch (_) {
      this.currentUser = null;
    }
  }

  private saveSession(user: UserProfile | null): void {
    this.currentUser = user;
    try {
      if (user) {
        localStorage.setItem(AuthService.STORAGE_SESSION, JSON.stringify(user));
      } else {
        localStorage.removeItem(AuthService.STORAGE_SESSION);
      }
    } catch (_) {}
    this.notifyListeners();
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
   * Đăng ký tài khoản người chơi mới
   */
  public async register(
    username: string,
    email: string,
    password: string,
    role: UserRole = 'USER'
  ): Promise<AuthResult> {
    const cleanUser = username.trim();
    const cleanEmail = email.trim().toLowerCase();

    if (cleanUser.length < 3 || cleanUser.length > 20) {
      return { success: false, error: 'Tên tài khoản phải từ 3 đến 20 ký tự!' };
    }
    if (!/^[a-zA-Z0-9_]+$/.test(cleanUser)) {
      return { success: false, error: 'Tên tài khoản chỉ được chứa chữ cái, số và dấu gạch dưới (_)' };
    }
    if (!cleanEmail.includes('@') || !cleanEmail.includes('.')) {
      return { success: false, error: 'Email không hợp lệ!' };
    }
    if (password.length < 6) {
      return { success: false, error: 'Mật khẩu phải từ 6 ký tự trở lên!' };
    }

    const users = this.getAllUsers();
    if (users.some(u => u.username.toLowerCase() === cleanUser.toLowerCase())) {
      return { success: false, error: `Tài khoản "${cleanUser}" đã tồn tại!` };
    }
    if (users.some(u => u.email.toLowerCase() === cleanEmail)) {
      return { success: false, error: `Email "${cleanEmail}" đã được sử dụng!` };
    }

    const passwordHash = await this.hashPassword(password);
    const newUser: UserProfile = {
      id: `usr_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      username: cleanUser,
      email: cleanEmail,
      passwordHash,
      role,
      elo: 1000,
      createdAt: new Date().toISOString(),
      lastLogin: new Date().toISOString()
    };

    users.push(newUser);
    this.saveUsers(users);
    this.saveSession(newUser);

    return { success: true, user: newUser };
  }

  /**
   * Đăng nhập bằng Tên tài khoản hoặc Email
   */
  public async login(identifier: string, password: string): Promise<AuthResult> {
    const cleanId = identifier.trim().toLowerCase();
    if (!cleanId || !password) {
      return { success: false, error: 'Vui lòng nhập tài khoản và mật khẩu!' };
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
    this.saveSession(user);

    return { success: true, user };
  }

  /**
   * Đăng xuất khỏi hệ thống
   */
  public logout(): void {
    this.saveSession(null);
  }
}
