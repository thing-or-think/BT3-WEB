import { AuthResult, UserProfile } from '../domain/authTypes';
import { apiRequest, setSessionToken } from './httpClient';

export class AuthService {
  private currentUser: UserProfile | null = null;
  private listeners: Array<(user: UserProfile | null) => void> = [];

  constructor() {
    window.addEventListener('arena-session-expired', () => this.update(null));
  }
  private update(user: UserProfile | null): void {
    this.currentUser = user;
    this.listeners.forEach(cb => cb(this.getCurrentUser()));
  }
  public async restoreSession(): Promise<void> {
    const result = await apiRequest<{ user: UserProfile }>('/auth/me');
    this.update(result.user);
  }
  public getCurrentUser(): UserProfile | null {
    return this.currentUser ? { ...this.currentUser } : null;
  }
  public onAuthStateChanged(cb: (user: UserProfile | null) => void): void {
    this.listeners.push(cb);
    cb(this.getCurrentUser());
  }
  private async authenticate(route: string, body: unknown): Promise<AuthResult> {
    try {
      const result = await apiRequest<AuthResult & { token: string }>(route, body);
      setSessionToken(result.token);
      this.update(result.user || null);
      return result;
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  }
  public register(username: string, email: string, password: string): Promise<AuthResult> {
    return this.authenticate('/auth/register', { username, email, password });
  }
  public login(identifier: string, password: string): Promise<AuthResult> {
    return this.authenticate('/auth/login', { identifier, password });
  }
  public async logout(): Promise<void> {
    await apiRequest('/auth/logout', {});
    setSessionToken(null);
    this.update(null);
  }
}
