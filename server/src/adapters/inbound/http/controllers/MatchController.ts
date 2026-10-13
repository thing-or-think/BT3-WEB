import { Request, Response } from 'express';
import { IPlayManualMoveUseCase } from '../../../../application/ports/inbound/IPlayManualMoveUseCase';
import { Board } from '../../../../domain/game/entities/Board';
import { BotDecisionDomainService } from '../../../../domain/game/services/BotDecisionDomainService';
import { STARTER_TEMPLATES } from '../../../../domain/game/services/StarterTemplates';
import { CellChar, Side } from '../../../../domain/game/types/GameTypes';

export class MatchController {
  constructor(private readonly playManualMoveUseCase: IPlayManualMoveUseCase) {}

  public getArenaMeta = (_req: Request, res: Response): void => {
    res.json({
      initialBoard: Board.createInitialGrid(),
      bots: BotDecisionDomainService.BOT_PROFILES,
      templates: STARTER_TEMPLATES
    });
  };

  public playBotMove = (req: Request, res: Response): void => {
    try {
      const { board, side = 'BLUE', botLevel = 2 } = req.body || {};
      if (!Array.isArray(board) || board.length !== 9) {
        res.status(400).json({ error: 'Bàn cờ không hợp lệ' });
        return;
      }

      const result = this.playManualMoveUseCase.execute({
        board: board as CellChar[][],
        side: (side === 'RED' ? 'RED' : 'BLUE') as Side,
        botLevel: Number(botLevel)
      });

      res.json(result);
    } catch (err: any) {
      res.status(500).json({ error: err?.message || 'Lỗi xử lý nước đi Bot' });
    }
  };
}
