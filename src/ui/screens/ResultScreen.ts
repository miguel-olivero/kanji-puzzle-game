import { getGlobalAccuracy, getMostErrorProne } from '../../services/Scoring';
import { loadProgress } from '../../services/Storage';

/**
 * ResultScreen: displays overall statistics.
 * Accessible from game screen or after rounds.
 */
export class ResultScreen {
  private container: HTMLElement;

  constructor(container: HTMLElement) {
    this.container = container;
  }

  render(): void {
    this.container.innerHTML = '';
    this.container.classList.add('screen', 'screen--results');

    const wrapper = document.createElement('div');
    wrapper.classList.add('results-wrapper');

    const title = document.createElement('h2');
    title.textContent = 'Your Progress';
    wrapper.appendChild(title);

    // Global accuracy
    const accuracy = getGlobalAccuracy();
    const accEl = document.createElement('div');
    accEl.classList.add('results-stat');
    accEl.innerHTML = `<span class="results-stat__label">Global Accuracy</span>
      <span class="results-stat__value">${Math.round(accuracy * 100)}%</span>`;
    wrapper.appendChild(accEl);

    // Progress
    const progress = loadProgress();
    const progEl = document.createElement('div');
    progEl.classList.add('results-stat');
    progEl.innerHTML = `<span class="results-stat__label">Words Completed</span>
      <span class="results-stat__value">${progress.wordsCompleted.length} / ${progress.wordsSeen.length} seen</span>`;
    wrapper.appendChild(progEl);

    // Most error-prone components
    const errors = getMostErrorProne();
    if (errors.length > 0) {
      const errTitle = document.createElement('h3');
      errTitle.textContent = 'Components to Review';
      wrapper.appendChild(errTitle);

      const list = document.createElement('ul');
      list.classList.add('results-errors');
      for (const e of errors.slice(0, 10)) {
        const li = document.createElement('li');
        li.textContent = `${e.char} — ${e.errors} error${e.errors !== 1 ? 's' : ''}`;
        list.appendChild(li);
      }
      wrapper.appendChild(list);
    }

    this.container.appendChild(wrapper);
  }

  hide(): void {
    this.container.innerHTML = '';
  }
}
