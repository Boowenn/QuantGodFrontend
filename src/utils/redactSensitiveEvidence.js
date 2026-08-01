const REDACTED_ACCOUNT = '[REDACTED_ACCOUNT]';
const REDACTED_IDENTITY = '[REDACTED_IDENTITY]';
const REDACTED_SECRET = '[REDACTED_SECRET]';

const ACCOUNT_KEYS = new Set([
  'login',
  'accountid',
  'accountno',
  'accountnumber',
  'brokeraccount',
  'brokeraccountid',
  'mt5account',
]);
const ACCOUNT_CONTAINER_KEYS = new Set([
  'account',
  'accounts',
  'accountinfo',
  'brokeraccount',
  'brokeraccounts',
  'mt5account',
  'mt5accounts',
  'tradingaccount',
]);
const IDENTITY_KEYS = new Set([
  'name',
  'accountname',
  'clientname',
  'customername',
  'holdername',
  'ownername',
  'server',
  'servername',
  'tradeserver',
  'brokerserver',
]);
const SECRET_KEY_PATTERN =
  /(?:^|_)(?:authorization|cookie|credential|jwt|mnemonic|pass(?:word|phrase)?|private_?key|secret|session|token|api_?key)(?:_|$)/i;

function normalizedKey(key) {
  return String(key || '')
    .replace(/[^a-z0-9]/gi, '')
    .toLowerCase();
}

function isObject(value) {
  return value !== null && typeof value === 'object';
}

function redactString(value) {
  return String(value)
    .replace(/\bBearer\s+[^\s"']+/gi, `Bearer ${REDACTED_SECRET}`)
    .replace(/\bbot\d{6,}:[A-Za-z0-9_-]+\b/g, `bot${REDACTED_SECRET}`)
    .replace(
      /(\b(?:api_?key|authorization|password|secret|session|token)\b["']?\s*[=:]\s*)(?:"[^"]*"|'[^']*'|[^&#\s,;}]+)/gi,
      `$1${REDACTED_SECRET}`,
    )
    .replace(
      /(\b(?:login|account(?:id|no|number)?|brokeraccount(?:id)?|mt5account)\b["']?\s*[=:]\s*)(?:"[^"]*"|'[^']*'|[^\s,;}]+)/gi,
      `$1${REDACTED_ACCOUNT}`,
    )
    .replace(
      /(\b(?:name|accountname|clientname|customername|holdername|ownername|server|servername|tradeserver|brokerserver)\b["']?\s*[=:]\s*)(?:"[^"]*"|'[^']*'|[^\s,;}]+)/gi,
      `$1${REDACTED_IDENTITY}`,
    )
    .replace(/(https?:\/\/)[^:/\s]+:[^@\s]+@/gi, `$1${REDACTED_SECRET}@`)
    .replace(/\b(?:sk|pk|api|token)-[A-Za-z0-9_-]{12,}\b/gi, REDACTED_SECRET);
}

function redactionForKey(key, value, accountContext = false) {
  const normalized = normalizedKey(key);
  if (
    SECRET_KEY_PATTERN.test(String(key || '')) ||
    /(?:authorization|cookie|credential|mnemonic|passphrase|password|privatekey|secret|session|token|apikey)/.test(
      normalized,
    )
  ) {
    return REDACTED_SECRET;
  }
  if (
    ACCOUNT_KEYS.has(normalized) ||
    (normalized === 'account' && !isObject(value)) ||
    (accountContext && (normalized === 'number' || normalized === 'id'))
  ) {
    return REDACTED_ACCOUNT;
  }
  if (IDENTITY_KEYS.has(normalized)) return REDACTED_IDENTITY;
  return null;
}

function looksLikeAccountObject(value, contextKey = '') {
  if (!isObject(value) || Array.isArray(value)) return false;
  if (ACCOUNT_CONTAINER_KEYS.has(normalizedKey(contextKey))) return true;
  return (
    ('number' in value || 'id' in value) &&
    ['login', 'server', 'trade_server', 'balance', 'equity', 'currency'].some((key) => key in value)
  );
}

function redactValue(value, seen, contextKey = '') {
  if (typeof value === 'string') return redactString(value);
  if (!isObject(value)) return value;
  if (seen.has(value)) return '[REDACTED_CIRCULAR]';
  seen.add(value);

  if (Array.isArray(value)) {
    return value.map((item) => redactValue(item, seen, contextKey));
  }

  const accountContext = looksLikeAccountObject(value, contextKey);
  return Object.fromEntries(
    Object.entries(value).map(([key, item]) => {
      const replacement = redactionForKey(key, item, accountContext);
      return [key, replacement ?? redactValue(item, seen, key)];
    }),
  );
}

export function redactSensitiveEvidence(value) {
  return redactValue(value, new WeakSet());
}

export const EVIDENCE_REDACTION_MARKERS = Object.freeze({
  account: REDACTED_ACCOUNT,
  identity: REDACTED_IDENTITY,
  secret: REDACTED_SECRET,
});
