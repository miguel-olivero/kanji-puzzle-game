/**
 * OptionsRenderer: renders option buttons for slot selection.
 * Pure buttons — NO drag&drop.
 */
export class OptionsRenderer {
  private container: HTMLElement;
  private onSelect: ((char: string) => void) | null = null;

  constructor(container: HTMLElement) {
    this.container = container;
    this.container.classList.add('options-panel');
    this.container.setAttribute('role', 'group');
    this.container.setAttribute('aria-label', 'Component options');
  }

  /**
   * Set the callback for when user selects an option.
   */
  setOnSelect(callback: (char: string) => void): void {
    this.onSelect = callback;
  }

  /**
   * Render option buttons for the current slot.
   */
  renderOptions(options: string[], slotIndex: number): void {
    this.clear();
    this.container.setAttribute(
      'aria-label',
      `Choose component for slot ${slotIndex + 1}`,
    );

    const label = document.createElement('p');
    label.classList.add('options-panel__label');
    label.textContent = `Select component #${slotIndex + 1}:`;
    this.container.appendChild(label);

    const btnGroup = document.createElement('div');
    btnGroup.classList.add('options-panel__buttons');
    btnGroup.setAttribute('role', 'radiogroup');

    for (let i = 0; i < options.length; i++) {
      const char = options[i];
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.classList.add('option-btn');
      btn.textContent = char;
      btn.setAttribute('aria-label', `Component option: ${char}`);
      btn.setAttribute('role', 'radio');
      btn.setAttribute('aria-checked', 'false');
      btn.tabIndex = i === 0 ? 0 : -1;

      btn.addEventListener('click', () => {
        this.onSelect?.(char);
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
          this.onSelect?.(char);
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
    msg.textContent = 'All slots filled. Press "Check" to verify.';
    this.container.appendChild(msg);
  }

  /**
   * Clear options.
   */
  clear(): void {
    this.container.innerHTML = '';
  }
}
