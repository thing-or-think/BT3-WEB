import { CellChar, Side } from '../../../domain/game/types/GameTypes';
import { ManualBotMoveResponseDto } from '../../dto/MatchResultDto';

export interface PlayManualMoveCommand {
  readonly board: CellChar[][];
  readonly side: Side;
  readonly botLevel: number;
}

export interface IPlayManualMoveUseCase {
  execute(command: PlayManualMoveCommand): ManualBotMoveResponseDto;
}
