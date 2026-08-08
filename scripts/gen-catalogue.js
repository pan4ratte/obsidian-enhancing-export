/*
 * Regenerates the lua-filter catalogue from the entries, in two steps:
 *
 *   lua-filters/index.json     ← the single source of truth
 *     → its own normalised form  (key order, fileName derived from path)
 *       → the catalogue tables in README.md
 *
 * So editing an entry's storeName/description/requires/category — or adding,
 * moving or deleting one — is enough: the README tables follow. What a table
 * says is never hand-written, and an entry's `fileName` is never hand-written
 * either: it is the last segment of the `path` it is served from, which is what
 * the store downloads it as and what `--lua-filter` then names.
 *
 * Entries keep their position in the array (the store's display order within a
 * shelf); the tables group them by `category`, in the order the shelves are
 * shown in the plugin.
 *
 * The generated tables sit between two fixed prose lines in the README — an
 * intro ("The catalogue currently offers:") and an outro ("Want to add a filter
 * of your own?"). Everything between those anchors is replaced; the surrounding
 * prose is left alone. (Prose anchors rather than HTML comment markers because
 * Obsidian's plugin linter flags `<!-- -->` in a README as leftover template
 * text.)
 *
 * Run:    npm run docs:catalogue           (rewrite index.json + the README)
 * Check:  npm run docs:catalogue:check     (exit 1 if either is stale)
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const filterDir = path.join(root, 'lua-filters');
const indexPath = path.join(filterDir, 'index.json');
const readmePath = path.join(root, 'README.md');

// The shelves, in the order the store shows them. Kept in step with
// `LUA_FILTER_CATEGORIES` in src/lua_filters.ts and with the `category` labels
// in src/lang/en-US.ts — an entry on a shelf that is not here is an error
// rather than a row quietly dropped from the tables.
const CATEGORIES = [
  ['structure', 'Structure'],
  ['citations', 'Citations'],
  ['figures', 'Figures & math'],
  ['prose', 'Text & typography'],
  ['word', 'Word & ODT'],
  ['latex', 'LaTeX & PDF'],
  ['tools', 'Tools'],
  ['other', 'Other'],
];

const COLUMNS = ['Filter', 'What it does', 'Needs'];

// The anchors the generated block sits between.
const INTRO = 'The catalogue currently offers:';
const OUTRO = 'Want to add a filter of your own?';

// Canonical key order — the order the hand-written entries were in, so
// regenerating an unchanged catalogue is a no-op diff.
const KEY_ORDER = [
  'id',
  'storeName',
  'description',
  'author',
  'license',
  'category',
  'formats',
  'requires',
  'updated',
  'fileName',
  'path',
  'url',
  'homepage',
];

const loadIndex = () => JSON.parse(fs.readFileSync(indexPath, 'utf8'));

// ── index.json, normalised from itself and from the vendored files ────────────

/**
 * One entry, rewritten: keys in the canonical order, `fileName` taken from the
 * path it is served from, and anything not in the schema dropped. Throws on an
 * entry that could not be shown as a row at all.
 */
const normalise = entry => {
  for (const key of ['id', 'storeName', 'description', 'author', 'license', 'category']) {
    if (typeof entry[key] !== 'string' || entry[key].length === 0) {
      throw new Error(`${entry.id ?? '(no id)'}: missing or invalid "${key}"`);
    }
  }
  if (!CATEGORIES.some(([name]) => name === entry.category)) {
    throw new Error(`${entry.id}: unknown category "${entry.category}" — one of ${CATEGORIES.map(([n]) => n).join(', ')}`);
  }
  if (!entry.path && !entry.url) {
    throw new Error(`${entry.id}: neither "path" nor "url"`);
  }
  if (entry.path && !fs.existsSync(path.join(filterDir, entry.path))) {
    throw new Error(`${entry.id}: "${entry.path}" is not vendored in lua-filters/`);
  }
  if (entry.path && entry.path.startsWith('bundled/')) {
    throw new Error(`${entry.id}: bundled/ is what the plugin ships — the store never offers it`);
  }

  const out = {};
  for (const key of KEY_ORDER) {
    if (entry[key] !== undefined) out[key] = entry[key];
  }
  // Derived, not carried: the store writes the file under this name, and a name
  // that disagreed with the path would be a filter no template could run.
  if (entry.path) out.fileName = entry.path.substring(entry.path.lastIndexOf('/') + 1);
  return out;
};

/** The whole catalogue, normalised, with the clashes a store cannot survive refused. */
const buildIndex = (current = loadIndex()) => {
  const filters = (current.filters ?? []).map(normalise);

  const bundled = fs
    .readdirSync(path.join(filterDir, 'bundled'))
    .filter(f => f.endsWith('.lua'));
  const seen = new Map();
  for (const entry of filters) {
    const clash = seen.get(entry.id);
    if (clash) throw new Error(`duplicate id "${entry.id}"`);
    seen.set(entry.id, entry);
    if (bundled.includes(entry.fileName)) {
      throw new Error(`${entry.id}: "${entry.fileName}" is a filter the plugin already ships`);
    }
  }
  const names = filters.map(e => e.fileName);
  const dupe = names.find((n, i) => names.indexOf(n) !== i);
  if (dupe) throw new Error(`two entries would both be installed as "${dupe}"`);

  return { ...current, filters };
};

// `JSON.stringify` breaks every array over several lines; the hand-written
// entries keep a short list of strings — `formats` — on one, which reads as the
// one field it is rather than as a paragraph.
const serializeIndex = index =>
  `${JSON.stringify(index, null, 2).replace(/\[\n\s+((?:"[^"\n]*",?\n\s+)+)\]/g, (whole, items) => {
    const values = items.trim().split(/,\s*\n\s*/);
    const inline = `[${values.join(', ')}]`;
    return inline.length <= 80 ? inline : whole;
  })}\n`;

// ── The README tables, derived from the index ─────────────────────────────────

// Make a cell safe inside a Markdown table: escape backslashes and pipes, and
// entity-escape HTML comment markers. Backslashes go first — a backslash is the
// escape character for the pipes below, so a description with one right before a
// `|` would otherwise emit `\\|`, a literal backslash followed by a live cell
// delimiter, splitting the row.
const cell = s =>
  s
    .replace(/\\/g, '\\\\')
    .replace(/\|/g, '\\|')
    .replace(/<!--/g, '&lt;!--')
    .replace(/-->/g, '--&gt;');

// A filter's name, linked to where it came from, and what it is used under.
const name = entry => (entry.homepage ? `[${cell(entry.storeName)}](${entry.homepage})` : cell(entry.storeName));

const table = (filters, category, heading) => {
  const rows = filters
    .filter(e => e.category === category)
    .map(e => `| ${name(e)} | ${cell(e.description)} | ${e.requires ? cell(e.requires) : '—'} |`);
  if (rows.length === 0) return null;
  return [`**${heading}**`, '', `| ${COLUMNS.join(' | ')} |`, '| :--- | :---------- | :--- |', ...rows].join('\n');
};

const buildBlock = (index = loadIndex()) =>
  CATEGORIES.map(([category, heading]) => table(index.filters, category, heading))
    .filter(Boolean)
    .join('\n\n');

/**
 * Splice a freshly built block between the intro/outro anchors; returns the new
 * file text, or null when either anchor is missing.
 */
const spliceBlock = (text, index) => {
  const introIdx = text.indexOf(INTRO);
  if (introIdx === -1) return null;
  const introEnd = introIdx + INTRO.length;
  const outroIdx = text.indexOf(OUTRO, introEnd);
  if (outroIdx === -1) return null;
  return `${text.slice(0, introEnd)}\n\n${buildBlock(index)}\n\n${text.slice(outroIdx)}`;
};

// ── Running it ────────────────────────────────────────────────────────────────

/**
 * Rewrite index.json from its own entries. Returns the index the README is then
 * generated from — the fresh one, even in --check mode, so a check reports the
 * truth about both files.
 */
const syncIndex = ({ check } = {}) => {
  const index = buildIndex();
  const next = serializeIndex(index);
  if (fs.readFileSync(indexPath, 'utf8') === next) {
    if (check) console.log('✓ lua-filters/index.json: entries up to date');
    return { index, stale: false };
  }
  if (check) {
    console.error('✗ lua-filters/index.json: entries are stale — run "npm run docs:catalogue"');
    return { index, stale: true };
  }
  fs.writeFileSync(indexPath, next);
  console.log(`✓ lua-filters/index.json: ${index.filters.length} entries regenerated`);
  return { index, stale: false };
};

const run = ({ check } = {}) => {
  const { index, stale: indexStale } = syncIndex({ check });
  let stale = indexStale;

  const text = fs.readFileSync(readmePath, 'utf8');
  const next = spliceBlock(text, index);
  if (next === null) {
    console.error('! README.md: catalogue anchors not found');
    stale = true;
  } else if (next === text) {
    if (check) console.log('✓ README.md: catalogue up to date');
  } else if (check) {
    console.error('✗ README.md: catalogue is stale — run "npm run docs:catalogue"');
    stale = true;
  } else {
    fs.writeFileSync(readmePath, next);
    console.log('✓ README.md: catalogue regenerated');
  }

  if (stale) process.exitCode = 1;
};

export { CATEGORIES, INTRO, OUTRO, loadIndex, buildIndex, serializeIndex, buildBlock };

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  run({ check: process.argv.includes('--check') });
}
