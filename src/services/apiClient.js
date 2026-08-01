const VITE_ENV = typeof import.meta !== 'undefined' && import.meta.env ? import.meta.env : {};

export const DEFAULT_TIMEOUT_MS = Number(VITE_ENV.VITE_QG_API_TIMEOUT_MS || 15000);
export const DEFAULT_COMMAND_TIMEOUT_MS = Number(VITE_ENV.VITE_QG_COMMAND_TIMEOUT_MS || 300000);
export const API_BASE_URL = normalizeBaseUrl(VITE_ENV.VITE_QG_API_BASE_URL || '');

const JSON_HEADERS = { Accept: 'application/json' };
const CSRF_HEADERS = { 'X-QuantGod-Local': '1' };
const RUNTIME_FILE_PATTERN = /\/QuantGod_[^\s'"?#]+\.(json|csv)\b/i;

function normalizeBaseUrl(value) {
  const text = String(value || '').trim();
  return text.replace(/\/+$/, '');
}

function nowMs() {
  if (typeof performance !== 'undefined' && typeof performance.now === 'function') {
    return performance.now();
  }
  return Date.now();
}

function safeDuration(startedAtMs) {
  return Math.max(0, Math.round(nowMs() - startedAtMs));
}

function asErrorPayload(error) {
  if (!error) return null;
  return {
    name: error.name || 'Error',
    message: error.message || String(error),
  };
}

function apiErrorMeta(error) {
  if (!error) return null;
  const body = isPlainObject(error.body) ? error.body : {};
  return {
    name: error.name || '',
    message: error.message || body.message || body.error || '',
    bodyError: body.error || '',
    bodyMessage: body.message || '',
    bodyStatus: body.status || '',
    bodyStatusZh: body.statusZh || '',
  };
}

function requestAbortController(externalSignal, timeoutMs) {
  const controller = new AbortController();
  let timer = null;

  const abort = () => controller.abort();
  if (externalSignal?.aborted) {
    abort();
  } else if (externalSignal?.addEventListener) {
    externalSignal.addEventListener('abort', abort, { once: true });
  }
  if (timeoutMs > 0) {
    timer = setTimeout(abort, timeoutMs);
  }

  return {
    signal: controller.signal,
    cleanup() {
      if (timer) clearTimeout(timer);
      if (externalSignal?.removeEventListener) {
        externalSignal.removeEventListener('abort', abort);
      }
    },
  };
}

async function parseJsonResponse(response) {
  const contentType = String(response.headers?.get?.('content-type') || '').toLowerCase();
  const text = await response.text();
  const trimmed = text.trim();

  if (!trimmed) {
    return { ok: false, data: null, error: 'Empty response body; expected JSON' };
  }
  if (contentType.includes('text/html') || /^\s*<!doctype\s+html|^\s*<html[\s>]/i.test(trimmed)) {
    return { ok: false, data: null, error: 'HTML response received; expected JSON' };
  }
  try {
    return { ok: true, data: JSON.parse(trimmed), error: '' };
  } catch (_) {
    return { ok: false, data: null, error: 'Malformed JSON response' };
  }
}

export function assertApiPath(path) {
  const endpoint = String(path || '').trim();
  if (!endpoint) {
    throw new Error('QuantGod API client requires a non-empty /api/* path');
  }
  if (/^https?:\/\//i.test(endpoint)) {
    throw new Error(`QuantGod API client rejects absolute URLs: ${endpoint}`);
  }
  if (!endpoint.startsWith('/api/')) {
    throw new Error(`QuantGod API client only allows /api/* paths: ${endpoint}`);
  }
  if (RUNTIME_FILE_PATTERN.test(endpoint)) {
    throw new Error(`QuantGod API client rejects raw runtime files: ${endpoint}`);
  }
  return endpoint;
}

export function joinApiBaseUrl(baseUrl, path) {
  const endpoint = assertApiPath(path);
  const base = normalizeBaseUrl(baseUrl);
  if (!base) return endpoint;
  if (base.endsWith('/api') && endpoint.startsWith('/api/')) {
    return `${base}${endpoint.slice('/api'.length)}`;
  }
  return `${base}${endpoint}`;
}

export function makeApiUrl(path) {
  return joinApiBaseUrl(API_BASE_URL, path);
}

export function queryString(query = {}) {
  const search = new URLSearchParams();
  Object.entries(query || {}).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      search.set(key, String(value));
    }
  });
  const text = search.toString();
  return text ? `?${text}` : '';
}

export function rowsFromPayload(payload) {
  if (Array.isArray(payload?.data?.rows)) return payload.data.rows;
  if (Array.isArray(payload?.rows)) return payload.rows;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload)) return payload;
  return [];
}

function isPlainObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value);
}

function normalizedHeaders(value) {
  if (typeof Headers !== 'undefined' && value instanceof Headers) {
    return Object.fromEntries(value.entries());
  }
  return isPlainObject(value) ? value : {};
}

function normalizeFetchOptions(options = {}) {
  const { signal, timeoutMs, headers, method, cache, body, ...fetchOptions } = options || {};
  void method;
  void cache;
  void body;
  return {
    signal,
    timeoutMs: Number(timeoutMs || DEFAULT_TIMEOUT_MS),
    headers: normalizedHeaders(headers),
    fetchOptions,
  };
}

export function attachApiMeta(payload, result = {}, endpoint = '') {
  if (!isPlainObject(payload)) return payload;
  const existing = isPlainObject(payload._api) ? payload._api : {};
  const error = apiErrorMeta(result.error);
  const meta = {
    ...existing,
    ok: Boolean(result.ok),
    endpoint: endpoint || result.endpoint || existing.endpoint || '',
    method: String(result.method || existing.method || '').toUpperCase(),
    status: Number(result.status || 0),
    fetchedAt: result.fetchedAt || existing.fetchedAt || '',
    durationMs: Number(result.durationMs || 0),
  };
  if (error) {
    meta.error = error;
  } else if (existing.error !== undefined) {
    meta.error = existing.error;
  }
  return {
    ...payload,
    _api: meta,
  };
}

export async function fetchApiJson(path, options = {}) {
  const endpoint = assertApiPath(path);
  const startedAtMs = nowMs();
  const normalized = normalizeFetchOptions(options);
  const requestAbort = requestAbortController(normalized.signal, normalized.timeoutMs);

  try {
    const response = await fetch(makeApiUrl(endpoint), {
      ...normalized.fetchOptions,
      method: 'GET',
      headers: { ...JSON_HEADERS, ...normalized.headers },
      cache: 'no-store',
      signal: requestAbort.signal,
    });
    const parsed = await parseJsonResponse(response);
    const ok = response.ok && parsed.ok;
    return {
      ok,
      endpoint,
      method: 'GET',
      status: response.status,
      data: ok ? parsed.data : null,
      error: ok
        ? null
        : {
            message: response.ok ? parsed.error : `HTTP ${response.status}`,
            body: parsed.ok ? parsed.data : null,
          },
      fetchedAt: new Date().toISOString(),
      durationMs: safeDuration(startedAtMs),
    };
  } catch (error) {
    return {
      ok: false,
      endpoint,
      method: 'GET',
      status: 0,
      data: null,
      error: asErrorPayload(error),
      fetchedAt: new Date().toISOString(),
      durationMs: safeDuration(startedAtMs),
    };
  } finally {
    requestAbort.cleanup();
  }
}

export async function postApiJson(path, payload = {}, options = {}) {
  const endpoint = assertApiPath(path);
  const startedAtMs = nowMs();
  const normalized = normalizeFetchOptions(options);
  const requestAbort = requestAbortController(normalized.signal, normalized.timeoutMs);

  try {
    const response = await fetch(makeApiUrl(endpoint), {
      ...normalized.fetchOptions,
      method: 'POST',
      headers: {
        ...JSON_HEADERS,
        'Content-Type': 'application/json',
        ...normalized.headers,
        ...CSRF_HEADERS,
      },
      cache: 'no-store',
      body: JSON.stringify(payload || {}),
      signal: requestAbort.signal,
    });
    const parsed = await parseJsonResponse(response);
    const ok = response.ok && parsed.ok;
    return {
      ok,
      endpoint,
      method: 'POST',
      status: response.status,
      data: ok ? parsed.data : null,
      error: ok
        ? null
        : {
            message: response.ok ? parsed.error : `HTTP ${response.status}`,
            body: parsed.ok ? parsed.data : null,
          },
      fetchedAt: new Date().toISOString(),
      durationMs: safeDuration(startedAtMs),
    };
  } catch (error) {
    return {
      ok: false,
      endpoint,
      method: 'POST',
      status: 0,
      data: null,
      error: asErrorPayload(error),
      fetchedAt: new Date().toISOString(),
      durationMs: safeDuration(startedAtMs),
    };
  } finally {
    requestAbort.cleanup();
  }
}

export async function fetchJson(path, fallback = null, options = {}) {
  const result = await fetchApiJson(path, options);
  return apiFallback(result, fallback, path);
}

export async function postJson(path, payload = {}, fallback = null, options = {}) {
  const result = await postApiJson(path, payload, options);
  return apiFallback(result, fallback, path);
}

function commandPayloadError(result, endpoint) {
  if (!result?.ok) return apiThrowMessage(result, endpoint);
  if (!isPlainObject(result.data)) {
    return `Command ${endpoint} did not return a JSON object with ok=true`;
  }
  if (result.data.ok === true) return '';
  return (
    result.data.statusZh ||
    result.data.error ||
    result.data.message ||
    `Command ${endpoint} did not confirm ok=true`
  );
}

function commandResultOrThrow(result, endpoint) {
  const message = commandPayloadError(result, endpoint);
  if (message) {
    const error = new Error(message);
    error.name = 'QuantGodCommandError';
    error.endpoint = endpoint;
    error.status = Number(result?.status || 0);
    error.body = result?.data || result?.error?.body || null;
    throw error;
  }
  return attachApiMeta(result.data, result, endpoint);
}

export async function fetchCommandJson(path, options = {}) {
  const result = await fetchApiJson(path, {
    timeoutMs: DEFAULT_COMMAND_TIMEOUT_MS,
    ...options,
  });
  return commandResultOrThrow(result, path);
}

export async function postCommandJson(path, payload = {}, options = {}) {
  const result = await postApiJson(path, payload, {
    timeoutMs: DEFAULT_COMMAND_TIMEOUT_MS,
    ...options,
  });
  return commandResultOrThrow(result, path);
}

export async function fetchRows(path, options = {}) {
  return rowsFromPayload(await fetchJson(path, null, options));
}

export function apiFallback(result, fallback = null, endpoint = '') {
  if (result?.ok) return attachApiMeta(result.data, result, endpoint);
  const payload = result?.error?.body ||
    fallback || {
      ok: false,
      error: result?.error?.message || `HTTP ${result?.status || 0}`,
      endpoint: endpoint || result?.endpoint || '',
    };
  const envelope = isPlainObject(payload) && !result?.ok ? { ...payload, ok: false } : payload;
  return attachApiMeta(envelope, result, endpoint);
}

export function apiThrowMessage(result, endpoint = '') {
  return (
    result?.error?.body?.error ||
    result?.error?.body?.message ||
    result?.error?.message ||
    `HTTP ${result?.status || 0} for ${endpoint || result?.endpoint || 'unknown endpoint'}`
  );
}

export async function fetchJsonOrFallback(path, fallback = null, options = {}) {
  const result = await fetchApiJson(path, options);
  return apiFallback(result, fallback, path);
}

export async function postJsonOrFallback(path, payload = {}, fallback = null, options = {}) {
  const result = await postApiJson(path, payload, options);
  return apiFallback(result, fallback, path);
}

export async function fetchJsonOrThrow(path, options = {}) {
  const result = await fetchApiJson(path, options);
  if (result.ok) return attachApiMeta(result.data || {}, result, path);
  throw new Error(apiThrowMessage(result, path));
}

export async function postJsonOrThrow(path, payload = {}, options = {}) {
  const result = await postApiJson(path, payload, options);
  if (result.ok) return attachApiMeta(result.data || {}, result, path);
  throw new Error(apiThrowMessage(result, path));
}
