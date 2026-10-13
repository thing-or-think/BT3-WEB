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

  constructor(customDataDir?: string) {
    this.dataDir = customDataDir || path.join(process.cwd(), 'data');
    this.dbFile = path.join(this.dataDir, 'arena_db.json');
    this.ensureSeedData();
  }

  private ensureSeedData(): void {
    if (!fs.existsSync(this.dataDir)) {
      fs.mkdirSync(this.dataDir, { recursive: true });
    }

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
      // Danh sách BXH Người chơi từ Hạng #1 (trên cùng) xuống Hạng #4 (dưới cùng)
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
      fs.writeFileSync(this.dbFile, JSON.stringify(seed, null, 2), 'utf8');
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

  private writeDb(data: DbSchema): void {
    this.ensureSeedData();
    data.version = 2;
    fs.writeFileSync(this.dbFile, JSON.stringify(data, null, 2), 'utf8');
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

  /**
   * Trả về Bảng xếp hạng người chơi theo đúng vị trí từ trên xuống dưới (Rank #1 -> #N)
   */
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
