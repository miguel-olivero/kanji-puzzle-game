/** State machine phases for the game */
export type GamePhase =
  | 'BOOT'
  | 'LOADING_DATA'
  | 'READY'
  | 'IN_ROUND'
  | 'CHECKED'
  | 'RESULT'
  | 'NEXT';

/** Valid transitions map */
export const VALID_TRANSITIONS: Record<GamePhase, GamePhase | null> = {
  BOOT: 'LOADING_DATA',
  LOADING_DATA: 'READY',
  READY: 'IN_ROUND',
  IN_ROUND: 'CHECKED',
  CHECKED: 'RESULT',
  RESULT: 'NEXT',
  NEXT: 'IN_ROUND',
};

/** State of a single slot in the current round */
export interface SlotState {
  readonly componentId: string;
  readonly expectedChar: string;
  readonly selectedChar: string | null;
  readonly isCorrect: boolean | null;
}

/** A complete game round */
export interface Round {
  readonly wordId: string;
  readonly targetKanji: string;
  readonly slots: SlotState[];
  readonly phase: GamePhase;
  readonly currentSlotIndex: number;
}
