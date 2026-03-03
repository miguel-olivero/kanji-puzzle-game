/** Global game configuration constants */
export const CONFIG = {
  /** Number of distractor options per slot question */
  DISTRACTOR_COUNT: 3,

  /** Total options shown per slot (correct + distractors) */
  TOTAL_OPTIONS: 4,

  /** Data paths — always same-origin, never external URLs */
  DATA_PATHS: {
    WORDS: 'data/words.json',
    KANJI_DECOMP: 'data/kanji_decomp.json',
    KANJI_META: 'data/kanji_meta.json',
    CONFUSABLES: 'data/confusables.json',
  },

  /** Storage keys for localStorage */
  STORAGE_KEYS: {
    PROGRESS: 'kpg_progress',
    SCORE: 'kpg_score',
    CONSENT: 'kpg_consent',
  },

  /** Consent Management */
  CMP: {
    POLICY_VERSION: '1.0',
    CATEGORIES: {
      ESSENTIAL: 'essential',
      ANALYTICS: 'analytics',
    },
  },

  /** IndexedDB threshold — use IDB if dataset exceeds this (bytes) */
  IDB_THRESHOLD: 500 * 1024,

  /** Kanvas size */
  KANVAS_SIZE_PX: 300,
} as const;
