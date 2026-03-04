import { hasConsent, saveConsent, revokeConsent } from '../services/Storage';
import { CONFIG } from '../config';

/**
 * CMPBanner: Consent Management Platform banner.
 *
 * EU compliance:
 * - "Reject All" equally prominent as "Accept All" (same size, same color base)
 * - NO dark patterns
 * - Game works 100% without accepting non-essential categories
 * - Consent can be revoked at any time from the privacy link
 */
export class CMPBanner {
  private container: HTMLElement;
  private onConsentGiven: (() => void) | null = null;

  constructor(container: HTMLElement) {
    this.container = container;
  }

  /** Set callback for when consent is resolved (accept or reject) */
  setOnConsentGiven(callback: () => void): void {
    this.onConsentGiven = callback;
  }

  /** Show the banner if consent hasn't been given yet */
  showIfNeeded(): boolean {
    if (hasConsent()) {
      return false; // Already has consent, no need to show
    }
    this.render();
    return true;
  }

  /** Render the CMP banner */
  private render(): void {
    this.container.innerHTML = '';
    this.container.classList.add('cmp-banner');
    this.container.setAttribute('role', 'dialog');
    this.container.setAttribute('aria-label', 'Cookie and storage consent');
    this.container.setAttribute('aria-modal', 'false');

    const content = document.createElement('div');
    content.classList.add('cmp-banner__content');

    const text = document.createElement('p');
    text.classList.add('cmp-banner__text');
    text.textContent =
      'This game uses local storage (not cookies) to save your progress. ' +
      'No personal data is collected or sent to third parties.';
    content.appendChild(text);

    const buttons = document.createElement('div');
    buttons.classList.add('cmp-banner__buttons');

    // Accept All — same prominence as Reject
    const acceptBtn = document.createElement('button');
    acceptBtn.type = 'button';
    acceptBtn.classList.add('cmp-btn', 'cmp-btn--accept');
    acceptBtn.textContent = 'Accept All';
    acceptBtn.setAttribute('aria-label', 'Accept all storage categories');
    acceptBtn.addEventListener('click', () => {
      saveConsent([CONFIG.CMP.CATEGORIES.ESSENTIAL, CONFIG.CMP.CATEGORIES.ANALYTICS]);
      this.hide();
      this.onConsentGiven?.();
    });

    // Reject All — SAME size and color base as Accept (no dark patterns)
    const rejectBtn = document.createElement('button');
    rejectBtn.type = 'button';
    rejectBtn.classList.add('cmp-btn', 'cmp-btn--reject');
    rejectBtn.textContent = 'Reject All';
    rejectBtn.setAttribute('aria-label', 'Reject all non-essential storage');
    rejectBtn.addEventListener('click', () => {
      saveConsent([CONFIG.CMP.CATEGORIES.ESSENTIAL]);
      this.hide();
      this.onConsentGiven?.();
    });

    // Configure
    const configBtn = document.createElement('button');
    configBtn.type = 'button';
    configBtn.classList.add('cmp-btn', 'cmp-btn--configure');
    configBtn.textContent = 'Configure';
    configBtn.setAttribute('aria-label', 'Configure storage preferences');
    configBtn.addEventListener('click', () => {
      this.showConfigPanel();
    });

    buttons.appendChild(acceptBtn);
    buttons.appendChild(rejectBtn);
    buttons.appendChild(configBtn);
    content.appendChild(buttons);
    this.container.appendChild(content);
    this.container.hidden = false;
  }

  /** Show detailed configuration panel */
  private showConfigPanel(): void {
    this.container.innerHTML = '';

    const panel = document.createElement('div');
    panel.classList.add('cmp-config');

    const title = document.createElement('h3');
    title.textContent = 'Storage Preferences';
    panel.appendChild(title);

    // Essential — always on
    const essentialRow = this.createCategoryRow(
      'Essential',
      'Saves your game progress locally. Required for the game to work.',
      true,
      true, // always checked, disabled
    );
    panel.appendChild(essentialRow);

    // Analytics — optional
    let analyticsChecked = false;
    const analyticsRow = this.createCategoryRow(
      'Analytics',
      'Usage statistics (not currently implemented). No data is sent externally.',
      false,
      false,
    );
    const checkbox = analyticsRow.querySelector('input');
    if (checkbox) {
      checkbox.addEventListener('change', () => {
        analyticsChecked = (checkbox as HTMLInputElement).checked;
      });
    }
    panel.appendChild(analyticsRow);

    // Save button
    const saveBtn = document.createElement('button');
    saveBtn.type = 'button';
    saveBtn.classList.add('cmp-btn', 'cmp-btn--accept');
    saveBtn.textContent = 'Save Preferences';
    saveBtn.addEventListener('click', () => {
      const categories: string[] = [CONFIG.CMP.CATEGORIES.ESSENTIAL];
      if (analyticsChecked) {
        categories.push(CONFIG.CMP.CATEGORIES.ANALYTICS);
      }
      saveConsent(categories);
      this.hide();
      this.onConsentGiven?.();
    });
    panel.appendChild(saveBtn);

    this.container.appendChild(panel);
  }

  /** Create a category row with label, description, and checkbox */
  private createCategoryRow(
    label: string,
    description: string,
    checked: boolean,
    disabled: boolean,
  ): HTMLElement {
    const row = document.createElement('div');
    row.classList.add('cmp-config__row');

    const labelEl = document.createElement('label');
    labelEl.classList.add('cmp-config__label');

    const cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.checked = checked;
    cb.disabled = disabled;
    cb.setAttribute('aria-label', `${label} storage`);

    const nameEl = document.createElement('span');
    nameEl.classList.add('cmp-config__name');
    nameEl.textContent = label;
    if (disabled) {
      nameEl.textContent += ' (required)';
    }

    labelEl.appendChild(cb);
    labelEl.appendChild(nameEl);
    row.appendChild(labelEl);

    const desc = document.createElement('p');
    desc.classList.add('cmp-config__desc');
    desc.textContent = description;
    row.appendChild(desc);

    return row;
  }

  /** Hide the banner */
  private hide(): void {
    this.container.hidden = true;
    this.container.innerHTML = '';
  }
}

/**
 * Render the privacy modal content.
 * Used by both #/privacy and #/cookies routes.
 */
export function renderPrivacyModal(container: HTMLElement): void {
  container.innerHTML = '';
  container.classList.add('privacy-modal');

  const content = document.createElement('div');
  content.classList.add('privacy-modal__content');

  content.innerHTML = `
    <h2>Privacy & Local Storage Policy</h2>
    <p><strong>Version ${CONFIG.CMP.POLICY_VERSION}</strong></p>

    <h3>What we store</h3>
    <ul>
      <li><strong>Game progress</strong>: words you've seen and completed, stored in your browser's localStorage.</li>
      <li><strong>Score data</strong>: accuracy statistics, stored in localStorage.</li>
      <li><strong>Consent record</strong>: your privacy preferences, stored in localStorage.</li>
    </ul>

    <h3>What we do NOT do</h3>
    <ul>
      <li>We do <strong>not use cookies</strong>. Only localStorage for your progress.</li>
      <li>We do <strong>not send data</strong> to any server. Everything stays in your browser.</li>
      <li>We do <strong>not use analytics or tracking</strong> by default.</li>
      <li>We do <strong>not collect personal data</strong>.</li>
    </ul>

    <h3>Third parties</h3>
    <p>If hosted on GitHub Pages, the CDN (GitHub/Fastly) may log standard HTTP access data
       (IP address, user agent) as part of normal web server operation. We have no control
       over this and do not access these logs.</p>

    <h3>Your rights</h3>
    <p>You can revoke your consent at any time by clicking the button below, or by
       clearing your browser's localStorage for this site.</p>
  `;

  const revokeBtn = document.createElement('button');
  revokeBtn.type = 'button';
  revokeBtn.classList.add('cmp-btn', 'cmp-btn--reject');
  revokeBtn.textContent = 'Revoke Consent & Clear Data';
  revokeBtn.setAttribute('aria-label', 'Revoke consent and clear all stored data');
  revokeBtn.addEventListener('click', () => {
    revokeConsent();
    const msg = document.createElement('p');
    msg.classList.add('privacy-modal__confirmed');
    msg.textContent = 'Consent revoked. All local data has been cleared.';
    content.appendChild(msg);
    revokeBtn.disabled = true;
  });
  content.appendChild(revokeBtn);

  const backLink = document.createElement('a');
  backLink.href = '#/';
  backLink.classList.add('privacy-modal__back');
  backLink.textContent = 'Back to game';
  content.appendChild(backLink);

  container.appendChild(content);
}
