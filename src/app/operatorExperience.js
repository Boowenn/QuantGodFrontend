import { t } from '../i18n/index.js';

const THEME_KEY = 'quantgod.ui.theme';
const LOCALE_KEY = 'quantgod.ui.locale';

const WORKSPACES = [
  { key: 'dashboard', hotkey: 'd', zh: '总览', en: 'Dashboard' },
  { key: 'mt5', hotkey: 'm', zh: 'MT5 复核', en: 'MT5 Monitor' },
  { key: 'evolution', hotkey: 'e', zh: '策略进化', en: 'Evolution' },
];

function safeSet(key, value) {
  try {
    window.localStorage.setItem(key, value);
  } catch (_) {
    // Local storage is optional. UI controls continue to work for the current session.
  }
}

function currentLocale() {
  return 'zh-CN';
}

function applyTheme() {
  const next = 'dark';
  document.documentElement.dataset.theme = next;
  safeSet(THEME_KEY, next);
  return next;
}

function applyLocale() {
  const next = 'zh-CN';
  document.documentElement.dataset.locale = next;
  document.documentElement.lang = next;
  safeSet(LOCALE_KEY, next);
  return next;
}

function navigateWorkspace(key) {
  const url = new URL(window.location.href);
  url.searchParams.set('workspace', key);
  window.history.pushState({ workspace: key }, '', `${url.pathname}${url.search}${url.hash}`);
  window.dispatchEvent(new PopStateEvent('popstate', { state: { workspace: key } }));
}

function createButton(label, title, onClick) {
  const button = document.createElement('button');
  button.type = 'button';
  button.textContent = label;
  button.title = title;
  button.addEventListener('click', onClick);
  return button;
}

function workspaceLabel(workspace) {
  return workspace.zh;
}

function updateControlsText(root, locale) {
  const searchButton = root.querySelector('[data-qg-control="search"]');
  const helpButton = root.querySelector('[data-qg-control="help"]');
  if (searchButton) searchButton.textContent = t('operator.searchShort', locale);
  if (helpButton) helpButton.textContent = '?';
}

function createPalette() {
  const palette = document.createElement('div');
  palette.className = 'qg-command-palette';
  palette.hidden = true;
  palette.innerHTML = `
    <div class="qg-command-palette__panel" role="dialog" aria-modal="true" aria-label="QuantGod command palette">
      <div class="qg-command-palette__header">
        <div>
          <strong data-qg-palette-title></strong>
          <p class="qg-text-muted" data-qg-palette-help style="margin:4px 0 0"></p>
        </div>
        <button type="button" data-qg-palette-close>Esc</button>
      </div>
      <input data-qg-palette-input type="search" autocomplete="off" />
      <div class="qg-command-palette__list" data-qg-palette-list></div>
    </div>
  `;
  document.body.appendChild(palette);
  return palette;
}

function renderPalette(palette, query = '') {
  const locale = currentLocale();
  const input = palette.querySelector('[data-qg-palette-input]');
  const list = palette.querySelector('[data-qg-palette-list]');
  const title = palette.querySelector('[data-qg-palette-title]');
  const help = palette.querySelector('[data-qg-palette-help]');
  title.textContent = t('operator.paletteTitle', locale);
  help.textContent = t('operator.paletteHelp', locale);
  input.placeholder = t('operator.palettePlaceholder', locale);
  list.innerHTML = '';

  const normalized = String(query || '')
    .trim()
    .toLowerCase();
  const matches = WORKSPACES.filter((workspace) => {
    const haystack = `${workspace.key} ${workspace.zh} ${workspace.en} ${workspace.hotkey}`.toLowerCase();
    return !normalized || haystack.includes(normalized);
  });

  for (const workspace of matches) {
    const item = document.createElement('button');
    item.type = 'button';
    item.className = 'qg-command-palette__item';
    item.innerHTML = `
      <span>
        <strong>${workspaceLabel(workspace, locale)}</strong>
        <small>${t('operator.openWorkspace', locale)} · ${workspace.key}</small>
      </span>
      <kbd>g ${workspace.hotkey}</kbd>
    `;
    item.addEventListener('click', () => {
      navigateWorkspace(workspace.key);
      closePalette(palette);
    });
    list.appendChild(item);
  }

  if (!matches.length) {
    const empty = document.createElement('div');
    empty.className = 'qg-state-card';
    empty.innerHTML = `<strong>${t('operator.noCommand', locale)}</strong><p>${t('operator.noCommandHint', locale)}</p>`;
    list.appendChild(empty);
  }
}

function openPalette(palette) {
  palette.hidden = false;
  renderPalette(palette, '');
  const input = palette.querySelector('[data-qg-palette-input]');
  window.setTimeout(() => input?.focus(), 0);
}

function closePalette(palette) {
  palette.hidden = true;
}

function isTypingTarget(target) {
  const tag = target?.tagName?.toLowerCase?.();
  return tag === 'input' || tag === 'textarea' || tag === 'select' || target?.isContentEditable;
}

function installKeyboard(palette, controls) {
  let pendingG = false;
  let timer = null;

  function clearPending() {
    pendingG = false;
    controls.dataset.pendingShortcut = '';
    if (timer) window.clearTimeout(timer);
    timer = null;
  }

  window.addEventListener('keydown', (event) => {
    if (isTypingTarget(event.target)) return;

    if (event.key === 'Escape' && !palette.hidden) {
      event.preventDefault();
      closePalette(palette);
      return;
    }

    if (event.key === '/') {
      event.preventDefault();
      openPalette(palette);
      return;
    }

    if (event.key === '?') {
      event.preventDefault();
      openPalette(palette);
      return;
    }

    const key = event.key.toLowerCase();
    if (pendingG) {
      const workspace = WORKSPACES.find((item) => item.hotkey === key);
      clearPending();
      if (workspace) {
        event.preventDefault();
        navigateWorkspace(workspace.key);
      }
      return;
    }

    if (key === 'g') {
      pendingG = true;
      controls.dataset.pendingShortcut = 'g';
      timer = window.setTimeout(clearPending, 1400);
    }
  });

  palette.querySelector('[data-qg-palette-input]')?.addEventListener('input', (event) => {
    renderPalette(palette, event.target.value);
  });

  palette.querySelector('[data-qg-palette-close]')?.addEventListener('click', () => closePalette(palette));
  palette.addEventListener('click', (event) => {
    if (event.target === palette) closePalette(palette);
  });
}

export function installOperatorExperience() {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;
  if (document.querySelector('[data-qg-operator-experience]')) return;

  applyTheme();
  const initialLocale = applyLocale(currentLocale());

  const controls = document.createElement('div');
  controls.className = 'qg-operator-controls';
  controls.dataset.qgOperatorExperience = 'true';

  const search = createButton(
    t('operator.searchShort', initialLocale),
    t('operator.searchHelp', initialLocale),
    () => openPalette(palette),
  );
  search.dataset.qgControl = 'search';

  const help = createButton('?', t('operator.helpHelp', initialLocale), () => openPalette(palette));
  help.dataset.qgControl = 'help';

  controls.append(search, help);
  document.body.appendChild(controls);

  const palette = createPalette();
  updateControlsText(controls, initialLocale);
  installKeyboard(palette, controls);
}
