import { SingleMatchSummary } from '../../evaluation/entities/Submission';
import { Board } from '../../game/entities/Board';
import { MatchOutcome } from '../../game/types/GameTypes';

export class ScoringPolicy {
  /**
   * Tính điểm 1 ván đấu dựa trên điểm cơ bản của Bot và tốc độ chiến thắng
   */
  public static calculateMatchScore(
    outcome: MatchOutcome,
    botBasePoints: number,
    turnsCount: number
  ): number {
    if (outcome === 'WIN') {
      const speedBonus = Math.round(Math.max(0, Board.MAX_TURNS - turnsCount) * 0.5);
      return botBasePoints + speedBonus;
    }
    if (outcome === 'DRAW') {
      return Math.round(botBasePoints * 0.25);
    }
    return 0;
  }

  /**
   * Tính hệ số Elo mới sau chuỗi trận đấu với các Bot chuẩn
   */
  public static calculateNewElo(initialElo: number, matches: ReadonlyArray<SingleMatchSummary>): number {
    let rating = initialElo || 1000;
    const K = 32;

    for (const m of matches) {
      const expected = 1 / (1 + Math.pow(10, (m.botElo - rating) / 400));
      let actual = 0;
      if (m.result === 'WIN') actual = 1.0;
      else if (m.result === 'DRAW') actual = 0.5;
      rating += K * (actual - expected);
    }

    return Math.max(600, Math.round(rating));
  }
}
