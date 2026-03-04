import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getAllComponentChars, registerManualDecomp } from '../src/services/DataLoader';
import type { DecompMap } from '../src/services/DataLoader';

describe('DataLoader', () => {
  describe('getAllComponentChars', () => {
    it('should extract all unique component chars from decomp map', () => {
      const decomps: DecompMap = {
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
      };

      const chars = getAllComponentChars(decomps);
      expect(chars).toContain('亻');
      expect(chars).toContain('木');
      expect(chars).toContain('日');
      expect(chars).toContain('月');
      expect(chars).toHaveLength(4);
    });

    it('should deduplicate component chars', () => {
      const decomps: DecompMap = {
        '林': {
          components: [
            { id: 'c1', char: '木', label: 'árbol', label_en: 'tree', slot_id: 'left', order_index: 0, bounds: { x: 0, y: 0, w: 0.5, h: 1 } },
            { id: 'c2', char: '木', label: 'árbol', label_en: 'tree', slot_id: 'right', order_index: 1, bounds: { x: 0.5, y: 0, w: 0.5, h: 1 } },
          ],
          layout: '⿰',
        },
      };

      const chars = getAllComponentChars(decomps);
      expect(chars).toEqual(['木']);
    });

    it('should return empty array for empty decomp map', () => {
      const chars = getAllComponentChars({});
      expect(chars).toHaveLength(0);
    });
  });

  describe('registerManualDecomp', () => {
    it('should be a callable function', () => {
      expect(typeof registerManualDecomp).toBe('function');
    });

    it('should not throw when registering a decomposition', () => {
      expect(() => {
        registerManualDecomp('新', {
          components: [
            { id: 'mc1', char: '立', label: 'estar de pie', label_en: 'stand', slot_id: 'top-left', order_index: 0, bounds: { x: 0, y: 0, w: 0.4, h: 0.5 } },
            { id: 'mc2', char: '木', label: 'árbol', label_en: 'tree', slot_id: 'bottom-left', order_index: 1, bounds: { x: 0, y: 0.5, w: 0.4, h: 0.5 } },
            { id: 'mc3', char: '斤', label: 'hacha', label_en: 'axe', slot_id: 'right', order_index: 2, bounds: { x: 0.4, y: 0, w: 0.6, h: 1 } },
          ],
          layout: '⿰',
        });
      }).not.toThrow();
    });
  });
});
