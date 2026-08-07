/*
 * The table-of-contents flags, read out of and written into a template's extra
 * arguments.
 *
 * The extra arguments, not the arguments proper: those are rewritten wholesale
 * whenever the template's output format changes, and would take the contents
 * with them — the same reason the lua-filter flags live there.
 *
 * Reading is deliberately more forgiving than writing. What is written is
 * always `--toc --toc-depth=N`, but a template may have been typed by hand, so
 * `--table-of-contents` and a space-separated `--toc-depth N` are understood
 * too.
 */

/** `--toc` with no depth of its own is this deep — pandoc's own default. */
export const TOC_DEFAULT_DEPTH = 3;

/**
 * As deep as the dropdown offers, and as deep as a depth read back is trusted.
 *
 * Six, not nine: pandoc refuses anything else outright — "Argument of
 * --toc-depth must be a number 1-6" — and the export fails before it starts.
 * There are only six heading levels to reach anyway; `####### seven` is not a
 * heading in any format pandoc writes.
 */
export const TOC_MAX_DEPTH = 6;

/** No table of contents. Kept as a name so the dropdown's "None" is not a bare 0. */
export const TOC_NONE = 0;

// `(\s|$)` after the flag is what keeps `--toc` from matching `--toc-depth=3`.
const TOC_FLAG = String.raw`--(?:toc|table-of-contents)(?=\s|$)`;
const TOC_DEPTH = String.raw`--toc-depth[= ]\d+(?=\s|$)`;

/**
 * How deep a table of contents `args` asks for, or `TOC_NONE` when it asks for
 * none. A depth without `--toc` is not a table of contents: pandoc ignores it.
 */
export const tocDepth = (args?: string): number => {
  if (!args || !new RegExp(`(?:^|\\s)${TOC_FLAG}`).test(args)) {
    return TOC_NONE;
  }
  const depth = new RegExp(`(?:^|\\s)--toc-depth[= ](\\d+)(?=\\s|$)`).exec(args);
  if (!depth) {
    return TOC_DEFAULT_DEPTH;
  }
  // A hand-written depth of 0 says "no contents" as plainly as leaving the flag
  // out; anything past the deepest heading level is that deepest level.
  return Math.min(Number(depth[1]), TOC_MAX_DEPTH);
};

/**
 * `args` with the table of contents set to `depth`, or taken back out at
 * `TOC_NONE`. Whatever was there before is replaced rather than added to, so
 * the flags can never end up in the line twice.
 */
export const setTocDepth = (args: string | undefined, depth: number): string => {
  const stripped = (args ?? '')
    .replace(new RegExp(`(?:^|\\s)(?:${TOC_FLAG}|${TOC_DEPTH})`, 'g'), ' ')
    .replace(/\s{2,}/g, ' ')
    .trim();
  if (depth <= TOC_NONE) {
    return stripped;
  }
  const toc = `--toc --toc-depth=${Math.min(depth, TOC_MAX_DEPTH)}`;
  return stripped ? `${stripped} ${toc}` : toc;
};
