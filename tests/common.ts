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

export const testConversion = async (name: string, filter?: string) => {
  const input_file = path.join(here, 'markdowns', `${name}.md`);
  const expect_out = path.join(here, 'markdowns', `${name}.out`);
  let pandoc: string;
  if (filter) {
    const lua_script = path.join(here, '..', 'lua-filters', 'bundled', `${filter}.lua`);
    pandoc = `pandoc -s -L "${lua_script}" -t native -f markdown "${input_file}" -o -`;
  } else {
    pandoc = `pandoc -s -t native -f markdown "${input_file}" -o -`;
  }
  const ret = await exec(pandoc, { lineSeparator: '\n' });
  expect(ret).toBe(await readFile(expect_out, { encoding: 'utf-8', flag: 'r' }));
};
