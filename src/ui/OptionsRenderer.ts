import type { OptionItem } from '../controllers/GameController';

/**
 * OptionsRenderer: renders option buttons for element selection.
 * Each button shows the component character + its pedagogical label.
 * Pure buttons — NO drag&drop.
 */
export class OptionsRenderer {
  private container: HTMLElement;
  private onSelect: ((char: string) => void) | null = null;

  constructor(container: HTMLElement) {
    this.container = container;
    this.container.classList.add('options-panel');
    this.container.setAttribute('role', 'group');
    this.container.setAttribute('aria-label', 'Opciones de elemento');
  }

  /**
   * Set the callback for when user selects an option.
   */
  setOnSelect(callback: (char: string) => void): void {
    this.onSelect = callback;
  }

  /**
   * Render option buttons for the current slot.
   * Each option shows the component char (large) and its label (small).
   */
  renderOptions(options: OptionItem[], slotIndex: number): void {
    this.clear();
    this.container.setAttribute(
      'aria-label',
      `Elige el elemento #${slotIndex + 1}`,
    );

    const label = document.createElement('p');
    label.classList.add('options-panel__label');
    label.textContent = `Elige el elemento #${slotIndex + 1}:`;
    this.container.appendChild(label);

    const btnGroup = document.createElement('div');
    btnGroup.classList.add('options-panel__buttons');
    btnGroup.setAttribute('role', 'radiogroup');

    for (let i = 0; i < options.length; i++) {
      const opt = options[i];
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.classList.add('option-btn');

      // Character (large)
      const charSpan = document.createElement('span');
      charSpan.classList.add('option-btn__char');
      charSpan.textContent = opt.char;
      btn.appendChild(charSpan);

      // Label (small, below)
      const labelSpan = document.createElement('span');
      labelSpan.classList.add('option-btn__label');
      labelSpan.textContent = opt.label;
      btn.appendChild(labelSpan);

      btn.setAttribute('aria-label', `Elemento: ${opt.char} (${opt.label})`);
      btn.setAttribute('role', 'radio');
      btn.setAttribute('aria-checked', 'false');
      btn.tabIndex = i === 0 ? 0 : -1;

      btn.addEventListener('click', () => {
        this.onSelect?.(opt.char);
      });

      // Keyboard navigation: arrow keys between options
      btn.addEventListener('keydown', (e: KeyboardEvent) => {
        const buttons = Array.from(
          btnGroup.querySelectorAll<HTMLButtonElement>('.option-btn'),
        );
        const currentIdx = buttons.indexOf(btn);

        let nextIdx = -1;
        if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
          e.preventDefault();
          nextIdx = (currentIdx + 1) % buttons.length;
        } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
          e.preventDefault();
          nextIdx = (currentIdx - 1 + buttons.length) % buttons.length;
        } else if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          this.onSelect?.(opt.char);
          return;
        }

        if (nextIdx >= 0) {
          buttons[currentIdx].tabIndex = -1;
          buttons[nextIdx].tabIndex = 0;
          buttons[nextIdx].focus();
        }
      });

      btnGroup.appendChild(btn);
    }

    this.container.appendChild(btnGroup);

    // Auto-focus first button
    const firstBtn = btnGroup.querySelector<HTMLButtonElement>('.option-btn');
    if (firstBtn) {
      requestAnimationFrame(() => firstBtn.focus());
    }
  }

  /**
   * Show a "waiting" state when all slots are filled.
   */
  showAllFilled(): void {
    this.clear();
    const msg = document.createElement('p');
    msg.classList.add('options-panel__complete');
    msg.textContent = 'Todos los elementos puestos. Pulsa "Check".';
    this.container.appendChild(msg);
  }

  /**
   * Clear options.
   */
  clear(): void {
    this.container.innerHTML = '';
  }
}
