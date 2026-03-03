import { CONFIG } from '../config';

/** Progress data stored in localStorage */
export interface ProgressData {
  readonly wordsSeen: string[];
  readonly wordsCompleted: string[];
  readonly lastPlayedTimestamp: string;
}

/** Score data stored in localStorage */
export interface ScoreData {
  readonly totalAttempts: number;
  readonly totalCorrect: number;
  readonly errorsByComponent: Record<string, number>;
}

/** Consent data stored in localStorage — NEVER cookies */
export interface ConsentData {
  readonly timestamp: string;
  readonly policyVersion: string;
  readonly categories: string[];
}

// ─── localStorage helpers ────────────────────────────────────

function getItem<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    if (raw === null) return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function setItem<T>(key: string, value: T): void {
  localStorage.setItem(key, JSON.stringify(value));
}

function removeItem(key: string): void {
  localStorage.removeItem(key);
}

// ─── Progress ────────────────────────────────────────────────

export function loadProgress(): ProgressData {
  const data = getItem<ProgressData>(CONFIG.STORAGE_KEYS.PROGRESS);
  return (
    data ?? {
      wordsSeen: [],
      wordsCompleted: [],
      lastPlayedTimestamp: new Date().toISOString(),
    }
  );
}

export function saveProgress(progress: ProgressData): void {
  setItem(CONFIG.STORAGE_KEYS.PROGRESS, progress);
}

export function markWordSeen(wordId: string): void {
  const progress = loadProgress();
  if (!progress.wordsSeen.includes(wordId)) {
    saveProgress({
      ...progress,
      wordsSeen: [...progress.wordsSeen, wordId],
      lastPlayedTimestamp: new Date().toISOString(),
    });
  }
}

export function markWordCompleted(wordId: string): void {
  const progress = loadProgress();
  if (!progress.wordsCompleted.includes(wordId)) {
    saveProgress({
      ...progress,
      wordsCompleted: [...progress.wordsCompleted, wordId],
      lastPlayedTimestamp: new Date().toISOString(),
    });
  }
}

// ─── Score ───────────────────────────────────────────────────

export function loadScore(): ScoreData {
  const data = getItem<ScoreData>(CONFIG.STORAGE_KEYS.SCORE);
  return (
    data ?? {
      totalAttempts: 0,
      totalCorrect: 0,
      errorsByComponent: {},
    }
  );
}

export function saveScore(score: ScoreData): void {
  setItem(CONFIG.STORAGE_KEYS.SCORE, score);
}

// ─── Consent (CMP) — NEVER cookies ──────────────────────────

export function loadConsent(): ConsentData | null {
  return getItem<ConsentData>(CONFIG.STORAGE_KEYS.CONSENT);
}

export function saveConsent(categories: string[]): void {
  const consent: ConsentData = {
    timestamp: new Date().toISOString(),
    policyVersion: CONFIG.CMP.POLICY_VERSION,
    categories,
  };
  setItem(CONFIG.STORAGE_KEYS.CONSENT, consent);
}

export function revokeConsent(): void {
  removeItem(CONFIG.STORAGE_KEYS.CONSENT);
}

export function hasConsent(): boolean {
  return loadConsent() !== null;
}

export function hasAnalyticsConsent(): boolean {
  const consent = loadConsent();
  if (!consent) return false;
  return consent.categories.includes(CONFIG.CMP.CATEGORIES.ANALYTICS);
}

// ─── Clear all ───────────────────────────────────────────────

export function clearAllData(): void {
  removeItem(CONFIG.STORAGE_KEYS.PROGRESS);
  removeItem(CONFIG.STORAGE_KEYS.SCORE);
  removeItem(CONFIG.STORAGE_KEYS.CONSENT);
}
