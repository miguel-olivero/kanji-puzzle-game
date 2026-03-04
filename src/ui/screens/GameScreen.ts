import type { Word, KanjiDecomposition, Round } from '../../domain';
import type { OptionItem } from '../../controllers/GameController';
import type { RoundResult } from '../../services/Scoring';
import { getGlobalAccuracy } from '../../services/Scoring';
import { KanvasRenderer } from '../KanvasRenderer';
import { OptionsRenderer } from '../OptionsRenderer';

/**
 * GameScreen: main game view with kanvas, hint, options, and check button.
 * Phases: IN_ROUND, CHECKED, RESULT
 */
export class GameScreen {
  private container: HTMLElement;
  private kanvas: KanvasRenderer | null = null;
  private options: OptionsRenderer | null = null;
  private checkBtn: HTMLButtonElement | null = null;
  private nextBtn: HTMLButtonElement | null = null;
  private hintEl: HTMLElement | null = null;
  private scoreEl: HTMLElement | null = null;
  private resultEl: HTMLElement | null = null;

  private onOptionSelect: ((char: string) => void) | null = null;
  private onCheck: (() => void) | null = null;
  private onNext: (() => void) | null = null;

  constructor(container: HTMLElement) {
    this.container = container;
  }

  setOnOptionSelect(callback: (char: string) => void): void {
    this.onOptionSelect = callback;
  }

  setOnCheck(callback: () => void): void {
    this.onCheck = callback;
  }

  setOnNext(callback: () => void): void {
    this.onNext = callback;
  }

  /** Build the game screen layout */
  render(): void {
    this.container.innerHTML = '';
    this.container.classList.add('screen', 'screen--game');

    // Score display
    this.scoreEl = document.createElement('div');
    this.scoreEl.classList.add('game-score');
    this.updateScoreDisplay();
    this.container.appendChild(this.scoreEl);

    // Hint area
    this.hintEl = document.createElement('div');
    this.hintEl.classList.add('game-hint');
    this.hintEl.setAttribute('role', 'status');
    this.hintEl.setAttribute('aria-live', 'polite');
    this.container.appendChild(this.hintEl);

    // Kanvas container
    const kanvasEl = document.createElement('div');
    kanvasEl.classList.add('kanvas-container');
    this.container.appendChild(kanvasEl);
    this.kanvas = new KanvasRenderer(kanvasEl);

    // Options container
    const optionsEl = document.createElement('div');
    optionsEl.classList.add('options-container');
    this.container.appendChild(optionsEl);
    this.options = new OptionsRenderer(optionsEl);
    this.options.setOnSelect((char: string) => this.onOptionSelect?.(char));

    // Action buttons
    const actions = document.createElement('div');
    actions.classList.add('game-actions');

    this.checkBtn = document.createElement('button');
    this.checkBtn.type = 'button';
    this.checkBtn.classList.add('btn', 'btn--primary', 'btn--check');
    this.checkBtn.textContent = 'Check';
    this.checkBtn.disabled = true;
    this.checkBtn.setAttribute('aria-label', 'Check your answers');
    this.checkBtn.addEventListener('click', () => this.onCheck?.());
    actions.appendChild(this.checkBtn);

    this.nextBtn = document.createElement('button');
    this.nextBtn.type = 'button';
    this.nextBtn.classList.add('btn', 'btn--secondary', 'btn--next');
    this.nextBtn.textContent = 'Next Word';
    this.nextBtn.hidden = true;
    this.nextBtn.setAttribute('aria-label', 'Go to next word');
    this.nextBtn.addEventListener('click', () => this.onNext?.());
    actions.appendChild(this.nextBtn);

    this.container.appendChild(actions);

    // Result area
    this.resultEl = document.createElement('div');
    this.resultEl.classList.add('game-result');
    this.resultEl.hidden = true;
    this.resultEl.setAttribute('role', 'status');
    this.resultEl.setAttribute('aria-live', 'polite');
    this.container.appendChild(this.resultEl);
  }

  /** Show loading state */
  showLoading(): void {
    this.container.innerHTML = '';
    this.container.classList.add('screen', 'screen--loading');

    const loader = document.createElement('div');
    loader.classList.add('loading-spinner');

    const text = document.createElement('p');
    text.classList.add('loading-text');
    text.textContent = 'Loading kanji data...';
    text.setAttribute('aria-live', 'polite');

    this.container.appendChild(loader);
    this.container.appendChild(text);
  }

  /** Start a new round with hint and kanvas */
  startRound(
    word: Word,
    targetKanji: string,
    decomposition: KanjiDecomposition,
    options: OptionItem[],
    round: Round,
  ): void {
    if (!this.kanvas || !this.options || !this.hintEl) return;

    // Update hint — hide the target kanji so the player can't just copy it
    this.hintEl.innerHTML = '';

    // Build the masked word: replace the target kanji with its kana reading
    const hintWordEl = document.createElement('span');
    hintWordEl.classList.add('game-hint__word');

    for (let i = 0; i < word.kanji.length; i++) {
      const k = word.kanji[i];
      const span = document.createElement('span');
      if (k === targetKanji) {
        // Replace target kanji with its kana portion
        const kana = word.readingParts?.[i] ?? '？';
        span.textContent = kana;
        span.classList.add('game-hint__hidden-kanji');
      } else {
        span.textContent = k;
      }
      hintWordEl.appendChild(span);
    }
    this.hintEl.appendChild(hintWordEl);

    const hintReading = document.createElement('span');
    hintReading.classList.add('game-hint__reading');
    hintReading.textContent = ` （${word.reading}）`;
    this.hintEl.appendChild(hintReading);

    const hintMeaning = document.createElement('div');
    hintMeaning.classList.add('game-hint__meaning');
    hintMeaning.textContent = word.meaning;
    this.hintEl.appendChild(hintMeaning);

    // "Build:" label — show the kana reading of the target, NOT the kanji itself
    const targetIdx = word.kanji.indexOf(targetKanji);
    const targetKana = word.readingParts?.[targetIdx] ?? '？';
    const hintTarget = document.createElement('div');
    hintTarget.classList.add('game-hint__target');
    hintTarget.textContent = `Construye: ${targetKana}`;
    this.hintEl.appendChild(hintTarget);

    // Render kanvas slots
    this.kanvas.renderSlots(decomposition, targetKanji);

    // Highlight first slot
    if (round.slots.length > 0) {
      this.kanvas.highlightSlot(round.slots[0].componentId);
    }

    // Show options
    this.options.renderOptions(options, 0);

    // Reset buttons
    if (this.checkBtn) {
      this.checkBtn.disabled = true;
      this.checkBtn.hidden = false;
    }
    if (this.nextBtn) {
      this.nextBtn.hidden = true;
    }
    if (this.resultEl) {
      this.resultEl.hidden = true;
    }

    this.updateScoreDisplay();
  }

  /** Handle slot being filled */
  slotFilled(
    componentId: string,
    char: string,
    round: Round,
    nextOptions: OptionItem[] | null,
  ): void {
    if (!this.kanvas || !this.options) return;

    this.kanvas.fillSlot(componentId, char);

    if (nextOptions && round.currentSlotIndex < round.slots.length) {
      // More slots to fill
      const nextSlot = round.slots[round.currentSlotIndex];
      this.kanvas.highlightSlot(nextSlot.componentId);
      this.options.renderOptions(nextOptions, round.currentSlotIndex);
    } else {
      // All slots filled — enable check button
      this.options.showAllFilled();
      if (this.checkBtn) {
        this.checkBtn.disabled = false;
        this.checkBtn.focus();
      }
    }
  }

  /** Show check results */
  showCheckResult(round: Round, result: RoundResult): void {
    if (!this.kanvas) return;

    // Apply visual results to kanvas
    this.kanvas.applyResults(round.slots);

    // Reveal the solution kanji in the hint: replace the hidden kana with the actual kanji
    if (this.hintEl) {
      const hiddenSpan = this.hintEl.querySelector('.game-hint__hidden-kanji');
      if (hiddenSpan) {
        hiddenSpan.textContent = round.targetKanji;
        hiddenSpan.classList.remove('game-hint__hidden-kanji');
        hiddenSpan.classList.add('game-hint__revealed-kanji');
      }

      // Also update the "Build:" line to show the kanji
      const targetEl = this.hintEl.querySelector('.game-hint__target');
      if (targetEl) {
        targetEl.textContent = `Construye: ${round.targetKanji}`;
      }
    }

    // Hide check, show result and next
    if (this.checkBtn) {
      this.checkBtn.hidden = true;
    }

    if (this.resultEl) {
      this.resultEl.hidden = false;
      this.resultEl.innerHTML = '';

      const ratioPercent = Math.round(result.ratio * 100);

      const scoreText = document.createElement('p');
      scoreText.classList.add('game-result__score');
      scoreText.textContent = `${result.correctSlots}/${result.totalSlots} correct (${ratioPercent}%)`;
      this.resultEl.appendChild(scoreText);

      if (result.ratio === 1) {
        const perfect = document.createElement('p');
        perfect.classList.add('game-result__perfect');
        perfect.textContent = 'Perfect!';
        this.resultEl.appendChild(perfect);
      } else if (result.incorrectComponents.length > 0) {
        const missed = document.createElement('p');
        missed.classList.add('game-result__missed');
        missed.textContent = `Missed: ${result.incorrectComponents.join(', ')}`;
        this.resultEl.appendChild(missed);
      }
    }

    if (this.nextBtn) {
      this.nextBtn.hidden = false;
      requestAnimationFrame(() => this.nextBtn?.focus());
    }

    this.updateScoreDisplay();
  }

  /** Update score display */
  private updateScoreDisplay(): void {
    if (!this.scoreEl) return;
    const accuracy = getGlobalAccuracy();
    const percent = Math.round(accuracy * 100);
    this.scoreEl.textContent = `Accuracy: ${percent}%`;
  }

  hide(): void {
    this.container.innerHTML = '';
  }
}
