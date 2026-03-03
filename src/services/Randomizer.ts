import type { ConfusablesMap } from './DataLoader';
import { CONFIG } from '../config';

/**
 * Fisher-Yates shuffle (in place). Returns the same array.
 */
export function shuffle<T>(arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/**
 * Generate option buttons for a slot: 1 correct + N distractors.
 *
 * Distractors are chosen by:
 * 1. Visual confusables (from confusables.json) — preferred
 * 2. Random components from the pool — fallback
 *
 * Guarantees:
 * - The correct answer is always included exactly once
 * - No duplicates
 * - Returns exactly CONFIG.TOTAL_OPTIONS items (or less if pool is too small)
 */
export function generateOptions(
  correctChar: string,
  allComponentChars: readonly string[],
  confusables: ConfusablesMap,
): string[] {
  const distractorCount = CONFIG.DISTRACTOR_COUNT;
  const distractors = new Set<string>();

  // 1. Try confusables first
  const confusableList = confusables[correctChar];
  if (confusableList) {
    const shuffled = shuffle([...confusableList]);
    for (const c of shuffled) {
      if (c !== correctChar && distractors.size < distractorCount) {
        distractors.add(c);
      }
    }
  }

  // 2. Fill remaining from all components pool
  if (distractors.size < distractorCount) {
    const pool = allComponentChars.filter(
      (c) => c !== correctChar && !distractors.has(c),
    );
    const shuffledPool = shuffle([...pool]);
    for (const c of shuffledPool) {
      if (distractors.size >= distractorCount) break;
      distractors.add(c);
    }
  }

  // Combine and shuffle
  const options = [correctChar, ...Array.from(distractors)];
  return shuffle(options);
}

/**
 * Pick a random word from the list, optionally avoiding recently seen words.
 */
export function pickRandomWord<T extends { id: string }>(
  words: readonly T[],
  recentIds: readonly string[] = [],
): T {
  // Try to avoid recently seen words
  const unseen = words.filter((w) => !recentIds.includes(w.id));
  const pool = unseen.length > 0 ? unseen : words;
  const index = Math.floor(Math.random() * pool.length);
  return pool[index];
}

/**
 * Pick a random kanji from a word that has a multi-component decomposition.
 * Prefers kanji with 2+ components for a more interesting puzzle.
 */
export function pickTargetKanji(
  kanjiChars: readonly string[],
  decompositions: Record<string, { components: readonly { char: string }[] }>,
): string | null {
  // Prefer multi-component kanji
  const multiComp = kanjiChars.filter(
    (k) => decompositions[k] && decompositions[k].components.length > 1,
  );
  const pool = multiComp.length > 0 ? multiComp : [...kanjiChars];

  if (pool.length === 0) return null;

  const index = Math.floor(Math.random() * pool.length);
  return pool[index];
}
