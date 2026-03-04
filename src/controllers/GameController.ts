import type { GamePhase, SlotState, Round, Word, KanjiDecomposition } from '../domain';
import { VALID_TRANSITIONS } from '../domain';
import type { GameData, DecompMap } from '../services/DataLoader';
import { loadGameData, getAllComponentChars } from '../services/DataLoader';
import { generateOptions, pickRandomWord, pickTargetKanji } from '../services/Randomizer';
import { evaluateRound, recordRoundResult } from '../services/Scoring';
import type { RoundResult } from '../services/Scoring';
import { markWordSeen, markWordCompleted } from '../services/Storage';

/** An option button: the component char + its pedagogical label */
export interface OptionItem {
  readonly char: string;
  readonly label: string;
}

/** Events emitted by the game controller */
export type GameEvent =
  | { type: 'PHASE_CHANGED'; phase: GamePhase }
  | { type: 'ROUND_STARTED'; round: Round; word: Word; decomposition: KanjiDecomposition; options: OptionItem[] }
  | { type: 'SLOT_FILLED'; slotIndex: number; char: string; round: Round; nextOptions: OptionItem[] | null }
  | { type: 'ROUND_CHECKED'; round: Round; result: RoundResult }
  | { type: 'DATA_LOADED'; wordCount: number }
  | { type: 'ERROR'; message: string };

export type GameEventListener = (event: GameEvent) => void;

/**
 * GameController: state machine + event orchestrator.
 * Manages game phases and round lifecycle.
 */
export class GameController {
  private phase: GamePhase = 'BOOT';
  private data: GameData | null = null;
  private currentRound: Round | null = null;
  private currentWord: Word | null = null;
  private allComponentChars: string[] = [];
  /** Map from component char → label (es) for building OptionItems */
  private componentLabelMap: Record<string, string> = {};
  private listeners: GameEventListener[] = [];
  private recentWordIds: string[] = [];

  /** Subscribe to game events */
  on(listener: GameEventListener): () => void {
    this.listeners.push(listener);
    return (): void => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  /** Emit event to all listeners */
  private emit(event: GameEvent): void {
    for (const listener of this.listeners) {
      listener(event);
    }
  }

  /** Get current game phase */
  getPhase(): GamePhase {
    return this.phase;
  }

  /** Get current round (if any) */
  getRound(): Round | null {
    return this.currentRound;
  }

  /** Get current word (if any) */
  getCurrentWord(): Word | null {
    return this.currentWord;
  }

  /**
   * Transition to a new phase. Throws if the transition is invalid.
   */
  transition(targetPhase: GamePhase): void {
    const expected = VALID_TRANSITIONS[this.phase];
    if (expected !== targetPhase) {
      throw new Error(
        `Invalid transition: ${this.phase} → ${targetPhase}. Expected: ${this.phase} → ${String(expected)}`,
      );
    }
    this.phase = targetPhase;
    this.emit({ type: 'PHASE_CHANGED', phase: this.phase });
  }

  /**
   * Start the game: load data from same-origin JSON.
   * Transitions BOOT → LOADING_DATA → READY.
   */
  async start(): Promise<void> {
    this.transition('LOADING_DATA');

    try {
      this.data = await loadGameData();
      this.allComponentChars = getAllComponentChars(this.data.decompositions);
      this.componentLabelMap = buildComponentLabelMap(this.data.decompositions);
      this.emit({ type: 'DATA_LOADED', wordCount: this.data.words.length });
      this.transition('READY');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error loading data';
      this.emit({ type: 'ERROR', message });
    }
  }

  /**
   * Begin a new round. Transitions READY/NEXT → IN_ROUND.
   */
  startRound(): void {
    if (!this.data) {
      this.emit({ type: 'ERROR', message: 'No data loaded' });
      return;
    }

    if (this.data.words.length === 0) {
      this.emit({ type: 'ERROR', message: 'No words available. Rebuild game data and try again.' });
      return;
    }

    this.transition('IN_ROUND');

    const word = pickRandomWord(this.data.words, this.recentWordIds);
    this.currentWord = word;

    // Track recent words to avoid immediate repeats
    this.recentWordIds.push(word.id);
    if (this.recentWordIds.length > 5) {
      this.recentWordIds.shift();
    }

    markWordSeen(word.id);

    // Pick a target kanji from the word
    const targetKanji = pickTargetKanji(
      word.kanji,
      this.data.decompositions,
    );

    if (!targetKanji) {
      this.emit({ type: 'ERROR', message: `No decomposable kanji found in word ${word.id}` });
      return;
    }

    const decomposition = this.data.decompositions[targetKanji];
    if (!decomposition) {
      this.emit({ type: 'ERROR', message: `No decomposition found for ${targetKanji}` });
      return;
    }

    // Sort components by order_index
    const sortedComponents = [...decomposition.components].sort(
      (a, b) => a.order_index - b.order_index,
    );

    // Build slot states
    const slots: SlotState[] = sortedComponents.map((comp) => ({
      componentId: comp.id,
      expectedChar: comp.char,
      selectedChar: null,
      isCorrect: null,
    }));

    this.currentRound = {
      wordId: word.id,
      targetKanji,
      slots,
      phase: 'IN_ROUND',
      currentSlotIndex: 0,
    };

    // Generate options for the first slot
    const options = this.getOptionsForCurrentSlot();

    this.emit({
      type: 'ROUND_STARTED',
      round: this.currentRound,
      word,
      decomposition,
      options,
    });
  }

  /**
   * Handle the user selecting an option for the current slot.
   */
  selectOption(char: string): void {
    if (!this.currentRound || this.phase !== 'IN_ROUND') return;

    const slotIdx = this.currentRound.currentSlotIndex;
    if (slotIdx >= this.currentRound.slots.length) return;

    // Update slot
    const newSlots = [...this.currentRound.slots];
    newSlots[slotIdx] = {
      ...newSlots[slotIdx],
      selectedChar: char,
    };

    const nextSlotIndex = slotIdx + 1;
    this.currentRound = {
      ...this.currentRound,
      slots: newSlots,
      currentSlotIndex: nextSlotIndex,
    };

    // Generate options for next slot (or null if all filled)
    let nextOptions: OptionItem[] | null = null;
    if (nextSlotIndex < newSlots.length) {
      nextOptions = this.getOptionsForCurrentSlot();
    }

    this.emit({
      type: 'SLOT_FILLED',
      slotIndex: slotIdx,
      char,
      round: this.currentRound,
      nextOptions,
    });
  }

  /**
   * Check the round: compare selected chars with expected.
   * Transitions IN_ROUND → CHECKED.
   * Only valid if all slots are filled.
   */
  checkRound(): void {
    if (!this.currentRound || this.phase !== 'IN_ROUND') return;

    // Guard: all slots must be filled
    const allFilled = this.currentRound.slots.every(
      (s) => s.selectedChar !== null,
    );
    if (!allFilled) {
      this.emit({
        type: 'ERROR',
        message: 'Cannot check: not all slots are filled',
      });
      return;
    }

    // Evaluate each slot
    const checkedSlots: SlotState[] = this.currentRound.slots.map((s) => ({
      ...s,
      isCorrect: s.selectedChar === s.expectedChar,
    }));

    this.currentRound = {
      ...this.currentRound,
      slots: checkedSlots,
      phase: 'CHECKED',
    };

    this.transition('CHECKED');

    const result = evaluateRound(checkedSlots);
    recordRoundResult(result);

    // Mark word completed if perfect
    if (result.ratio === 1 && this.currentWord) {
      markWordCompleted(this.currentWord.id);
    }

    this.emit({
      type: 'ROUND_CHECKED',
      round: this.currentRound,
      result,
    });
  }

  /**
   * Show result after checking. Transitions CHECKED → RESULT.
   */
  showResult(): void {
    this.transition('RESULT');
  }

  /**
   * Advance to next round. Transitions RESULT → NEXT.
   */
  next(): void {
    this.transition('NEXT');
  }

  /**
   * Get options for the current slot as OptionItems (char + label).
   */
  private getOptionsForCurrentSlot(): OptionItem[] {
    if (!this.currentRound || !this.data) return [];

    const slotIdx = this.currentRound.currentSlotIndex;
    if (slotIdx >= this.currentRound.slots.length) return [];

    const slot = this.currentRound.slots[slotIdx];
    const chars = generateOptions(
      slot.expectedChar,
      this.allComponentChars,
      this.data.confusables,
    );
    return chars.map((c) => ({
      char: c,
      label: this.componentLabelMap[c] ?? c,
    }));
  }
}

/** Build a map from component char → label by walking all decompositions */
function buildComponentLabelMap(decomps: DecompMap): Record<string, string> {
  const map: Record<string, string> = {};
  for (const kanji of Object.values(decomps)) {
    for (const comp of kanji.components) {
      if (!map[comp.char] && comp.label) {
        map[comp.char] = comp.label;
      }
    }
  }
  return map;
}
