import type { Word, KanjiDecomposition, Kanji } from '../domain';
import { CONFIG } from '../config';

/** Shape of the decomposition JSON file */
export type DecompMap = Record<string, KanjiDecomposition>;
/** Shape of the kanji meta JSON file */
export type MetaMap = Record<string, { reading: string; meaning: string }>;
/** Shape of the confusables JSON file */
export type ConfusablesMap = Record<string, string[]>;

/** All data needed by the game, loaded from same-origin JSON */
export interface GameData {
  readonly words: Word[];
  readonly decompositions: DecompMap;
  readonly kanjiMeta: MetaMap;
  readonly confusables: ConfusablesMap;
}

/** Manual decomposition registry for kanji not in the main dataset */
const manualDecomps: DecompMap = {};

/**
 * Register a manual decomposition for a kanji that's missing from the dataset.
 * Hook for future extensibility.
 */
export function registerManualDecomp(
  kanji: string,
  decomp: KanjiDecomposition,
): void {
  manualDecomps[kanji] = decomp;
}

/** Resolve base path depending on environment */
function getBasePath(): string {
  // In Vite, import.meta.env.BASE_URL provides the configured base
  if (typeof import.meta !== 'undefined' && import.meta.env?.BASE_URL) {
    return import.meta.env.BASE_URL;
  }
  return '/';
}

/**
 * Fetch a same-origin JSON file. NEVER fetches external URLs.
 * @throws Error if the fetch fails or returns non-OK status.
 */
async function fetchLocalJson<T>(path: string): Promise<T> {
  const base = getBasePath();
  const url = `${base}${path}`;

  // Safety: ensure we never fetch external URLs
  if (url.startsWith('http') && !url.startsWith(window.location.origin)) {
    throw new Error(
      `CORS violation prevented: refusing to fetch external URL "${url}"`,
    );
  }

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}: ${response.status} ${response.statusText}`);
  }
  return response.json() as Promise<T>;
}

/**
 * Load all game data from same-origin JSON files.
 * Filters out words whose kanji don't have decompositions.
 */
export async function loadGameData(): Promise<GameData> {
  const [words, decompositions, kanjiMeta, confusables] = await Promise.all([
    fetchLocalJson<Word[]>(CONFIG.DATA_PATHS.WORDS),
    fetchLocalJson<DecompMap>(CONFIG.DATA_PATHS.KANJI_DECOMP),
    fetchLocalJson<MetaMap>(CONFIG.DATA_PATHS.KANJI_META),
    fetchLocalJson<ConfusablesMap>(CONFIG.DATA_PATHS.CONFUSABLES),
  ]);

  // Merge manual decompositions
  const mergedDecomps: DecompMap = { ...decompositions, ...manualDecomps };

  // Filter words: keep words where ALL kanji have a decomposition entry
  const filteredWords = words.filter((word) =>
    word.kanji.every((k) => mergedDecomps[k] !== undefined),
  );

  return {
    words: filteredWords,
    decompositions: mergedDecomps,
    kanjiMeta,
    confusables,
  };
}

/**
 * Load a user-uploaded file via FileReader (for .sqlite or custom JSON).
 * NEVER uses external URLs — only FileReader.
 */
export function loadUserFile(file: File): Promise<ArrayBuffer> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (): void => {
      if (reader.result instanceof ArrayBuffer) {
        resolve(reader.result);
      } else {
        reject(new Error('FileReader did not return ArrayBuffer'));
      }
    };
    reader.onerror = (): void => reject(reader.error);
    reader.readAsArrayBuffer(file);
  });
}

/**
 * Get all unique component chars from the decomposition map.
 * Useful for distractor generation.
 */
export function getAllComponentChars(decomps: DecompMap): string[] {
  const chars = new Set<string>();
  for (const kanji of Object.values(decomps)) {
    for (const comp of kanji.components) {
      chars.add(comp.char);
    }
  }
  return Array.from(chars);
}
