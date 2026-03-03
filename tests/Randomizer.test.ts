import { describe, it, expect } from 'vitest';
import { generateOptions, shuffle, pickRandomWord, pickTargetKanji } from '../src/services/Randomizer';
import type { ConfusablesMap } from '../src/services/DataLoader';

describe('Randomizer', () => {
  describe('shuffle', () => {
    it('should return same length array', () => {
      const arr = [1, 2, 3, 4, 5];
      const result = shuffle([...arr]);
      expect(result).toHaveLength(arr.length);
    });

    it('should contain all original elements', () => {
      const arr = ['a', 'b', 'c', 'd'];
      const result = shuffle([...arr]);
      expect(result.sort()).toEqual(arr.sort());
    });

    it('should handle empty array', () => {
      expect(shuffle([])).toEqual([]);
    });

    it('should handle single element', () => {
      expect(shuffle([42])).toEqual([42]);
    });
  });

  describe('generateOptions', () => {
    const allChars = ['亻', '木', '日', '月', '人', '口', '山', '水', '火', '金'];
    const confusables: ConfusablesMap = {
      '亻': ['イ', '彳', '人'],
      '木': ['本', '末', '未'],
      '日': ['目', '白', '田'],
    };

    it('should always include the correct answer', () => {
      for (let i = 0; i < 20; i++) {
        const options = generateOptions('亻', allChars, confusables);
        expect(options).toContain('亻');
      }
    });

    it('should return exactly 4 options by default', () => {
      const options = generateOptions('亻', allChars, confusables);
      expect(options).toHaveLength(4);
    });

    it('should have no duplicates', () => {
      for (let i = 0; i < 20; i++) {
        const options = generateOptions('木', allChars, confusables);
        const unique = new Set(options);
        expect(unique.size).toBe(options.length);
      }
    });

    it('should use confusables when available', () => {
      // Run many times and check if confusables appear
      let confusableUsed = false;
      for (let i = 0; i < 50; i++) {
        const options = generateOptions('亻', allChars, confusables);
        const distractors = options.filter((o) => o !== '亻');
        if (distractors.some((d) => ['イ', '彳', '人'].includes(d))) {
          confusableUsed = true;
          break;
        }
      }
      expect(confusableUsed).toBe(true);
    });

    it('should work without confusables', () => {
      const options = generateOptions('山', allChars, {});
      expect(options).toContain('山');
      expect(options).toHaveLength(4);
      const unique = new Set(options);
      expect(unique.size).toBe(4);
    });

    it('should handle small pool gracefully', () => {
      const smallPool = ['亻', '木'];
      const options = generateOptions('亻', smallPool, {});
      expect(options).toContain('亻');
      // May have fewer than 4 if pool is too small
      expect(options.length).toBeGreaterThanOrEqual(1);
      expect(options.length).toBeLessThanOrEqual(4);
    });
  });

  describe('pickRandomWord', () => {
    const words = [
      { id: 'w1', kanji: ['人', '口'], reading: 'じんこう', meaning: 'population' },
      { id: 'w2', kanji: ['休', '日'], reading: 'きゅうじつ', meaning: 'holiday' },
      { id: 'w3', kanji: ['山', '林'], reading: 'さんりん', meaning: 'forest' },
    ];

    it('should return a word from the list', () => {
      const word = pickRandomWord(words);
      expect(words).toContainEqual(word);
    });

    it('should avoid recently seen words when possible', () => {
      const recentIds = ['w1', 'w2'];
      let gotW3 = false;
      // Run many times to check it prefers w3
      for (let i = 0; i < 50; i++) {
        const word = pickRandomWord(words, recentIds);
        if (word.id === 'w3') gotW3 = true;
      }
      expect(gotW3).toBe(true);
    });

    it('should still return a word even if all are recently seen', () => {
      const recentIds = ['w1', 'w2', 'w3'];
      const word = pickRandomWord(words, recentIds);
      expect(word).toBeDefined();
      expect(words).toContainEqual(word);
    });
  });

  describe('pickTargetKanji', () => {
    const decompositions = {
      '休': {
        components: [
          { char: '亻' },
          { char: '木' },
        ],
      },
      '人': {
        components: [
          { char: '人' },
        ],
      },
    };

    it('should prefer multi-component kanji', () => {
      let pickedMulti = false;
      for (let i = 0; i < 50; i++) {
        const result = pickTargetKanji(['休', '人'], decompositions);
        if (result === '休') pickedMulti = true;
      }
      expect(pickedMulti).toBe(true);
    });

    it('should return null for empty array', () => {
      expect(pickTargetKanji([], decompositions)).toBeNull();
    });

    it('should return the kanji string', () => {
      const result = pickTargetKanji(['休'], decompositions);
      expect(result).toBe('休');
    });
  });
});
