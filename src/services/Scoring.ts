import type { SlotState } from '../domain';
import { loadScore, saveScore } from './Storage';
import type { ScoreData } from './Storage';

/** Result of evaluating a single round */
export interface RoundResult {
  readonly totalSlots: number;
  readonly correctSlots: number;
  readonly ratio: number;
  readonly incorrectComponents: string[];
}

/**
 * Evaluate the slots after checking a round.
 * Pure function — no side effects.
 */
export function evaluateRound(slots: readonly SlotState[]): RoundResult {
  const totalSlots = slots.length;
  const correctSlots = slots.filter((s) => s.isCorrect === true).length;
  const ratio = totalSlots > 0 ? correctSlots / totalSlots : 0;
  const incorrectComponents = slots
    .filter((s) => s.isCorrect === false)
    .map((s) => s.expectedChar);

  return { totalSlots, correctSlots, ratio, incorrectComponents };
}

/**
 * Compute accuracy ratio from score data.
 * Pure function.
 */
export function computeAccuracyRatio(score: ScoreData): number {
  if (score.totalAttempts === 0) return 0;
  return score.totalCorrect / score.totalAttempts;
}

/**
 * Persist round results to storage.
 * Side-effectful — updates localStorage.
 */
export function recordRoundResult(result: RoundResult): void {
  const score = loadScore();

  const newErrorsByComponent = { ...score.errorsByComponent };
  for (const comp of result.incorrectComponents) {
    newErrorsByComponent[comp] = (newErrorsByComponent[comp] ?? 0) + 1;
  }

  saveScore({
    totalAttempts: score.totalAttempts + result.totalSlots,
    totalCorrect: score.totalCorrect + result.correctSlots,
    errorsByComponent: newErrorsByComponent,
  });
}

/**
 * Get the current global accuracy ratio.
 */
export function getGlobalAccuracy(): number {
  const score = loadScore();
  return computeAccuracyRatio(score);
}

/**
 * Get components sorted by error frequency (most errors first).
 */
export function getMostErrorProne(): Array<{ char: string; errors: number }> {
  const score = loadScore();
  return Object.entries(score.errorsByComponent)
    .map(([char, errors]) => ({ char, errors }))
    .sort((a, b) => b.errors - a.errors);
}
