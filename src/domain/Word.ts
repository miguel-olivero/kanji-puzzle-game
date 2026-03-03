/** A vocabulary word used as a hint in the game */
export interface Word {
  readonly id: string;
  readonly kanji: readonly string[];
  readonly reading: string;
  readonly meaning: string;
  /**
   * Per-kanji reading segments, in the same order as `kanji[]`.
   * Used to hide the target kanji in the hint by replacing it with kana.
   * Example: 番号 → ["ばん", "ごう"]
   */
  readonly readingParts?: readonly string[];
}
