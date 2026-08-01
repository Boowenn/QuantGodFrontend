import { fetchJson, postCommandJson } from './apiClient.js';

export function fetchProductionEvidenceStatus(options = {}) {
  return fetchJson('/api/production-evidence-validation/status', null, options);
}

export function runProductionEvidenceValidation() {
  return postCommandJson('/api/production-evidence-validation/run', {});
}

export function fetchProductionEvidenceTelegramText(refresh = false) {
  const suffix = refresh ? '?refresh=1' : '';
  return fetchJson(`/api/production-evidence-validation/telegram-text${suffix}`);
}
