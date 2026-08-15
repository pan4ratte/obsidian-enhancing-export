/*
 * The PDF a machine makes when its pandoc has no typst to run: the installed program writes the source, the plugin's
 * own wasm build sets it.
 *
 * Skipped unless the typst build is named — it is 27 MB, so it is not kept in the repository — and unless there is a
 * pandoc on the machine to run:
 *
 *   TYPST_WASM=/path/to/typst.wasm TYPST_FONTS=/path/to/fonts npx vitest run tests/convert/typstPdfNative.spec.ts
 */

import { execSync } from 'child_process';
import { existsSync, mkdtempSync, readdirSync, readFileSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { typesetTypstPdf } from '../../src/convert/typst_pdf';
import { exec } from '../../src/system/utils';
import { loadTypst, type TypstWasm } from '../../src/wasm/typst';
import type { FileStore } from '../../src/system/file_store';

const typstBinary = process.env['TYPST_WASM'];
const fontDir = process.env['TYPST_FONTS'];

const pandocInstalled = (() => {
  try {
    execSync('pandoc --version', { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
})();

const available = pandocInstalled && [typstBinary, fontDir].every(path => !!path && existsSync(path));

/** The disk itself, which is what the export hands this half — the note and its picture are really there. */
const store = (written: Map<string, Uint8Array>): FileStore =>
  ({
    read: async (path: string) => (existsSync(path) ? new Uint8Array(readFileSync(path)) : undefined),
    write: async (path: string, data: Uint8Array): Promise<void> => void written.set(path, data),
  }) as unknown as FileStore;

const header = (bytes?: Uint8Array) => new TextDecoder().decode((bytes ?? new Uint8Array()).slice(0, 5));

describe.skipIf(!available)('a PDF from the installed pandoc and the bundled typst', () => {
  let typst: TypstWasm;
  let folder: string;

  beforeAll(async () => {
    const fonts = readdirSync(fontDir)
      .filter(name => /\.(ttf|otf)$/i.test(name))
      .map(name => new Uint8Array(readFileSync(join(fontDir, name))));
    typst = await loadTypst(new Uint8Array(readFileSync(typstBinary)), fonts);

    folder = mkdtempSync(join(tmpdir(), 'pandoc-gui-typst-'));
    // The smallest PNG there is, so the run has a real picture to place.
    const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');
    writeFileSync(join(folder, 'cat.png'), png);
    writeFileSync(
      join(folder, 'note.md'),
      '# Заголовок\n\nText with $E = mc^2$.\n\n![a cat](cat.png)\n\n| a | b |\n|---|--:|\n| 1 | 2 |\n'
    );
  }, 180_000);

  test('writes the PDF the command named, picture and all', async () => {
    const written = new Map<string, Uint8Array>();
    const output = join(folder, 'note.pdf').replaceAll('\\', '/');
    const source = join(folder, 'note.md').replaceAll('\\', '/');

    const warnings = await typesetTypstPdf({
      // The command the “PDF (Typst)” template renders, as the export would hand it over.
      command: `pandoc "${source}" --resource-path="${folder.replaceAll('\\', '/')}" -s -o "${output}" -t typst --pdf-engine=typst`,
      run: command => exec(command, { cwd: folder }),
      searchPaths: [folder.replaceAll('\\', '/')],
      outputPath: output,
      typst,
      files: store(written),
    });

    expect([...written.keys()]).toEqual([output]);
    expect(header(written.get(output))).toBe('%PDF-');
    // A note that set cleanly leaves nothing to report, and nothing about a picture it could not find.
    expect(warnings).not.toMatch(/file not found|failed to load/i);
  }, 120_000);
});
