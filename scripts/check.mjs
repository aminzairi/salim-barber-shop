/* Static sanity check: every JS file parses, every referenced asset exists,
 * translation JSONs are valid, and HTML references resolve. Zero deps.
 * Run: node scripts/check.mjs  (used by CI) */
import { readFile, readdir, stat } from 'node:fs/promises';
import { join, dirname, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
let failures = 0;

async function walk(dir) {
  const out = [];
  for (const e of await readdir(dir, { withFileTypes: true })) {
    if (e.name === 'node_modules' || e.name === '.git') continue;
    const p = join(dir, e.name);
    if (e.isDirectory()) out.push(...await walk(p));
    else out.push(p);
  }
  return out;
}

const files = await walk(root);

// 1. every JS module parses (node --check handles ESM given package.json type)
for (const f of files.filter((f) => extname(f) === '.js' || extname(f) === '.mjs')) {
  const r = spawnSync(process.execPath, ['--check', f], { encoding: 'utf8' });
  if (r.status !== 0) { console.error('PARSE FAIL', f, '\n', r.stderr); failures += 1; }
}

// 2. JSON files are valid
for (const f of files.filter((f) => extname(f) === '.json')) {
  try { JSON.parse(await readFile(f, 'utf8')); } catch (e) { console.error('JSON FAIL', f, e.message); failures += 1; }
}

// 3. assets referenced by HTML exist (src=/href= local paths)
const htmlFiles = files.filter((f) => /\.html$/.test(f));
for (const html of htmlFiles) {
  const src = await readFile(html, 'utf8');
  const refs = [...src.matchAll(/(?:src|href)="([^"#]+)"/g)].map((m) => m[1])
    .filter((p) => !/^(https?:|mailto:|tel:|#|mailto)/.test(p));
  for (const ref of refs) {
    const target = join(root, ref.replace(/^\.\//, ''));
    try { await stat(target); } catch {
      console.error('ASSET MISSING', html, '→', ref); failures += 1;
    }
  }
}

// 4. translation key parity re-check (cheap guard for hand edits)
const langs = {};
for (const code of ['en', 'fr', 'ar']) {
  langs[code] = JSON.parse(await readFile(join(root, 'js/translations', `${code}.json`), 'utf8'));
}
const flat = (o, p = '') => Object.entries(o).flatMap(([k, v]) =>
  v && typeof v === 'object' && !Array.isArray(v) ? flat(v, `${p}${k}.`) : [`${p}${k}`]);
const sets = Object.fromEntries(Object.entries(langs).map(([l, v]) => [l, new Set(flat(v))]));
for (const [a, b] of [['en', 'fr'], ['en', 'ar']]) {
  for (const k of sets[a]) if (!sets[b].has(k)) { console.error(`KEY ${k} missing in ${b}`); failures += 1; }
}

console.log(failures === 0 ? `OK — ${files.length} files checked` : `${failures} failure(s)`);
process.exit(failures === 0 ? 0 : 1);
