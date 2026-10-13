import { Board } from '../../domain/game/entities/Board';
import { BotDecisionDomainService } from '../../domain/game/services/BotDecisionDomainService';
import { Side } from '../../domain/game/types/GameTypes';
import { ManualBotMoveResponseDto } from '../dto/MatchResultDto';
import { IPlayManualMoveUseCase, PlayManualMoveCommand } from '../ports/inbound/IPlayManualMoveUseCase';

export class PlayManualMoveUseCase implements IPlayManualMoveUseCase {
  constructor(private readonly botDomainService: BotDecisionDomainService) {}

  public execute(command: PlayManualMoveCommand): ManualBotMoveResponseDto {
    const board = new Board(command.board);
    const side: Side = command.side || 'BLUE';
    const move = this.botDomainService.chooseMove(command.botLevel || 2, board, side);

    if (!move) {
      return {
        move: null,
        gameOver: true,
        reason: 'NO_MOVES'
      };
    }

    const nextBoard = board.applyMove(move);
    const won = Board.isEnemyBase(side, move.toR, move.toC);
    const oppSide: Side = side === 'RED' ? 'BLUE' : 'RED';
    const oppMoves = nextBoard.getLegalMoves(oppSide);

    return {
      move: {
        from: move.from,
        to: move.to,
        fromR: move.fromR,
        fromC: move.fromC,
        toR: move.toR,
        toC: move.toC,
        piece: move.piece,
        captured: move.captured
      },
      board: nextBoard.getGrid(),
      gameOver: won || oppMoves.length === 0,
      winner: won || oppMoves.length === 0 ? side : null,
      reason: won ? 'BASE_CAPTURE' : oppMoves.length === 0 ? 'NO_MOVES' : null
    };
  }
}
