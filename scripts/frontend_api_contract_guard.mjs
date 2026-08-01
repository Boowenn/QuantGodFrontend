/**
 * QuantGodFrontend API contract guard.
 *
 * Phase 2 split rule:
 * - Frontend source must not read QuantGod_*.json / QuantGod_*.csv runtime files directly.
 * - Frontend must access runtime data through /api/* endpoints exposed by QuantGodBackend.
 * - Raw fetch() calls must stay in src/services/apiClient.js so every endpoint uses
 *   the same timeout, error envelope, path guard, and observability metadata.
 *
 * This script is dependency-free and runs in CI via `npm run contract`.
 */
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const DEFAULT_SOURCE_DIR = 'src';
const SCANNED_EXTENSIONS = new Set(['.js', '.mjs', '.cjs', '.ts', '.vue', '.jsx', '.tsx']);
const IGNORED_DIRS = new Set(['node_modules', 'dist', 'coverage', '.git', '.github']);
const SPLIT_FORBIDDEN_DIRS = ['Dashboard', 'MQL5', 'tools'];

const DIRECT_RUNTIME_ARTIFACT_RE = /['"`]\/QuantGod_[A-Za-z0-9_.-]+\.(?:json|csv)['"`]/i;
const DIRECT_RUNTIME_PATH_RE = /\/(?:QuantGod_[A-Za-z0-9_.-]+\.(?:json|csv))/i;
const STATIC_API_PATH_RE = /\/api\/[A-Za-z0-9_./:-]+/g;
const RAW_FETCH_RE = /\bfetch\s*\(/g;
const FETCH_STRING_RE = /\bfetch\s*\(\s*(['"`])([^'"`]+)\1/g;

function rel(root, target) {
  return path.relative(root, target).replaceAll(path.sep, '/') || '.';
}

function existsAsDir(target) {
  try {
    return fs.statSync(target).isDirectory();
  } catch {
    return false;
  }
}

function walkFiles(root, dir = root, files = []) {
  if (!fs.existsSync(dir)) return files;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (!IGNORED_DIRS.has(entry.name)) {
        walkFiles(root, fullPath, files);
      }
      continue;
    }
    if (entry.isFile() && SCANNED_EXTENSIONS.has(path.extname(entry.name))) {
      files.push(fullPath);
    }
  }
  return files;
}

function lineNumberForIndex(text, index) {
  return text.slice(0, index).split(/\r?\n/).length;
}

function isApiClientFile(repoRoot, filePath) {
  const normalized = rel(repoRoot, filePath);
  return normalized === 'src/services/apiClient.js';
}

function normalizeApiPath(pathValue) {
  return String(pathValue || '').split('?', 1)[0].replace(/\/+$/, '') || '/api';
}

function placeholderPrefix(placeholderPath) {
  for (const token of [':endpoint', ':id', ':ticket', ':action', ':seedId']) {
    if (placeholderPath.includes(token)) {
      return placeholderPath.split(token, 1)[0];
    }
  }
  return '';
}

function pathCoveredByContract(pathValue, documentedPaths) {
  const path = normalizeApiPath(pathValue);
  if (documentedPaths.has(path)) return true;
  for (const documentedPath of documentedPaths) {
    const prefix = placeholderPrefix(documentedPath);
    if (prefix && path.startsWith(prefix)) return true;
  }
  return false;
}

function collectContractPaths(contract) {
  const paths = new Set();
  const groups = Array.isArray(contract?.endpointGroups) ? contract.endpointGroups : [];
  for (const group of groups) {
    const endpoints = Array.isArray(group?.endpoints) ? group.endpoints : [];
    for (const endpoint of endpoints) {
      if (typeof endpoint?.path === 'string' && endpoint.path.startsWith('/api/')) {
        paths.add(normalizeApiPath(endpoint.path));
      }
    }
  }
  return paths;
}

function defaultApiContractPath(repoRoot) {
  return path.resolve(repoRoot, '..', 'QuantGodDocs', 'docs', 'contracts', 'api-contract.json');
}

function loadApiContract(repoRoot, options = {}) {
  if (options.skipApiContractCoverage) return null;
  const contractPath =
    options.apiContractPath ||
    process.env.QG_API_CONTRACT_PATH ||
    defaultApiContractPath(repoRoot);
  if (!contractPath || !fs.existsSync(contractPath)) return null;
  return {
    contractPath,
    paths: collectContractPaths(JSON.parse(fs.readFileSync(contractPath, 'utf8'))),
  };
}

function collectStaticApiReferences(repoRoot, sourceDir) {
  const references = [];
  for (const filePath of walkFiles(repoRoot, sourceDir)) {
    const text = fs.readFileSync(filePath, 'utf8');
    const relativePath = rel(repoRoot, filePath);
    let match;
    while ((match = STATIC_API_PATH_RE.exec(text)) !== null) {
      references.push({
        path: normalizeApiPath(match[0]),
        file: relativePath,
        line: lineNumberForIndex(text, match.index),
      });
    }
  }
  return references;
}

function checkSplitBoundary(repoRoot) {
  const errors = [];
  for (const dirName of SPLIT_FORBIDDEN_DIRS) {
    const fullPath = path.join(repoRoot, dirName);
    if (existsAsDir(fullPath)) {
      errors.push({
        file: dirName,
        line: 1,
        message: `split-boundary violation: frontend repo must not contain ${dirName}/`,
      });
    }
  }
  return errors;
}

function checkSourceFile(repoRoot, filePath) {
  const errors = [];
  const text = fs.readFileSync(filePath, 'utf8');
  const relativePath = rel(repoRoot, filePath);

  const directArtifact = text.match(DIRECT_RUNTIME_ARTIFACT_RE) || text.match(DIRECT_RUNTIME_PATH_RE);
  if (directArtifact) {
    errors.push({
      file: relativePath,
      line: lineNumberForIndex(text, directArtifact.index || 0),
      message: 'direct QuantGod_*.json/csv runtime file read is forbidden; use /api/* endpoint instead',
    });
  }

  if (!isApiClientFile(repoRoot, filePath)) {
    let match;
    while ((match = RAW_FETCH_RE.exec(text)) !== null) {
      errors.push({
        file: relativePath,
        line: lineNumberForIndex(text, match.index),
        message:
          'raw fetch() outside src/services/apiClient.js is forbidden; add an apiClient-backed service wrapper',
      });
    }
  }

  let fetchMatch;
  while ((fetchMatch = FETCH_STRING_RE.exec(text)) !== null) {
    const url = fetchMatch[2];
    if (url.startsWith('/') && !url.startsWith('/api/')) {
      errors.push({
        file: relativePath,
        line: lineNumberForIndex(text, fetchMatch.index),
        message: `non-API fetch target ${url} is forbidden; frontend runtime data must use /api/*`,
      });
    }
  }

  return errors;
}

export function runFrontendApiContractGuard(repoRoot = process.cwd(), options = {}) {
  const root = path.resolve(repoRoot);
  const sourceDir = path.resolve(root, options.sourceDir || DEFAULT_SOURCE_DIR);
  const errors = [...checkSplitBoundary(root)];
  for (const filePath of walkFiles(root, sourceDir)) {
    errors.push(...checkSourceFile(root, filePath));
  }
  const apiContract = loadApiContract(root, options);
  if (apiContract) {
    for (const reference of collectStaticApiReferences(root, sourceDir)) {
      if (!pathCoveredByContract(reference.path, apiContract.paths)) {
        errors.push({
          file: reference.file,
          line: reference.line,
          message:
            `frontend API path ${reference.path} is not documented in ` +
            `${path.relative(root, apiContract.contractPath).replaceAll(path.sep, '/')}`,
        });
      }
    }
  }
  return errors;
}

export function formatErrors(errors) {
  if (!errors.length) return 'QuantGodFrontend API contract guard OK';
  return [
    'QuantGodFrontend API contract guard failed:',
    ...errors.map((error) => `- ${error.file}:${error.line} ${error.message}`),
  ].join('\n');
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const repoRoot = process.argv[2] || process.cwd();
  const errors = runFrontendApiContractGuard(repoRoot);
  console.log(formatErrors(errors));
  process.exit(errors.length ? 1 : 0);
}
