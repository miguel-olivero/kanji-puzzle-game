import type { KanjiDecomposition, LayoutType, SlotState } from '../domain';

/** Enclosure layout types where outer/inner slots need special rendering */
const ENCLOSURE_LAYOUTS: ReadonlySet<LayoutType> = new Set(['⿴', '⿸', '⿺']);

/**
 * KanvasRenderer: renders the kanji decomposition grid using DIVs.
 * NO <canvas> — pure DOM with position:absolute slots.
 */
export class KanvasRenderer {
  private container: HTMLElement;
  private slotElements: Map<string, HTMLElement> = new Map();

  constructor(container: HTMLElement) {
    this.container = container;
    this.container.classList.add('kanvas');
    this.container.setAttribute('role', 'img');
    this.container.setAttribute('aria-label', 'Kanji component slots');
  }

  /**
   * Render the empty slots for a kanji decomposition.
   */
  renderSlots(decomposition: KanjiDecomposition, targetKanji: string): void {
    this.clear();
    this.container.setAttribute(
      'aria-label',
      `Kanji puzzle for ${targetKanji}`,
    );

    const isEnclosure = ENCLOSURE_LAYOUTS.has(decomposition.layout);

    // Sort components by order_index for rendering
    const sorted = [...decomposition.components].sort(
      (a, b) => a.order_index - b.order_index,
    );

    for (const comp of sorted) {
      const slot = document.createElement('div');
      slot.classList.add('kanvas-slot', 'kanvas-slot--empty');
      slot.dataset.componentId = comp.id;
      slot.dataset.slotId = comp.slot_id;
      slot.dataset.orderIndex = String(comp.order_index);

      // Position using bounds (0..1 → percentage)
      slot.style.position = 'absolute';
      slot.style.left = `${comp.bounds.x * 100}%`;
      slot.style.top = `${comp.bounds.y * 100}%`;
      slot.style.width = `${comp.bounds.w * 100}%`;
      slot.style.height = `${comp.bounds.h * 100}%`;

      // Enclosure layout: tag outer/inner slots with special classes
      if (isEnclosure) {
        const isOuter = comp.slot_id === 'outer';
        slot.classList.add(isOuter ? 'kanvas-slot--outer' : 'kanvas-slot--inner');

        // Add layout-specific modifier for positioning the outer character
        if (isOuter) {
          slot.dataset.layout = decomposition.layout;
          slot.classList.add(`kanvas-slot--layout-${layoutCssName(decomposition.layout)}`);
        }

        // Inner slot sits on top of outer (z-index layering)
        slot.style.zIndex = isOuter ? '1' : '2';
      }

      slot.setAttribute('aria-label', `Elemento ${comp.order_index + 1}: ${comp.label ?? comp.slot_id}`);
      slot.setAttribute('role', 'status');

      // Order number badge
      const badge = document.createElement('span');
      badge.classList.add('kanvas-slot__badge');
      badge.textContent = String(comp.order_index + 1);
      slot.appendChild(badge);

      // Char display (hidden until filled)
      const charEl = document.createElement('span');
      charEl.classList.add('kanvas-slot__char');
      charEl.textContent = '';
      slot.appendChild(charEl);

      this.container.appendChild(slot);
      this.slotElements.set(comp.id, slot);
    }
  }

  /** Map layout Unicode to a safe CSS class suffix */
  static layoutCssName = layoutCssName;

  /**
   * Fill a slot with a selected character.
   */
  fillSlot(componentId: string, char: string): void {
    const slot = this.slotElements.get(componentId);
    if (!slot) return;

    slot.classList.remove('kanvas-slot--empty');
    slot.classList.add('kanvas-slot--filled');

    const charEl = slot.querySelector('.kanvas-slot__char');
    if (charEl) {
      charEl.textContent = char;
    }

    slot.setAttribute('aria-label', `Elemento seleccionado: ${char}`);
  }

  /**
   * Mark a slot as correct or incorrect after checking.
   */
  markSlot(componentId: string, isCorrect: boolean, expectedChar: string): void {
    const slot = this.slotElements.get(componentId);
    if (!slot) return;

    slot.classList.remove('kanvas-slot--filled');
    slot.classList.add(
      isCorrect ? 'kanvas-slot--correct' : 'kanvas-slot--incorrect',
    );

    if (!isCorrect) {
      // Show correct char below
      const correction = document.createElement('span');
      correction.classList.add('kanvas-slot__correction');
      correction.textContent = expectedChar;
      slot.appendChild(correction);
    }

    const status = isCorrect ? 'correcto' : `incorrecto (esperado: ${expectedChar})`;
    slot.setAttribute('aria-label', `Elemento ${status}`);
  }

  /**
   * Highlight the current active slot.
   */
  highlightSlot(componentId: string): void {
    // Remove highlight from all
    for (const el of this.slotElements.values()) {
      el.classList.remove('kanvas-slot--active');
    }
    const slot = this.slotElements.get(componentId);
    if (slot) {
      slot.classList.add('kanvas-slot--active');
    }
  }

  /**
   * Apply results to all slots.
   */
  applyResults(slots: readonly SlotState[]): void {
    for (const s of slots) {
      if (s.isCorrect !== null) {
        this.markSlot(s.componentId, s.isCorrect, s.expectedChar);
      }
    }
  }

  /**
   * Clear all slots.
   */
  clear(): void {
    this.container.innerHTML = '';
    this.slotElements.clear();
  }
}

/** Map layout Unicode codepoints to CSS-safe class suffixes */
function layoutCssName(layout: LayoutType): string {
  switch (layout) {
    case '⿴': return 'enclosure';
    case '⿸': return 'topleft';
    case '⿺': return 'bottomleft';
    default:  return 'default';
  }
}
