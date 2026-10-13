import { SubmitGauntletResultDto } from '../../dto/MatchResultDto';
import { SubmitCodeCommand } from '../../dto/SubmitCodeDto';

export interface ISubmitCodeGauntletUseCase {
  execute(command: SubmitCodeCommand): Promise<SubmitGauntletResultDto>;
}
