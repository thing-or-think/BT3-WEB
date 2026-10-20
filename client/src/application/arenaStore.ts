import { cloneGrid } from '../domain/boardModel';
import { STARTER_TEMPLATES } from '../domain/starterTemplates';
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
  public initialBoardTemplate: CellChar[][] = [
    ['.', 'r', '.', 'p', '.', 's', '.', 'r', '.'],
    ['p', '.', 's', '.', 'r', '.', 'p', '.', 's'],
    ['.', '.', '.', '.', '.', '.', '.', '.', '.'],
    ['.', '.', '.', '.', '.', '.', '.', '.', '.'],
    ['.', '.', '.', '.', '.', '.', '.', '.', '.'],
    ['.', '.', '.', '.', '.', '.', '.', '.', '.'],
    ['.', '.', '.', '.', '.', '.', '.', '.', '.'],
    ['S', '.', 'P', '.', 'R', '.', 'S', '.', 'P'],
    ['.', 'R', '.', 'S', '.', 'P', '.', 'R', '.']
  ];

  public templatesByLang: Record<SupportedLanguage, string> = {
    javascript: STARTER_TEMPLATES.javascript,
    python: STARTER_TEMPLATES.python,
    cpp: STARTER_TEMPLATES.cpp,
    java: STARTER_TEMPLATES.java
  };

  public userDraftByLang: Record<SupportedLanguage, string> = {
    javascript: STARTER_TEMPLATES.javascript,
    python: STARTER_TEMPLATES.python,
    cpp: STARTER_TEMPLATES.cpp,
    java: STARTER_TEMPLATES.java
  };

  public currentLang: SupportedLanguage = 'javascript';
  public boardMode: 'replay' | 'manual' = 'replay';
  public currentBoard: CellChar[][] = cloneGrid(this.initialBoardTemplate);

  // Manual play state (Tab 1)
  public manualSelectedRC: { r: number; c: number } | null = null;
  public manualLegalTargets: LegalTargetHint[] = [];
  public manualTurnSide: Side = 'RED';
  public manualGameOver = false;
  public manualMoveHistory: MoveRecord[] = [];

  // Match list
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
