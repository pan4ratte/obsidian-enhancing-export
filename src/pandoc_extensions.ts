/* Pandoc reader extensions, switched on per template. */

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
 * Written without a template literal so the `$` is plainly not this file's to interpolate — `${fromFormat}` is filled
 * in at export time.
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

/** `args` carrying exactly `extensions`. */
export const setExtensions = (args: string | undefined, extensions: readonly string[]): string => {
  const stripped = (args ?? '')
    .replace(new RegExp(flagPattern().source, 'g'), ' ')
    .replace(/\s{2,}/g, ' ')
    .trim();
  // Listed in this module's order, whatever order they were ticked in, so the same set of extensions always reads the
  // same way.
  const chosen = PANDOC_EXTENSIONS.filter(e => extensions.includes(e));
  if (chosen.length === 0) {
    return stripped;
  }
  const flag = FROM_ARG + chosen.map(e => `+${e}`).join('');
  return stripped ? `${stripped} ${flag}` : flag;
};
