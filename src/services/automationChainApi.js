import { fetchJson, postCommandJson } from './apiClient.js';

const USDJPY_SCOPE = 'symbols=USDJPYc';

export function fetchAutomationChainStatus() {
  return fetchJson(`/api/automation-chain/status?${USDJPY_SCOPE}`);
}

export function runAutomationChain({ send = false } = {}) {
  const query = send ? `?${USDJPY_SCOPE}&send=1` : `?${USDJPY_SCOPE}`;
  return postCommandJson(`/api/automation-chain/run${query}`, {});
}

export function fetchAutomationChainTelegramText({ refresh = false } = {}) {
  const query = refresh ? `?${USDJPY_SCOPE}&refresh=1` : `?${USDJPY_SCOPE}`;
  return fetchJson(`/api/automation-chain/telegram-text${query}`);
}
