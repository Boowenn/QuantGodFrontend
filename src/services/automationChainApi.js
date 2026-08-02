import { fetchJson, postCommandJson } from './apiClient.js';

const USDJPY_SCOPE = 'symbols=USDJPYc';

export function fetchAutomationChainStatus() {
  return fetchJson(`/api/automation-chain/status?${USDJPY_SCOPE}`);
}

export function runAutomationChain({ send = false } = {}) {
  return postCommandJson(`/api/automation-chain/run?${USDJPY_SCOPE}`, {
    send: Boolean(send),
    dryRun: !send,
  });
}

export function fetchAutomationChainTelegramText({ refresh = false } = {}) {
  const query = refresh ? `?${USDJPY_SCOPE}&refresh=1` : `?${USDJPY_SCOPE}`;
  return fetchJson(`/api/automation-chain/telegram-text${query}`);
}
