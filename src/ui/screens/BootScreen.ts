/**
 * BootScreen: initial screen with "Start" button.
 * Phase: BOOT
 */
export class BootScreen {
  private container: HTMLElement;
  private onStart: (() => void) | null = null;

  constructor(container: HTMLElement) {
    this.container = container;
  }

  setOnStart(callback: () => void): void {
    this.onStart = callback;
  }

  render(): void {
    this.container.innerHTML = '';
    this.container.classList.add('screen', 'screen--boot');

    const wrapper = document.createElement('div');
    wrapper.classList.add('boot-wrapper');

    const title = document.createElement('h1');
    title.classList.add('boot-title');
    title.textContent = 'Kanji Puzzle';
    wrapper.appendChild(title);

    const subtitle = document.createElement('p');
    subtitle.classList.add('boot-subtitle');
    subtitle.textContent = 'Learn kanji by assembling their components';
    wrapper.appendChild(subtitle);

    // Decorative kanji
    const deco = document.createElement('div');
    deco.classList.add('boot-deco');
    deco.textContent = '漢字';
    deco.setAttribute('aria-hidden', 'true');
    wrapper.appendChild(deco);

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.classList.add('btn', 'btn--primary', 'boot-start-btn');
    btn.textContent = 'Start';
    btn.setAttribute('aria-label', 'Start the kanji puzzle game');
    btn.addEventListener('click', () => this.onStart?.());
    wrapper.appendChild(btn);

    this.container.appendChild(wrapper);

    // Auto-focus start button
    requestAnimationFrame(() => btn.focus());
  }

  hide(): void {
    this.container.innerHTML = '';
  }
}
