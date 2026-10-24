import { Side, SupportedLanguage } from '../../domain/game/types/GameTypes';

export interface SubmitCodeCommand {
  readonly userId?: string;
  readonly username: string;
  readonly language: SupportedLanguage;
  readonly sourceCode: string;
}

export interface RunTestMatchCommand {
  readonly language: SupportedLanguage;
  readonly sourceCode: string;
  readonly botLevel: number;
  readonly userSide: Side;
}
