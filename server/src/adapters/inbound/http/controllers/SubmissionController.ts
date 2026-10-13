import { Request, Response } from 'express';
import { IGetLeaderboardQuery } from '../../../../application/ports/inbound/IGetLeaderboardQuery';
import { IRunTestMatchUseCase } from '../../../../application/ports/inbound/IRunTestMatchUseCase';
import { ISubmitCodeGauntletUseCase } from '../../../../application/ports/inbound/ISubmitCodeGauntletUseCase';
import { Side, SupportedLanguage } from '../../../../domain/game/types/GameTypes';

export class SubmissionController {
  constructor(
    private readonly submitGauntletUseCase: ISubmitCodeGauntletUseCase,
    private readonly runTestMatchUseCase: IRunTestMatchUseCase,
    private readonly leaderboardQuery: IGetLeaderboardQuery
  ) {}

  public submitGauntlet = async (req: Request, res: Response): Promise<void> => {
    try {
      const { username, language, sourceCode } = req.body || {};
      if (!language || !sourceCode) {
        res.status(400).json({ error: 'Vui lòng chọn ngôn ngữ và nhập code' });
        return;
      }

      const result = await this.submitGauntletUseCase.execute({
        username: username || 'Player_01',
        language: language as SupportedLanguage,
        sourceCode
      });

      res.json(result);
    } catch (err: any) {
      res.status(500).json({ error: err?.message || 'Lỗi server khi chấm xếp hạng' });
    }
  };

  public runTestMatch = async (req: Request, res: Response): Promise<void> => {
    try {
      const { language, sourceCode, botLevel = 2, userSide = 'RED' } = req.body || {};
      if (!language || !sourceCode) {
        res.status(400).json({ error: 'Thiếu ngôn ngữ hoặc mã nguồn' });
        return;
      }

      const result = await this.runTestMatchUseCase.execute({
        language: language as SupportedLanguage,
        sourceCode,
        botLevel: Number(botLevel),
        userSide: (userSide === 'BLUE' ? 'BLUE' : 'RED') as Side
      });

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
    res.json(sub);
  };
}
