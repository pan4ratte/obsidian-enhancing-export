import { outputArg } from '../src/output_arg';
import { trimQuotes } from '../src/utils';

/** What `export.ts` ends up with: the argument as written, with its quotes taken off. */
const output = (cmd: string) => {
  const arg = outputArg(cmd);
  return arg === undefined ? undefined : trimQuotes(arg);
};

describe('outputArg', () => {
  test('reads the quoted path every bundled template writes', () => {
    expect(output('pandoc "in.md" -o "out.pdf"')).toBe('out.pdf');
    expect(output('pandoc "in.md" -s -o "out.pdf" -t pdf')).toBe('out.pdf');
    expect(output('pandoc "in.md" --lua-filter="x/y.lua" -o "out.pdf"')).toBe('out.pdf');
  });

  test('reads every spelling of the flag', () => {
    expect(output('pandoc "in.md" -o out.pdf')).toBe('out.pdf');
    expect(output('pandoc "in.md" --output "out.pdf"')).toBe('out.pdf');
    expect(output('pandoc "in.md" --output=out.pdf')).toBe('out.pdf');
    expect(output('pandoc "in.md" --output="out.pdf"')).toBe('out.pdf');
    expect(output('pandoc "in.md" -o="out.pdf"')).toBe('out.pdf');
    expect(output('pandoc "in.md" -o"out.pdf"')).toBe('out.pdf');
  });

  test('reads a trailing `o` out of a cluster of short flags', () => {
    expect(output('pandoc "in.md" -so "out.pdf"')).toBe('out.pdf');
  });

  test('keeps paths that contain spaces, separators and dashes whole', () => {
    expect(output('pandoc "in.md" -o "my file.pdf"')).toBe('my file.pdf');
    expect(output('pandoc "in.md" -o "C:/a/b.pdf"')).toBe('C:/a/b.pdf');
    expect(output('pandoc "in.md" -o "C:\\a\\b.pdf"')).toBe('C:\\a\\b.pdf');
    expect(output('pandoc "in.md" -o "out-2.pdf"')).toBe('out-2.pdf');
    expect(output('pandoc "in.md" -o "-weird.pdf"')).toBe('-weird.pdf');
    expect(output('pandoc "in.md" -o "a b/c d.textbundle/text.md"')).toBe('a b/c d.textbundle/text.md');
  });

  test('is not fooled by a longer flag that starts the same', () => {
    expect(output('pandoc "in.md" --output-x "no.pdf" -o "yes.pdf"')).toBe('yes.pdf');
    expect(output('pandoc "in.md" --output-dir="no" -o "yes.pdf"')).toBe('yes.pdf');
  });

  test('is not fooled by other flags that carry values', () => {
    expect(output('pandoc "in.md" -f markdown+mark -o "out.pdf"')).toBe('out.pdf');
    expect(output('pandoc "in.md" -V k=v -o "out.pdf"')).toBe('out.pdf');
    expect(output('pandoc "in.md" -o "out.pdf" extra.md')).toBe('out.pdf');
  });

  test('a path that looks like a number is still a path', () => {
    expect(output('pandoc "in.md" -o "123"')).toBe('123');
    expect(output('pandoc "in.md" -o 123')).toBe('123');
    expect(output('pandoc "in.md" -o 123.pdf')).toBe('123.pdf');
  });

  test('the last one wins, so appended user arguments override the template', () => {
    expect(output('pandoc "in.md" -o "out.pdf" -o "second.pdf"')).toBe('second.pdf');
    expect(output('pandoc "in.md" -o "out.pdf" --output "third.pdf"')).toBe('third.pdf');
    expect(output('pandoc "in.md" --output="a.pdf" -o="b.pdf"')).toBe('b.pdf');
  });

  test('names nothing when there is no output flag, or nothing after it', () => {
    expect(output('pandoc "in.md"')).toBeUndefined();
    expect(output('pandoc "in.md" -o')).toBeUndefined();
    expect(output('pandoc "in.md" --output')).toBeUndefined();
    expect(output('')).toBeUndefined();
    // A trailing `-o` overrides the earlier one and names nothing, rather than silently keeping the first.
    expect(output('pandoc "in.md" -o "out.pdf" -o')).toBeUndefined();
  });

  test('an empty path is a value, not a missing one', () => {
    expect(output('pandoc "in.md" -o ""')).toBe('');
  });

  test('a value glued to a short flag is not an output path', () => {
    // `-oout.pdf` is a cluster ending in `f`. Reading it as a path would be a guess; the caller reports it instead.
    expect(output('pandoc "in.md" -oout.pdf')).toBeUndefined();
  });
});
