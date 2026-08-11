import os from 'os';
import path from 'path';
import { exec as execSync, ExecException } from 'child_process';
import { readFile } from 'fs/promises';

/** This directory. Everything below resolves against it, so no test depends on the working directory. */
const here = import.meta.dirname;

export async function exec(cmd: string, options: { lineSeparator: '\n' | '\r\n' | '\r' }): Promise<string> {
  function lineSeparator(s?: string, ls?: '\n' | '\r\n' | '\r') {
    if (!s || os.EOL === ls || !ls) {
      return s;
    }
    return s.replaceAll(os.EOL, ls);
  }
  return await new Promise((resolve, reject) => {
    execSync(cmd, { encoding: 'utf-8', cwd: here }, (e: ExecException, stdout: string, stderr: string) => {
      if (!e) {
        resolve(lineSeparator(stdout, options?.lineSeparator));
      } else {
        reject(new Error(lineSeparator(stderr, options?.lineSeparator)));
      }
    });
  });
}

/**
 * A fixture as the filter leaves it, in native form. `dir` is the folder in `lua-filters/` the filter is vendored in;
 * `from` the reader spec the note is read with.
 */
export const convert = async (name: string, filter?: string, options?: { dir?: string; from?: string }) => {
  const input_file = path.join(here, 'markdowns', `${name}.md`);
  const from = options?.from ?? 'markdown';
  let pandoc: string;
  if (filter) {
    const lua_script = path.join(here, '..', 'lua-filters', options?.dir ?? 'bundled', `${filter}.lua`);
    pandoc = `pandoc -s -L "${lua_script}" -t native -f ${from} "${input_file}" -o -`;
  } else {
    pandoc = `pandoc -s -t native -f ${from} "${input_file}" -o -`;
  }
  return await exec(pandoc, { lineSeparator: '\n' });
};

export const testConversion = async (name: string, filter?: string, options?: { dir?: string; from?: string }) => {
  const expect_out = path.join(here, 'markdowns', `${name}.out`);
  expect(await convert(name, filter, options)).toBe(await readFile(expect_out, { encoding: 'utf-8', flag: 'r' }));
};
