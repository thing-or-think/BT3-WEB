import fs from 'fs';
import path from 'path';
import { RankedLeaderboardEntryDto } from '../../../application/dto/LeaderboardEntryDto';
import { ILeaderboardRepositoryPort } from '../../../application/ports/outbound/ILeaderboardRepositoryPort';
import { ISubmissionRepositoryPort } from '../../../application/ports/outbound/ISubmissionRepositoryPort';
import { Submission } from '../../../domain/evaluation/entities/Submission';
import { SEED_PLAYERS_CODE } from '../../../domain/game/services/StarterTemplates';
import { Competitor } from '../../../domain/ranking/entities/Competitor';

interface DbSchema {
  version?: number;
  users: Competitor[];
  submissions: Submission[];
}

export class JsonLeaderboardRepository
  implements ILeaderboardRepositoryPort, ISubmissionRepositoryPort
{
  private readonly dataDir: string;
  private readonly dbFile: string;
  private readonly botsDir: string;
  private readonly competitorsDir: string;
  private readonly submissionsDir: string;
  private readonly indexFile: string;

  constructor(customDataDir?: string) {
    this.dataDir = customDataDir || path.join(process.cwd(), 'data');
    this.dbFile = path.join(this.dataDir, 'arena_db.json');
    this.botsDir = path.join(this.dataDir, 'bots');
    this.competitorsDir = path.join(this.dataDir, 'competitors');
    this.submissionsDir = path.join(this.dataDir, 'submissions');
    this.indexFile = path.join(this.dataDir, 'index.json');
    this.ensureSeedData();
  }

  private ensureSeedData(): void {
    [this.dataDir, this.botsDir, this.competitorsDir, this.submissionsDir].forEach(dir => {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    });

    let needSeed = !fs.existsSync(this.dbFile);
    if (!needSeed) {
      try {
        const current = JSON.parse(fs.readFileSync(this.dbFile, 'utf8')) as DbSchema;
        if (current.version !== 2 || !current.users || !current.users[0]?.sourceCode) {
          needSeed = true;
        }
      } catch (_) {
        needSeed = true;
      }
    }

    if (needSeed) {
      const seed: DbSchema = {
        version: 2,
        users: [
          new Competitor(
            'user_seed_1',
            'MinhKiet_Top1',
            false,
            'python',
            1200,
            1650,
            4,
            3,
            3,
            38,
            3,
            new Date(Date.now() - 3600 * 1000 * 5).toISOString(),
            SEED_PLAYERS_CODE.rank1_champion_py,
            null
          ),
          new Competitor(
            'user_seed_2',
            'HoangAnh_Pro',
            false,
            'python',
            920,
            1420,
            3,
            2,
            3,
            52,
            2,
            new Date(Date.now() - 3600 * 1000 * 4).toISOString(),
            SEED_PLAYERS_CODE.rank2_defender_py,
            'MinhKiet_Top1'
          ),
          new Competitor(
            'user_seed_3',
            'TuanHung_Coder',
            false,
            'python',
            640,
            1210,
            2,
            1,
            2,
            68,
            1,
            new Date(Date.now() - 3600 * 1000 * 2).toISOString(),
            SEED_PLAYERS_CODE.rank3_rusher_py,
            'HoangAnh_Pro'
          ),
          new Competitor(
            'user_seed_4',
            'BaoNam_Newbie',
            false,
            'python',
            320,
            980,
            1,
            0,
            1,
            84,
            1,
            new Date(Date.now() - 3600 * 1000 * 1).toISOString(),
            SEED_PLAYERS_CODE.rank4_passive_py,
            'TuanHung_Coder'
          )
        ],
        submissions: []
      };
      this.writeDb(seed);
    }
  }

  private readDb(): DbSchema {
    this.ensureSeedData();
    try {
      return JSON.parse(fs.readFileSync(this.dbFile, 'utf8')) as DbSchema;
    } catch (_) {
      return { version: 2, users: [], submissions: [] };
    }
  }

  /**
   * Lưu trữ phân tán: vừa cập nhật arena_db.json nguyên khối,
   * vừa tách thành index.json + bots/<name> + competitors/<id>.json + submissions/<id>.json
   */
  private writeDb(data: DbSchema): void {
    data.version = 2;
    fs.writeFileSync(this.dbFile, JSON.stringify(data, null, 2), 'utf8');

    const extMap: Record<string, string> = {
      python: 'py',
      cpp: 'cpp',
      java: 'java',
      javascript: 'js',
      system: 'py'
    };

    // 1. Lưu index.json tóm tắt & các file con
    const indexEntries = data.users.map((u, idx) => {
      const ext = extMap[u.bestLanguage] || 'py';
      const cleanName = u.username.replace(/[^a-zA-Z0-9_-]/g, '_');
      const botFileName = `${cleanName}.${ext}`;

      // Lưu file bot riêng biệt
      if (u.sourceCode) {
        fs.writeFileSync(path.join(this.botsDir, botFileName), u.sourceCode, 'utf8');
      }

      // Lưu file hồ sơ competitor riêng biệt
      const compData: any = { ...u };
      delete compData.sourceCode;
      compData.botFile = `bots/${botFileName}`;
      fs.writeFileSync(
        path.join(this.competitorsDir, `${u.id}.json`),
        JSON.stringify(compData, null, 2),
        'utf8'
      );

      return {
        rank: idx + 1,
        id: u.id,
        username: u.username,
        bestLanguage: u.bestLanguage,
        bestScore: u.bestScore,
        elo: u.elo,
        winsCount: u.winsCount,
        stoppedBy: u.stoppedBy,
        updatedAt: u.updatedAt,
        botFile: `bots/${botFileName}`,
        profileFile: `competitors/${u.id}.json`
      };
    });

    fs.writeFileSync(this.indexFile, JSON.stringify(indexEntries, null, 2), 'utf8');

    // 2. Lưu từng submission riêng biệt
    if (data.submissions && data.submissions.length > 0) {
      data.submissions.forEach(s => {
        fs.writeFileSync(
          path.join(this.submissionsDir, `${s.id}.json`),
          JSON.stringify(s, null, 2),
          'utf8'
        );
      });
    }

    // 3. Tự động đồng bộ sang client/data nếu thư mục client tồn tại
    const clientDataDir = path.join(process.cwd(), 'client', 'data');
    if (fs.existsSync(clientDataDir)) {
      try {
        fs.writeFileSync(
          path.join(clientDataDir, 'index.json'),
          JSON.stringify(indexEntries, null, 2),
          'utf8'
        );
      } catch (_) {}
    }
  }

  public getOrderedCompetitors(): Competitor[] {
    const db = this.readDb();
    return db.users.map(
      u =>
        new Competitor(
          u.id,
          u.username,
          false,
          u.bestLanguage,
          u.bestScore,
          u.elo,
          u.highestBotDefeated,
          u.winsCount,
          u.totalMatches || 1,
          u.bestExecTimeMs || 100,
          u.submissionsCount || 1,
          u.updatedAt,
          u.sourceCode || SEED_PLAYERS_CODE.rank3_rusher_py,
          u.stoppedBy || null
        )
    );
  }

  public saveOrderedCompetitors(competitors: Competitor[]): void {
    const db = this.readDb();
    db.users = competitors;
    this.writeDb(db);
  }

  public findCompetitorByUsername(username: string): Competitor | null {
    const list = this.getOrderedCompetitors();
    return list.find(u => u.username.toLowerCase() === username.trim().toLowerCase()) || null;
  }

  public upsertCompetitor(competitor: Competitor): void {
    const db = this.readDb();
    const idx = db.users.findIndex(
      u => u.username.toLowerCase() === competitor.username.toLowerCase()
    );
    if (idx >= 0) {
      db.users[idx] = competitor;
    } else {
      db.users.push(competitor);
    }
    this.writeDb(db);
  }

  public getRankedLeaderboard(): RankedLeaderboardEntryDto[] {
    const ordered = this.getOrderedCompetitors();
    return ordered.map((u, idx) => ({
      rank: idx + 1,
      id: u.id,
      username: u.username,
      isBot: false,
      bestLanguage: u.bestLanguage,
      bestScore: u.bestScore,
      elo: u.elo,
      highestBotDefeated: u.highestBotDefeated,
      winsCount: u.winsCount,
      totalMatches: u.totalMatches,
      bestExecTimeMs: u.bestExecTimeMs,
      stoppedBy: u.stoppedBy,
      updatedAt: u.updatedAt
    }));
  }

  public saveSubmission(submission: Submission): void {
    const db = this.readDb();
    db.submissions.unshift(submission);
    if (db.submissions.length > 40) {
      db.submissions = db.submissions.slice(0, 40);
    }
    this.writeDb(db);
  }

  public findById(id: string): Submission | null {
    const db = this.readDb();
    return db.submissions.find(s => s.id === id) || null;
  }

  public findRecent(limit = 15): Submission[] {
    const db = this.readDb();
    return db.submissions.slice(0, limit);
  }
}
