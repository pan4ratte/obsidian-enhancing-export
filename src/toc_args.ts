/* The table-of-contents flags, read out of and written into a template's extra arguments. */

/** `--toc` with no depth of its own is this deep — pandoc's own default. */
export const TOC_DEFAULT_DEPTH = 3;

/** As deep as the dropdown offers, and as deep as a depth read back is trusted. */
export const TOC_MAX_DEPTH = 6;

/** No table of contents. Kept as a name so the dropdown's "None" is not a bare 0. */
export const TOC_NONE = 0;

// `(\s|$)` after the flag is what keeps `--toc` from matching `--toc-depth=3`.
const TOC_FLAG = String.raw`--(?:toc|table-of-contents)(?=\s|$)`;
const TOC_DEPTH = String.raw`--toc-depth[= ]\d+(?=\s|$)`;

/** How deep a table of contents `args` asks for, or `TOC_NONE` when it asks for none. */
export const tocDepth = (args?: string): number => {
  if (!args || !new RegExp(`(?:^|\\s)${TOC_FLAG}`).test(args)) {
    return TOC_NONE;
  }
  const depth = new RegExp(`(?:^|\\s)--toc-depth[= ](\\d+)(?=\\s|$)`).exec(args);
  if (!depth) {
    return TOC_DEFAULT_DEPTH;
  }
  // A hand-written depth of 0 says "no contents" as plainly as leaving the flag out; anything past the deepest
  // heading level is that deepest level.
  return Math.min(Number(depth[1]), TOC_MAX_DEPTH);
};

/** `args` with the table of contents set to `depth`, or taken back out at `TOC_NONE`. */
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
