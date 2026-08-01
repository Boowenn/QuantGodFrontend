/** Verify that the production bundle has no missing entry assets or static chunk cycles. */
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { pathToFileURL } from 'node:url';

const STATIC_IMPORT_PATTERN = /(?:^|[;\n])\s*import(?:[\s\S]*?from\s*)?["'](\.\/[^"']+)["']/g;

function relativeImports(source) {
  return [...source.matchAll(STATIC_IMPORT_PATTERN)].map((match) => match[1]);
}

function cycleIn(graph) {
  const visited = new Set();
  const active = new Set();
  const stack = [];

  function visit(node) {
    if (active.has(node)) return [...stack.slice(stack.indexOf(node)), node];
    if (visited.has(node)) return null;
    visited.add(node);
    active.add(node);
    stack.push(node);
    for (const next of graph.get(node) || []) {
      const cycle = visit(next);
      if (cycle) return cycle;
    }
    stack.pop();
    active.delete(node);
    return null;
  }

  for (const node of graph.keys()) {
    const cycle = visit(node);
    if (cycle) return cycle;
  }
  return null;
}

export function runBuildSmokeGuard(root = process.cwd()) {
  const errors = [];
  const dist = path.join(root, 'dist');
  const indexPath = path.join(dist, 'index.html');
  if (!fs.existsSync(indexPath)) return ['dist/index.html is missing; run the production build first'];

  const index = fs.readFileSync(indexPath, 'utf8');
  const entryAssets = [...index.matchAll(/(?:src|href)=["']\/vue\/(assets\/[^"']+)["']/g)].map(
    (match) => match[1],
  );
  if (!entryAssets.some((asset) => asset.endsWith('.js')))
    errors.push('production index has no JavaScript entry');
  for (const asset of entryAssets) {
    if (!fs.existsSync(path.join(dist, asset))) errors.push(`production index references missing ${asset}`);
  }

  const assetsDir = path.join(dist, 'assets');
  const jsFiles = fs.existsSync(assetsDir)
    ? fs.readdirSync(assetsDir).filter((name) => name.endsWith('.js'))
    : [];
  const graph = new Map();
  for (const file of jsFiles) {
    const imports = relativeImports(fs.readFileSync(path.join(assetsDir, file), 'utf8')).map((value) =>
      path.basename(value),
    );
    graph.set(file, imports);
    for (const imported of imports) {
      if (!fs.existsSync(path.join(assetsDir, imported))) errors.push(`${file} imports missing ${imported}`);
    }
  }
  const cycle = cycleIn(graph);
  if (cycle) errors.push(`static production chunk cycle: ${cycle.join(' -> ')}`);
  return errors;
}

export function main(argv = process.argv.slice(2)) {
  const errors = runBuildSmokeGuard(argv[0] ? path.resolve(argv[0]) : process.cwd());
  if (errors.length) {
    console.error('QuantGod frontend build smoke guard failed:');
    for (const error of errors) console.error(`- ${error}`);
    process.exitCode = 1;
    return;
  }
  console.log('QuantGod frontend build smoke guard OK');
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) main();
