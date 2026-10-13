import { TestMatchResultDto } from '../../dto/MatchResultDto';
import { RunTestMatchCommand } from '../../dto/SubmitCodeDto';

export interface IRunTestMatchUseCase {
  execute(command: RunTestMatchCommand): Promise<TestMatchResultDto>;
}
