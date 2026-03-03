import { describe, it, expect, vi, beforeEach } from 'vitest';
import { evaluateRound, computeAccuracyRatio } from '../src/services/Scoring';
import type { SlotState } from '../src/domain';
import type { ScoreData } from '../src/services/Storage';

// Mock Storage for the Scoring module
vi.mock('../src/services/Storage', () => ({
  loadScore: vi.fn().mockReturnValue({
    totalAttempts: 0,
    totalCorrect: 0,
    errorsByComponent: {},
  }),
  saveScore: vi.fn(),
}));

describe('Scoring', () => {
  describe('evaluateRound', () => {
    it('should return perfect score when all slots are correct', () => {
      const slots: SlotState[] = [
        { componentId: 'c1', expectedChar: '亻', selectedChar: '亻', isCorrect: true },
        { componentId: 'c2', expectedChar: '木', selectedChar: '木', isCorrect: true },
      ];

      const result = evaluateRound(slots);
      expect(result.totalSlots).toBe(2);
      expect(result.correctSlots).toBe(2);
      expect(result.ratio).toBe(1);
      expect(result.incorrectComponents).toHaveLength(0);
    });

    it('should return 0 score when all slots are wrong', () => {
      const slots: SlotState[] = [
        { componentId: 'c1', expectedChar: '亻', selectedChar: '人', isCorrect: false },
        { componentId: 'c2', expectedChar: '木', selectedChar: '本', isCorrect: false },
      ];

      const result = evaluateRound(slots);
      expect(result.totalSlots).toBe(2);
      expect(result.correctSlots).toBe(0);
      expect(result.ratio).toBe(0);
      expect(result.incorrectComponents).toEqual(['亻', '木']);
    });

    it('should return partial score for mixed results', () => {
      const slots: SlotState[] = [
        { componentId: 'c1', expectedChar: '亻', selectedChar: '亻', isCorrect: true },
        { componentId: 'c2', expectedChar: '木', selectedChar: '本', isCorrect: false },
      ];

      const result = evaluateRound(slots);
      expect(result.totalSlots).toBe(2);
      expect(result.correctSlots).toBe(1);
      expect(result.ratio).toBe(0.5);
      expect(result.incorrectComponents).toEqual(['木']);
    });

    it('should handle empty slots array', () => {
      const result = evaluateRound([]);
      expect(result.totalSlots).toBe(0);
      expect(result.correctSlots).toBe(0);
      expect(result.ratio).toBe(0);
      expect(result.incorrectComponents).toHaveLength(0);
    });

    it('should handle single slot', () => {
      const slots: SlotState[] = [
        { componentId: 'c1', expectedChar: '人', selectedChar: '人', isCorrect: true },
      ];

      const result = evaluateRound(slots);
      expect(result.totalSlots).toBe(1);
      expect(result.correctSlots).toBe(1);
      expect(result.ratio).toBe(1);
    });

    it('should handle three slots', () => {
      const slots: SlotState[] = [
        { componentId: 'c1', expectedChar: '木', selectedChar: '木', isCorrect: true },
        { componentId: 'c2', expectedChar: '木', selectedChar: '本', isCorrect: false },
        { componentId: 'c3', expectedChar: '木', selectedChar: '木', isCorrect: true },
      ];

      const result = evaluateRound(slots);
      expect(result.totalSlots).toBe(3);
      expect(result.correctSlots).toBe(2);
      expect(result.ratio).toBeCloseTo(0.667, 2);
      expect(result.incorrectComponents).toEqual(['木']);
    });
  });

  describe('computeAccuracyRatio', () => {
    it('should return 0 for no attempts', () => {
      const score: ScoreData = {
        totalAttempts: 0,
        totalCorrect: 0,
        errorsByComponent: {},
      };
      expect(computeAccuracyRatio(score)).toBe(0);
    });

    it('should return 1 for perfect accuracy', () => {
      const score: ScoreData = {
        totalAttempts: 10,
        totalCorrect: 10,
        errorsByComponent: {},
      };
      expect(computeAccuracyRatio(score)).toBe(1);
    });

    it('should return correct ratio', () => {
      const score: ScoreData = {
        totalAttempts: 10,
        totalCorrect: 7,
        errorsByComponent: { '木': 2, '日': 1 },
      };
      expect(computeAccuracyRatio(score)).toBe(0.7);
    });

    it('should handle 0 correct out of many', () => {
      const score: ScoreData = {
        totalAttempts: 5,
        totalCorrect: 0,
        errorsByComponent: {},
      };
      expect(computeAccuracyRatio(score)).toBe(0);
    });
  });
});
