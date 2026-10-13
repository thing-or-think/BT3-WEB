import { cloneGrid } from '../domain/boardModel';
import {
  CellChar,
  LegalTargetHint,
  MatchSummary,
  MoveRecord,
  Side,
  SupportedLanguage
} from '../domain/types';

export type MainTabId = 'practice' | 'studio' | 'ladder' | 'leaderboard';

export class ArenaStore {
  public activeMainTab: MainTabId = 'studio';
  public initialBoardTemplate: CellChar[][] = [];
  public templatesByLang: Record<SupportedLanguage, string> = {
    python: '',
    cpp: '',
    java: ''
  };
  public userDraftByLang: Record<SupportedLanguage, string> = {
    python: '',
    cpp: '',
    java: ''
  };
  public currentLang: SupportedLanguage = 'python';
  public boardMode: 'replay' | 'manual' = 'replay';
  public currentBoard: CellChar[][] = [];

  // Manual play state
  public manualSelectedRC: { r: number; c: number } | null = null;
  public manualLegalTargets: LegalTargetHint[] = [];
  public manualTurnSide: Side = 'RED';
  public manualGameOver = false;
  public manualMoveHistory: MoveRecord[] = [];

  // Gauntlet / Ladder matches
  public currentGauntletMatches: MatchSummary[] = [];

  public resetManualState(): void {
    this.currentBoard = cloneGrid(this.initialBoardTemplate);
    this.manualSelectedRC = null;
    this.manualLegalTargets = [];
    this.manualTurnSide = 'RED';
    this.manualGameOver = false;
    this.manualMoveHistory = [];
  }
}
