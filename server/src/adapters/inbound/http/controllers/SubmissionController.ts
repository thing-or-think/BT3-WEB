import { Request, Response } from 'express';
import { IGetLeaderboardQuery } from '../../../../application/ports/inbound/IGetLeaderboardQuery';
import { IRunTestMatchUseCase } from '../../../../application/ports/inbound/IRunTestMatchUseCase';
import { ISubmitCodeGauntletUseCase } from '../../../../application/ports/inbound/ISubmitCodeGauntletUseCase';
import { Side, SupportedLanguage } from '../../../../domain/game/types/GameTypes';
import { ExecutionQueue } from '../ExecutionQueue';

export class SubmissionController {
  private readonly queue = new ExecutionQueue();
  private validCode(language: unknown, code: unknown): boolean {
    return typeof language === 'string' && ['python', 'java', 'cpp'].includes(language) &&
      typeof code === 'string' && code.trim().length > 0 && Buffer.byteLength(code, 'utf8') <= 128 * 1024;
  }
  constructor(
    private readonly submitGauntletUseCase: ISubmitCodeGauntletUseCase,
    private readonly runTestMatchUseCase: IRunTestMatchUseCase,
    private readonly leaderboardQuery: IGetLeaderboardQuery
  ) {}

  public submitGauntlet = async (req: Request, res: Response): Promise<void> => {
    try {
      const { language, sourceCode } = req.body || {};
      if (!this.validCode(language, sourceCode)) {
        res.status(400).json({ error: 'Chọn Python, Java hoặc C++; mã nguồn phải có nội dung và tối đa 128 KB.' });
        return;
      }

      const result = await this.queue.run(() => this.submitGauntletUseCase.execute({
        username: res.locals.user.username,
        userId: res.locals.user.id,
        language: language as SupportedLanguage,
        sourceCode
      }));

      res.json(result);
    } catch (err: any) {
      res.status(500).json({ error: err?.message || 'Lỗi server khi chấm xếp hạng' });
    }
  };

  public runTestMatch = async (req: Request, res: Response): Promise<void> => {
    try {
      const { language, sourceCode, botLevel = 2, userSide = 'RED' } = req.body || {};
      if (!this.validCode(language, sourceCode) || !Number.isInteger(botLevel) ||
          botLevel < 0 || botLevel > 4 || !['RED', 'BLUE'].includes(userSide)) {
        res.status(400).json({ error: 'Mã nguồn, ngôn ngữ, cấp bot (0–4) hoặc phe không hợp lệ.' });
        return;
      }

      const result = await this.queue.run(() => this.runTestMatchUseCase.execute({
        language: language as SupportedLanguage,
        sourceCode,
        botLevel: Number(botLevel),
        userSide: (userSide === 'BLUE' ? 'BLUE' : 'RED') as Side
      }));

      res.json(result);
    } catch (err: any) {
      res.status(500).json({ error: err?.message || 'Lỗi server khi chạy trận đấu thử' });
    }
  };

  public getSubmissionById = (req: Request, res: Response): void => {
    const sub = this.leaderboardQuery.getSubmissionById(req.params.id);
    if (!sub) {
      res.status(404).json({ error: 'Không tìm thấy bài nộp' });
      return;
    }
    if (sub.userId !== res.locals.user.id && res.locals.user.role !== 'ADMIN') {
      res.status(403).json({ error: 'Bạn chỉ được mở mã nguồn và replay bài nộp của mình.' });
      return;
    }
    res.json(sub);
  };

  public getMySubmissions = (_req: Request, res: Response): void => {
    res.json(this.leaderboardQuery.getRecentSubmissions(Number.MAX_SAFE_INTEGER)
      .filter(sub => sub.userId === res.locals.user.id)
      .map(sub => ({
        id: sub.id, language: sub.language, status: sub.status,
        finalRank: sub.finalRank, createdAt: sub.createdAt
      })));
  };
}
