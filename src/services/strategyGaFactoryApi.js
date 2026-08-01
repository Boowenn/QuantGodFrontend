import { fetchJson, postCommandJson } from './apiClient.js';

const BASE = '/api/strategy-ga-factory';

export function fetchStrategyGaFactoryStatus(options = {}) {
  return fetchJson(`${BASE}/status`, null, options);
}

export function buildStrategyGaFactory() {
  return postCommandJson(`${BASE}/build`, { focusSymbol: 'USDJPYc' });
}

export function fetchStrategyFactoryIntentPlan(options = {}) {
  return fetchJson(`${BASE}/intent-plan`, null, options);
}

export function buildStrategyFactoryIntentPlan({ prompt = '' } = {}) {
  const query = prompt ? `?prompt=${encodeURIComponent(prompt)}` : '';
  return postCommandJson(`${BASE}/intent-plan/build${query}`, { focusSymbol: 'USDJPYc', prompt });
}

export function fetchStrategyGaFactoryTelegramText({ refresh = false } = {}) {
  const query = refresh ? '?refresh=1' : '';
  return fetchJson(`${BASE}/telegram-text${query}`);
}
