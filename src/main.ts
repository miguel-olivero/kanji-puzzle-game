import { GameController } from './controllers/GameController';
import type { GameEvent } from './controllers/GameController';
import { BootScreen } from './ui/screens/BootScreen';
import { GameScreen } from './ui/screens/GameScreen';
import { CMPBanner, renderPrivacyModal } from './ui/CMPBanner';
import { Router } from './ui/Router';
import './styles.css';

/** Application entry point */
function main(): void {
  const appEl = document.getElementById('app');
  if (!appEl) {
    throw new Error('Missing #app element');
  }

  // Create persistent containers
  const screenContainer = document.createElement('div');
  screenContainer.id = 'screen-container';
  appEl.appendChild(screenContainer);

  const bannerContainer = document.createElement('div');
  bannerContainer.id = 'cmp-container';
  appEl.appendChild(bannerContainer);

  const footerEl = document.createElement('footer');
  footerEl.classList.add('app-footer');
  footerEl.innerHTML = `<a href="#/privacy" class="footer-link" aria-label="Privacy and cookies policy">Privacy / Cookies</a>`;
  appEl.appendChild(footerEl);

  // Initialize components
  const controller = new GameController();
  const bootScreen = new BootScreen(screenContainer);
  const gameScreen = new GameScreen(screenContainer);
  const cmpBanner = new CMPBanner(bannerContainer);
  const router = new Router();

  // ─── CMP Banner ────────────────────────────────────
  cmpBanner.setOnConsentGiven(() => {
    // Game works regardless of consent choice
  });

  // ─── Game event handling ───────────────────────────
  controller.on((event: GameEvent) => {
    switch (event.type) {
      case 'PHASE_CHANGED':
        // When we reach READY (after LOADING_DATA → READY), start the first round
        if (event.phase === 'READY') {
          gameScreen.render();
          controller.startRound();
        }
        break;

      case 'DATA_LOADED':
        // Data is loaded; the controller will transition to READY next,
        // which triggers startRound via PHASE_CHANGED above.
        break;

      case 'ROUND_STARTED':
        gameScreen.startRound(
          event.word,
          event.round.targetKanji,
          event.decomposition,
          event.options,
          event.round,
        );
        break;

      case 'SLOT_FILLED': {
        const round = event.round;
        const filledSlot = round.slots[event.slotIndex];
        gameScreen.slotFilled(
          filledSlot.componentId,
          event.char,
          round,
          event.nextOptions,
        );
        break;
      }

      case 'ROUND_CHECKED':
        controller.showResult();
        gameScreen.showCheckResult(event.round, event.result);
        break;

      case 'ERROR':
        showError(screenContainer, event.message);
        break;
    }
  });

  // ─── Screen callbacks ─────────────────────────────
  bootScreen.setOnStart(() => {
    controller.start();
    gameScreen.showLoading();
  });

  gameScreen.setOnOptionSelect((char: string) => {
    controller.selectOption(char);
  });

  gameScreen.setOnCheck(() => {
    controller.checkRound();
  });

  gameScreen.setOnNext(() => {
    controller.next();
    controller.startRound();
  });

  // ─── Router ────────────────────────────────────────
  router.on('/', () => {
    if (controller.getPhase() === 'BOOT') {
      bootScreen.render();
      cmpBanner.showIfNeeded();
    }
  });

  router.on('/privacy', () => {
    renderPrivacyModal(screenContainer);
  });

  router.on('/cookies', () => {
    renderPrivacyModal(screenContainer);
  });

  router.setDefault(() => {
    router.navigate('/');
  });

  // Start
  router.start();
}

/** Show an error message on screen */
function showError(container: HTMLElement, message: string): void {
  const errEl = document.createElement('div');
  errEl.classList.add('error-message');
  errEl.setAttribute('role', 'alert');
  errEl.textContent = `Error: ${message}`;
  container.appendChild(errEl);
}

// Wait for DOM
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', main);
} else {
  main();
}
