/*
 * A PDF, made the way an export makes one: the real pandoc build writes the typst source, the real typst build sets it.
 *
 * Skipped unless both binaries are named — they are 56 MB and 27 MB, so neither is kept in the repository:
 *
 *   PANDOC_WASM=/path/to/pandoc.wasm TYPST_WASM=/path/to/typst.wasm TYPST_FONTS=/path/to/fonts \
 *     npx vitest run tests/wasm/wasmTypstPdf.spec.ts
 */

import { existsSync, readdirSync, readFileSync } from 'fs';
import { join } from 'path';
import { convertWithWasm } from '../../src/wasm/convert';
import { PandocWasm } from '../../src/wasm/runtime';
import { pandocWasmSupport } from '../../src/wasm/support';
import { loadTypst, type TypstWasm } from '../../src/wasm/typst';
import type { FileStore } from '../../src/system/file_store';

const pandocBinary = process.env['PANDOC_WASM'];
const typstBinary = process.env['TYPST_WASM'];
const fontDir = process.env['TYPST_FONTS'];
const available = [pandocBinary, typstBinary, fontDir].every(path => !!path && existsSync(path));

const store = (files: Record<string, string | Uint8Array> = {}) => {
  const written = new Map<string, Uint8Array>();
  const all = new Map<string, Uint8Array>(
    Object.entries(files).map(([path, data]) => [path, typeof data === 'string' ? new TextEncoder().encode(data) : data])
  );
  return {
    written,
    store: {
      read: (path: string) => Promise.resolve(all.get(path)),
      write: (path: string, data: Uint8Array) => {
        written.set(path, data);
        return Promise.resolve();
      },
    } as unknown as FileStore,
  };
};

const header = (bytes?: Uint8Array) => new TextDecoder().decode((bytes ?? new Uint8Array()).slice(0, 5));

describe.skipIf(!available)('a PDF, end to end', () => {
  let pandoc: PandocWasm;
  let typst: TypstWasm;

  beforeAll(async () => {
    expect((await pandocWasmSupport()).ok).toBe(true);
    pandoc = await PandocWasm.load(await WebAssembly.compile(readFileSync(pandocBinary)));
    const fonts = readdirSync(fontDir)
      .filter(name => /\.(ttf|otf)$/i.test(name))
      .map(name => new Uint8Array(readFileSync(join(fontDir, name))));
    typst = await loadTypst(new Uint8Array(readFileSync(typstBinary)), fonts);
  }, 180_000);

  test('turns a note into a PDF', async () => {
    const note = '# Заголовок\n\nText with $E = mc^2$ and a table.\n\n| a | b |\n|---|--:|\n| 1 | 2 |\n';
    const files = store({ '/vault/Notes/note.md': note });

    const result = await convertWithWasm(pandoc, files.store, {
      command: 'pandoc "/vault/Notes/note.md" -f markdown -t typst -s -o "/vault/Notes/note.pdf"',
      vaultDir: '/vault',
      typst,
    });

    expect(result.written).toEqual(['/vault/Notes/note.pdf']);
    expect(header(files.written.get('/vault/Notes/note.pdf'))).toBe('%PDF-');
    // The source pandoc wrote is a step on the way, not something the vault is left holding.
    expect([...files.written.keys()]).not.toContain('/vault/Notes/note.typ');
  }, 120_000);

  test('sets an image the note carries', async () => {
    // The smallest PNG there is, so the run has a real picture to place.
    const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');
    const files = store({
      '/vault/Notes/note.md': '![a picture](../Attachments/a.png)\n',
      '/vault/Attachments/a.png': new Uint8Array(png),
    });

    const result = await convertWithWasm(pandoc, files.store, {
      command: 'pandoc "/vault/Notes/note.md" -f markdown -t typst -s -o "/vault/Notes/note.pdf"',
      vaultDir: '/vault',
      resources: ['/vault/Attachments/a.png'],
      typst,
    });

    expect(result.stderr).not.toContain('error');
    expect(header(files.written.get('/vault/Notes/note.pdf'))).toBe('%PDF-');
  }, 120_000);

  test('fetches an image the note names by URL and sets that too', async () => {
    const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');
    const files = store({ '/vault/Notes/note.md': '![remote](https://example.com/a.png)\n' });

    const result = await convertWithWasm(pandoc, files.store, {
      command: 'pandoc "/vault/Notes/note.md" -f markdown -t typst -s -o "/vault/Notes/note.pdf"',
      vaultDir: '/vault',
      typst,
      download: () => Promise.resolve(new Uint8Array(png)),
    });

    // The URL is gone from the document by the time pandoc reads the image: nothing is left to complain about it.
    expect(result.stderr).not.toContain('example.com');
    expect(header(files.written.get('/vault/Notes/note.pdf'))).toBe('%PDF-');
  }, 120_000);
});
