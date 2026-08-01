import { DEFAULT_WORKSPACE, FLAT_WORKSPACES } from './navigation.js';

export const WORKSPACE_QUERY_PARAM = 'workspace';

const WORKSPACE_KEYS = new Set(FLAT_WORKSPACES.map((workspace) => workspace.key));
const RETIRED_WORKSPACE_REDIRECTS = new Map([['hfm-crypto', 'mt5']]);

function canUseBrowserLocation() {
  return typeof window !== 'undefined' && window.location && window.history;
}

export function normalizeWorkspaceKey(value) {
  const key = String(value || '').trim();
  if (RETIRED_WORKSPACE_REDIRECTS.has(key)) return RETIRED_WORKSPACE_REDIRECTS.get(key);
  return WORKSPACE_KEYS.has(key) ? key : DEFAULT_WORKSPACE;
}

export function readWorkspaceFromUrl(locationLike = canUseBrowserLocation() ? window.location : null) {
  if (!locationLike) {
    return null;
  }
  const search = locationLike.search || '';
  const params = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search);
  const raw = params.get(WORKSPACE_QUERY_PARAM);
  if (raw) return normalizeWorkspaceKey(raw);
  const retiredPathKey = String(locationLike.pathname || '')
    .split('/')
    .filter(Boolean)
    .at(-1);
  return RETIRED_WORKSPACE_REDIRECTS.has(retiredPathKey)
    ? RETIRED_WORKSPACE_REDIRECTS.get(retiredPathKey)
    : null;
}

export function buildWorkspaceUrl(
  workspaceKey,
  locationLike = canUseBrowserLocation() ? window.location : null,
) {
  const key = normalizeWorkspaceKey(workspaceKey);
  const fallback = `/?${WORKSPACE_QUERY_PARAM}=${encodeURIComponent(key)}`;
  if (!locationLike) {
    return fallback;
  }

  const pathname = locationLike.pathname || '/';
  const search = locationLike.search || '';
  const hash = locationLike.hash || '';
  const params = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search);
  params.set(WORKSPACE_QUERY_PARAM, key);
  const query = params.toString();
  return `${pathname}${query ? `?${query}` : ''}${hash}`;
}

export function writeWorkspaceToUrl(workspaceKey, options = {}) {
  if (!canUseBrowserLocation()) {
    return null;
  }
  const nextUrl = buildWorkspaceUrl(workspaceKey, window.location);
  const currentUrl = `${window.location.pathname}${window.location.search}${window.location.hash}`;
  if (nextUrl === currentUrl) {
    return nextUrl;
  }
  const method = options.replace ? 'replaceState' : 'pushState';
  window.history[method]({ workspace: normalizeWorkspaceKey(workspaceKey) }, '', nextUrl);
  return nextUrl;
}

export function workspaceShareUrl(
  workspaceKey,
  locationLike = canUseBrowserLocation() ? window.location : null,
) {
  const path = buildWorkspaceUrl(workspaceKey, locationLike);
  if (!locationLike) {
    return path;
  }
  const origin = locationLike.origin || '';
  return `${origin}${path}`;
}
