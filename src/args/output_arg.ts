/* The output path a rendered pandoc command names, read back out of the command line. */

/** Splits a command line on whitespace, keeping anything inside double quotes together. */
const TOKENS = /(?:[^\s"]+|"[^"]*")+/g;

// `(?![\w-])` is what keeps `--output` from matching `--output-x`, the same guard `--toc` needs in `toc_args.ts`.
const LONG = /^--output(?![\w-])(?:=(.*))?$/s;
// A short flag or a cluster of them ending in `o`: `-o`, `-o=x`, `-o"x"`, `-so`. Only a trailing `o` takes a value,
// which is how a cluster is read — in `-os` it is `s` that would take one.
const SHORT = /^-(?!-)[a-zA-Z]*o(?:=(.*)|("(?:[^"]*)")|)$/s;

/**
 * The path given to `-o`/`--output` in `cmd`, exactly as written — surrounding quotes and all, for `trimQuotes` to
 * take off — or `undefined` when the command names none.
 *
 * The last one wins, because that is both what pandoc does and what the command is assembled to expect: a template's
 * own `-o` comes first and the user's extra arguments are appended after it, so theirs is meant to be the one that
 * counts.
 */
/**
 * The same command with every `-o`/`--output` taken out of it, which is how pandoc is asked for its output on stdout
 * instead of in a file. A cluster keeps the flags that are not the `o`: `-so` is `-s` with the output dropped.
 */
export const withoutOutputArg = (cmd: string): string => {
  const tokens = cmd.match(TOKENS);
  if (!tokens) {
    return cmd;
  }
  const kept: string[] = [];
  for (let i = 0; i < tokens.length; i += 1) {
    const token = tokens[i];
    const long = LONG.exec(token);
    const short = long ? null : SHORT.exec(token);
    if (!long && !short) {
      kept.push(token);
      continue;
    }
    if (short) {
      const others = token.replace(/^(-[a-zA-Z]*)o(?:=.*|"[^"]*")?$/s, '$1');
      if (others.length > 1) {
        kept.push(others);
      }
    }
    // A bare flag names its path in the token after it, which goes with it.
    if ((long ? long[1] : (short[1] ?? short[2])) === undefined) {
      i += 1;
    }
  }
  return kept.join(' ');
};

export const outputArg = (cmd: string): string | undefined => {
  const tokens = cmd.match(TOKENS);
  if (!tokens) {
    return undefined;
  }
  let output: string | undefined;
  for (let i = 0; i < tokens.length; i += 1) {
    const long = LONG.exec(tokens[i]);
    const short = long ? null : SHORT.exec(tokens[i]);
    if (!long && !short) {
      continue;
    }
    // `--output=x` and `-o=x`/`-o"x"` carry their value; a bare flag takes the next token, and there may not be one.
    const attached = long ? long[1] : (short[1] ?? short[2]);
    if (attached !== undefined) {
      output = attached;
    } else if (i + 1 < tokens.length) {
      output = tokens[i + 1];
      i += 1;
    } else {
      // A trailing `-o` names nothing, and must not leave an earlier one standing as if it did.
      output = undefined;
    }
  }
  return output;
};
