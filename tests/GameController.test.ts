import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GameController } from '../src/controllers/GameController';
import type { GameEvent } from '../src/controllers/GameController';
import type { GamePhase } from '../src/domain';

// Mock the DataLoader module
vi.mock('../src/services/DataLoader', () => ({
  loadGameData: vi.fn().mockResolvedValue({
    words: [
      { id: 'w1', kanji: ['休'], reading: 'きゅう', meaning: 'rest' },
      { id: 'w2', kanji: ['明'], reading: 'めい', meaning: 'bright' },
    ],
    decompositions: {
      '休': {
        components: [
          { id: 'c1', char: '亻', label: 'persona', label_en: 'person', slot_id: 'left', order_index: 0, bounds: { x: 0, y: 0, w: 0.4, h: 1 } },
          { id: 'c2', char: '木', label: 'árbol', label_en: 'tree', slot_id: 'right', order_index: 1, bounds: { x: 0.4, y: 0, w: 0.6, h: 1 } },
        ],
        layout: '⿰',
      },
      '明': {
        components: [
          { id: 'c3', char: '日', label: 'sol', label_en: 'sun', slot_id: 'left', order_index: 0, bounds: { x: 0, y: 0, w: 0.45, h: 1 } },
          { id: 'c4', char: '月', label: 'luna', label_en: 'moon', slot_id: 'right', order_index: 1, bounds: { x: 0.45, y: 0, w: 0.55, h: 1 } },
        ],
        layout: '⿰',
      },
    },
    kanjiMeta: {
      '休': { reading: 'きゅう', meaning: 'rest' },
      '明': { reading: 'めい', meaning: 'bright' },
    },
    confusables: {
      '亻': ['イ', '彳', '人'],
      '木': ['本', '末', '未'],
      '日': ['目', '白', '田'],
      '月': ['円', '用', '角'],
    },
  }),
  getAllComponentChars: vi.fn().mockReturnValue(['亻', '木', '日', '月', '人', '口']),
}));

// Mock Storage module
vi.mock('../src/services/Storage', () => ({
  loadProgress: vi.fn().mockReturnValue({
    wordsSeen: [],
    wordsCompleted: [],
    lastPlayedTimestamp: new Date().toISOString(),
  }),
  saveProgress: vi.fn(),
  markWordSeen: vi.fn(),
  markWordCompleted: vi.fn(),
  loadScore: vi.fn().mockReturnValue({
    totalAttempts: 0,
    totalCorrect: 0,
    errorsByComponent: {},
  }),
  saveScore: vi.fn(),
}));

describe('GameController', () => {
  let controller: GameController;
  let events: GameEvent[];

  beforeEach(() => {
    controller = new GameController();
    events = [];
    controller.on((event) => events.push(event));
  });

  describe('State Machine Transitions', () => {
    it('should start in BOOT phase', () => {
      expect(controller.getPhase()).toBe('BOOT');
    });

    it('should transition BOOT → LOADING_DATA', () => {
      controller.transition('LOADING_DATA');
      expect(controller.getPhase()).toBe('LOADING_DATA');
    });

    it('should transition LOADING_DATA → READY', () => {
      controller.transition('LOADING_DATA');
      controller.transition('READY');
      expect(controller.getPhase()).toBe('READY');
    });

    it('should transition READY → IN_ROUND', () => {
      controller.transition('LOADING_DATA');
      controller.transition('READY');
      controller.transition('IN_ROUND');
      expect(controller.getPhase()).toBe('IN_ROUND');
    });

    it('should transition IN_ROUND → CHECKED', () => {
      controller.transition('LOADING_DATA');
      controller.transition('READY');
      controller.transition('IN_ROUND');
      controller.transition('CHECKED');
      expect(controller.getPhase()).toBe('CHECKED');
    });

    it('should transition CHECKED → RESULT', () => {
      controller.transition('LOADING_DATA');
      controller.transition('READY');
      controller.transition('IN_ROUND');
      controller.transition('CHECKED');
      controller.transition('RESULT');
      expect(controller.getPhase()).toBe('RESULT');
    });

    it('should transition RESULT → NEXT', () => {
      controller.transition('LOADING_DATA');
      controller.transition('READY');
      controller.transition('IN_ROUND');
      controller.transition('CHECKED');
      controller.transition('RESULT');
      controller.transition('NEXT');
      expect(controller.getPhase()).toBe('NEXT');
    });

    it('should transition NEXT → IN_ROUND (loop)', () => {
      controller.transition('LOADING_DATA');
      controller.transition('READY');
      controller.transition('IN_ROUND');
      controller.transition('CHECKED');
      controller.transition('RESULT');
      controller.transition('NEXT');
      controller.transition('IN_ROUND');
      expect(controller.getPhase()).toBe('IN_ROUND');
    });

    it('should throw on invalid transition BOOT → READY', () => {
      expect(() => controller.transition('READY')).toThrow('Invalid transition');
    });

    it('should throw on invalid transition BOOT → IN_ROUND', () => {
      expect(() => controller.transition('IN_ROUND')).toThrow('Invalid transition');
    });

    it('should throw on invalid transition READY → CHECKED', () => {
      controller.transition('LOADING_DATA');
      controller.transition('READY');
      expect(() => controller.transition('CHECKED')).toThrow('Invalid transition');
    });

    it('should throw on invalid transition IN_ROUND → RESULT', () => {
      controller.transition('LOADING_DATA');
      controller.transition('READY');
      controller.transition('IN_ROUND');
      expect(() => controller.transition('RESULT')).toThrow('Invalid transition');
    });

    it('should throw on invalid transition CHECKED → IN_ROUND', () => {
      controller.transition('LOADING_DATA');
      controller.transition('READY');
      controller.transition('IN_ROUND');
      controller.transition('CHECKED');
      expect(() => controller.transition('IN_ROUND')).toThrow('Invalid transition');
    });
  });

  describe('Event emission', () => {
    it('should emit PHASE_CHANGED on transition', () => {
      controller.transition('LOADING_DATA');
      expect(events).toHaveLength(1);
      expect(events[0].type).toBe('PHASE_CHANGED');
      if (events[0].type === 'PHASE_CHANGED') {
        expect(events[0].phase).toBe('LOADING_DATA');
      }
    });

    it('should allow unsubscribing from events', () => {
      const unsubscribe = controller.on((event) => events.push(event));
      // Already subscribed in beforeEach + this one
      controller.transition('LOADING_DATA');
      expect(events).toHaveLength(2); // One from beforeEach, one from this
      unsubscribe();
      controller.transition('READY');
      // Only 1 new event from the first listener, so total 3
      expect(events).toHaveLength(3);
    });
  });

  describe('Game flow', () => {
    it('should load data and transition to READY', async () => {
      await controller.start();
      expect(controller.getPhase()).toBe('READY');

      const dataLoadedEvent = events.find((e) => e.type === 'DATA_LOADED');
      expect(dataLoadedEvent).toBeDefined();
      if (dataLoadedEvent && dataLoadedEvent.type === 'DATA_LOADED') {
        expect(dataLoadedEvent.wordCount).toBe(2);
      }
    });

    it('should start a round after loading', async () => {
      await controller.start();
      controller.startRound();

      expect(controller.getPhase()).toBe('IN_ROUND');

      const roundEvent = events.find((e) => e.type === 'ROUND_STARTED');
      expect(roundEvent).toBeDefined();
      if (roundEvent && roundEvent.type === 'ROUND_STARTED') {
        expect(roundEvent.round.slots.length).toBeGreaterThanOrEqual(1);
        expect(roundEvent.options.length).toBeGreaterThanOrEqual(1);
      }
    });

    it('should handle option selection', async () => {
      await controller.start();
      controller.startRound();

      const round = controller.getRound();
      expect(round).not.toBeNull();
      if (!round) return;

      // Select the correct option for the first slot
      const firstExpected = round.slots[0].expectedChar;
      controller.selectOption(firstExpected);

      const updatedRound = controller.getRound();
      expect(updatedRound).not.toBeNull();
      if (!updatedRound) return;

      expect(updatedRound.slots[0].selectedChar).toBe(firstExpected);
      expect(updatedRound.currentSlotIndex).toBe(1);
    });

    it('should check round when all slots filled', async () => {
      await controller.start();
      controller.startRound();

      const round = controller.getRound();
      if (!round) return;

      // Fill all slots with correct answers
      for (const slot of round.slots) {
        controller.selectOption(slot.expectedChar);
      }

      // Now check
      controller.checkRound();
      expect(controller.getPhase()).toBe('CHECKED');

      const checkEvent = events.find((e) => e.type === 'ROUND_CHECKED');
      expect(checkEvent).toBeDefined();
      if (checkEvent && checkEvent.type === 'ROUND_CHECKED') {
        expect(checkEvent.result.ratio).toBe(1);
      }
    });

    it('should not check if slots are not all filled', async () => {
      await controller.start();
      controller.startRound();

      // Don't fill any slots, try to check
      controller.checkRound();

      // Should remain in IN_ROUND and emit an error
      expect(controller.getPhase()).toBe('IN_ROUND');
      const errorEvent = events.find((e) => e.type === 'ERROR');
      expect(errorEvent).toBeDefined();
    });

    it('should complete full game cycle', async () => {
      await controller.start();
      controller.startRound();

      const round = controller.getRound();
      if (!round) return;

      // Fill all slots
      for (const slot of round.slots) {
        controller.selectOption(slot.expectedChar);
      }

      controller.checkRound();
      expect(controller.getPhase()).toBe('CHECKED');

      controller.showResult();
      expect(controller.getPhase()).toBe('RESULT');

      controller.next();
      expect(controller.getPhase()).toBe('NEXT');

      // Can start a new round
      controller.startRound();
      expect(controller.getPhase()).toBe('IN_ROUND');
    });
  });
});
