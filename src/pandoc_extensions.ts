/*
 * Pandoc reader extensions, switched on per template.
 *
 * An extension is not a flag of its own: it is written onto the format it
 * belongs to, as `--from=markdown+emoji`. The template's input format is
 * `${fromFormat}` — a variable `exporto0o` fills in with `markdown`, plus the
 * wikilink extension when the vault writes wikilinks — so what is stored is
 * that variable with the chosen extensions appended to it. The flag goes last
 * in the extra arguments, and pandoc takes the last `-f` it is given.
 *
 * Only extensions that pandoc's markdown reader leaves **off** are offered
 * (`pandoc --list-extensions=markdown` prints the defaults). That is what makes
 * a checkbox honest: ticked is on, cleared is the reader's own behaviour. An
 * extension that was already on could not be shown as anything but ticked.
 *
 * The two `wikilinks_*` extensions are deliberately absent: the plugin already
 * sets one of them from Obsidian's own "use [[Wikilinks]]" setting.
 */

/** The extensions offered, in the order they are shown. */
export const PANDOC_EXTENSIONS = [
  'alerts',
  'mark',
  'hard_line_breaks',
  'lists_without_preceding_blankline',
  'rebase_relative_paths',
  'emoji',
  'autolink_bare_uris',
  'tex_math_single_backslash',
  'east_asian_line_breaks',
  'short_subsuperscripts',
] as const;

export type PandocExtension = (typeof PANDOC_EXTENSIONS)[number];

/**
 * Written without a template literal so the `$` is plainly not this file's to
 * interpolate — `${fromFormat}` is filled in at export time.
 */
const FROM_ARG = '-f ${fromFormat}';

const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Matches the flag this module writes, with whatever it currently carries. */
const flagPattern = () => new RegExp(`(?:^|\\s)${escapeRegExp(FROM_ARG)}((?:\\+\\w+)*)(?=\\s|$)`);

/** The extensions `args` switches on, in the order this module lists them. */
export const enabledExtensions = (args?: string): PandocExtension[] => {
  const found = args ? flagPattern().exec(args) : null;
  if (!found?.[1]) {
    return [];
  }
  const on = new Set(found[1].split('+').filter(Boolean));
  return PANDOC_EXTENSIONS.filter(e => on.has(e));
};

/**
 * `args` carrying exactly `extensions`. The flag is rewritten rather than added
 * to, and taken back out entirely when nothing is left switched on — a bare
 * `-f ${fromFormat}` would be a no-op, but it would also be clutter in a field
 * the user reads.
 */
export const setExtensions = (args: string | undefined, extensions: readonly string[]): string => {
  const stripped = (args ?? '')
    .replace(new RegExp(flagPattern().source, 'g'), ' ')
    .replace(/\s{2,}/g, ' ')
    .trim();
  // Listed in this module's order, whatever order they were ticked in, so the
  // same set of extensions always reads the same way.
  const chosen = PANDOC_EXTENSIONS.filter(e => extensions.includes(e));
  if (chosen.length === 0) {
    return stripped;
  }
  const flag = FROM_ARG + chosen.map(e => `+${e}`).join('');
  return stripped ? `${stripped} ${flag}` : flag;
};
