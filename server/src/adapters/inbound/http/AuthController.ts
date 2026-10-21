import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { promisify } from 'util';
import { NextFunction, Request, Response, Router } from 'express';

const scrypt = promisify(crypto.scrypt);
const SESSION_MS = 7 * 24 * 60 * 60 * 1000;
interface Account {
  id: string;
  username: string;
  email: string;
  passwordHash: string;
  salt: string;
  role: 'USER' | 'ADMIN';
  createdAt: string;
  lastLogin: string;
}
interface AuthData {
  accounts: Account[];
  sessions: Array<{ digest: string; userId: string; expiresAt: number }>;
}

/** Server-owned accounts and revocable sessions. Browser-provided roles are never trusted. */
export class AuthController {
  private readonly file: string;
  private readonly attempts = new Map<string, { count: number; resetAt: number }>();

  constructor(dataDir: string, private readonly isReservedUsername: (name: string) => boolean) {
    fs.mkdirSync(dataDir, { recursive: true });
    this.file = path.join(dataDir, 'auth.json');
    if (!fs.existsSync(this.file)) this.save({ accounts: [], sessions: [] });
  }

  private read(): AuthData {
    return JSON.parse(fs.readFileSync(this.file, 'utf8')) as AuthData;
  }

  private save(data: AuthData): void {
    const temp = `${this.file}.tmp`;
    fs.writeFileSync(temp, JSON.stringify(data, null, 2), { mode: 0o600 });
    fs.renameSync(temp, this.file);
  }

  private publicAccount(account: Account) {
    const { passwordHash: _hash, salt: _salt, ...user } = account;
    return user;
  }

  private digest(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  private token(req: Request): string {
    return req.headers.authorization?.replace(/^Bearer /, '') || '';
  }

  private issueSession(data: AuthData, account: Account, res: Response): void {
    const token = crypto.randomBytes(32).toString('hex');
    account.lastLogin = new Date().toISOString();
    data.sessions = data.sessions.filter(s => s.expiresAt > Date.now());
    data.sessions.push({ digest: this.digest(token), userId: account.id, expiresAt: Date.now() + SESSION_MS });
    this.save(data);
    res.json({ success: true, user: this.publicAccount(account), token });
  }

  public requireUser = (req: Request, res: Response, next: NextFunction): void => {
    const data = this.read();
    const session = data.sessions.find(s => s.digest === this.digest(this.token(req)) && s.expiresAt > Date.now());
    const account = session && data.accounts.find(a => a.id === session.userId);
    if (!account) {
      res.status(401).json({ error: 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.' });
      return;
    }
    res.locals.user = this.publicAccount(account);
    next();
  };

  public router(): Router {
    const router = Router();
    router.use((_req, res, next) => { res.setHeader('Cache-Control', 'no-store'); next(); });
    router.get('/me', this.requireUser, (_req, res) => res.json({ user: res.locals.user }));
    router.post('/logout', (req, res) => {
      const data = this.read();
      data.sessions = data.sessions.filter(s => s.digest !== this.digest(this.token(req)));
      this.save(data);
      res.json({ success: true });
    });
    router.use((req, res, next) => {
      const now = Date.now();
      for (const [key, value] of this.attempts) if (value.resetAt <= now) this.attempts.delete(key);
      const key = req.ip || 'unknown';
      const attempt = this.attempts.get(key) || { count: 0, resetAt: now + 15 * 60 * 1000 };
      this.attempts.set(key, attempt);
      if (++attempt.count > 30) {
        res.status(429).json({ error: 'Bạn thử đăng nhập/đăng ký quá nhiều lần. Vui lòng thử lại sau 15 phút.' });
        return;
      }
      next();
    });
    router.post('/register', async (req, res, next) => {
      try {
        const { username, email, password } = req.body || {};
        if (typeof username !== 'string' || !/^[a-zA-Z0-9_]{3,20}$/.test(username) ||
            typeof email !== 'string' || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
            typeof password !== 'string' || password.length < 8 || password.length > 128) {
          res.status(400).json({ error: 'Tên: 3–20 chữ/số/gạch dưới; email hợp lệ; mật khẩu: 8–128 ký tự.' });
          return;
        }
        const salt = crypto.randomBytes(16).toString('hex');
        const hash = (await scrypt(password, salt, 64)) as Buffer;
        // Re-read after hashing to preserve simultaneous account registrations.
        const data = this.read();
        const cleanEmail = email.trim().toLowerCase();
        if (data.accounts.some(a => a.username.toLowerCase() === username.toLowerCase() || a.email === cleanEmail) ||
            this.isReservedUsername(username)) {
          res.status(409).json({ error: 'Tên tài khoản hoặc email đã được sử dụng. Tên người chơi mẫu được dành riêng.' });
          return;
        }
        const account: Account = {
          id: `usr_${crypto.randomUUID()}`, username, email: cleanEmail,
          passwordHash: hash.toString('hex'), salt, role: 'USER',
          createdAt: new Date().toISOString(), lastLogin: new Date().toISOString()
        };
        data.accounts.push(account);
        this.issueSession(data, account, res);
      } catch (error) { next(error); }
    });
    router.post('/login', async (req, res, next) => {
      try {
        const { identifier, password } = req.body || {};
        if (typeof identifier !== 'string' || typeof password !== 'string' || password.length > 128) {
          res.status(400).json({ error: 'Thông tin đăng nhập không hợp lệ.' });
          return;
        }
        const name = identifier.trim().toLowerCase();
        const account = this.read().accounts.find(a => a.username.toLowerCase() === name || a.email === name);
        const hash = (await scrypt(password, account?.salt || 'unknown-account', 64)) as Buffer;
        if (!account || !crypto.timingSafeEqual(hash, Buffer.from(account.passwordHash, 'hex'))) {
          res.status(401).json({ error: 'Tài khoản hoặc mật khẩu không đúng.' });
          return;
        }
        const data = this.read();
        this.issueSession(data, data.accounts.find(a => a.id === account.id)!, res);
      } catch (error) { next(error); }
    });
    return router;
  }
}
