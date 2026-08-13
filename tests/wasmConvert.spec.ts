/*
 * The whole wasm path, against the real binary.
 *
 * Skipped unless PANDOC_WASM names a `pandoc.wasm` — it is 56 MB, so it is not something to keep in the repository or
 * download on every run. To run these:
 *
 *   PANDOC_WASM=/path/to/pandoc.wasm npx vitest run tests/wasmConvert.spec.ts
 *
 * Node keeps wasm exception handling behind a flag, as Obsidian's desktop build does; `pandocWasmSupport` is what
 * turns it on in both, so it is called here for the same reason the plugin calls it.
 */

import { existsSync, readFileSync } from 'fs';
import { convertWithWasm } from '../src/wasm/convert';
import { PandocWasm } from '../src/wasm/runtime';
import { pandocWasmSupport } from '../src/wasm/support';
import type { FileStore } from '../src/file_store';

const binary = process.env['PANDOC_WASM'];
const available = !!binary && existsSync(binary);

/** A file system that is a map, so a test can say what is on it and read back what was written. */
const store = (files: Record<string, string> = {}) => {
  const written = new Map<string, Uint8Array>();
  const all = new Map<string, Uint8Array>(Object.entries(files).map(([path, text]) => [path, new TextEncoder().encode(text)]));
  return {
    written,
    text: (path: string) => new TextDecoder().decode(written.get(path)),
    store: {
      read: (path: string) => Promise.resolve(all.get(path)),
      write: (path: string, data: Uint8Array) => {
        written.set(path, data);
        all.set(path, data);
        return Promise.resolve();
      },
    } as unknown as FileStore,
  };
};

describe.skipIf(!available)('the wasm build', () => {
  let pandoc: PandocWasm;

  beforeAll(async () => {
    expect((await pandocWasmSupport()).ok).toBe(true);
    pandoc = await PandocWasm.load(await WebAssembly.compile(readFileSync(binary)));
    // The first conversion carries the runtime's own start-up, which is seconds rather than the half-second the rest take.
  }, 120_000);

  test('says which pandoc it is', () => {
    expect(pandoc.version).toMatch(/^\d+\.\d+/);
  });

  test('converts a note the plugin names by its path on the machine', async () => {
    const files = store({ '/vault/Notes/note.md': '# Heading\n\nSome *text*.\n' });
    const result = await convertWithWasm(pandoc, files.store, {
      command: 'pandoc "/vault/Notes/note.md" -f markdown -t html -s -o "/vault/Exports/note.html"',
      vaultDir: '/vault',
    });
    expect(result.written).toEqual(['/vault/Exports/note.html']);
    expect(files.text('/vault/Exports/note.html')).toContain('<h1 id="heading">Heading</h1>');
  });

  test('writes a docx, which is bytes rather than text', async () => {
    const files = store({ '/vault/note.md': '# Heading\n' });
    await convertWithWasm(pandoc, files.store, {
      command: 'pandoc "/vault/note.md" -f markdown -t docx -o "/vault/note.docx"',
      vaultDir: '/vault',
    });
    const docx = files.written.get('/vault/note.docx');
    // A docx is a zip, and every zip starts `PK`.
    expect(docx?.[0]).toBe(0x50);
    expect(docx?.[1]).toBe(0x4b);
  });

  test('runs a lua filter out of the plugin folder', async () => {
    const files = store({
      '/vault/note.md': '# hello world\n',
      '/vault/.config/plugins/pandoc-gui/lua/shout.lua': `function Str(el) return pandoc.Str(el.text:upper()) end`,
    });
    const result = await convertWithWasm(pandoc, files.store, {
      command:
        'pandoc "/vault/note.md" -f markdown -t html --lua-filter="/vault/.config/plugins/pandoc-gui/lua/shout.lua" -o "/vault/out.html"',
      vaultDir: '/vault',
    });
    expect(result.stderr).toBe('');
    expect(files.text('/vault/out.html')).toContain('HELLO WORLD');
  });

  test('finds an image through the resource path, and carries it into the document', async () => {
    const files = store({ '/vault/Notes/note.md': '![](picture.png)\n' });
    // A one-pixel png, as the bytes pandoc will embed.
    const png = new Uint8Array(
      Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64')
    );
    await files.store.write('/vault/Attachments/picture.png', png);

    const result = await convertWithWasm(pandoc, files.store, {
      command:
        'pandoc "/vault/Notes/note.md" -f markdown -t html --embed-resources -s --resource-path="/vault/Notes" --resource-path="/vault/Attachments" -o "/vault/out.html"',
      vaultDir: '/vault',
      resources: ['/vault/Attachments/picture.png'],
    });
    expect(result.stderr).toBe('');
    expect(files.text('/vault/out.html')).toContain('data:image/png;base64');
  });

  test('reads a note from outside the vault, which has no place of its own in there', async () => {
    const files = store({ '/vault/note.md': '# T\n\n[@smith2020]\n' });
    await files.store.write(
      '/elsewhere/refs.bib',
      new TextEncoder().encode('@article{smith2020, author={Smith, John}, title={A title}, year={2020}, journal={J}}')
    );
    const result = await convertWithWasm(pandoc, files.store, {
      command: 'pandoc "/vault/note.md" -f markdown -t html --citeproc --bibliography="/elsewhere/refs.bib" -o "/vault/out.html"',
      vaultDir: '/vault',
    });
    expect(result.stderr).toBe('');
    expect(files.text('/vault/out.html')).toContain('Smith');
  });

  test('embeds a note through the list the plugin hands the filter', async () => {
    const embeds = readFileSync('lua-filters/bundled/embeds.lua', 'utf-8');
    const files = store({
      '/vault/note.md': '# Note\n\n![[Other note]]\n',
      '/vault/Other note.md': 'The embedded writing.\n',
      '/vault/lua/embeds.lua': embeds,
    });
    const result = await convertWithWasm(pandoc, files.store, {
      command:
        'pandoc "/vault/note.md" -f markdown+wikilinks_title_after_pipe -t plain --lua-filter="/vault/lua/embeds.lua" -o "/vault/out.txt"',
      vaultDir: '/vault',
      resources: ['/vault/Other note.md'],
      embeds: [['Other note', '/vault/Other note.md']],
    });
    expect(result.stderr).toBe('');
    expect(files.text('/vault/out.txt')).toContain('The embedded writing.');
  });

  test('reports what it could not do rather than failing over it', async () => {
    const files = store({ '/vault/note.md': '# T\n' });
    const result = await convertWithWasm(pandoc, files.store, {
      command: 'pandoc "/vault/note.md" -f markdown -t html --filter=pandoc-crossref -o "/vault/out.html"',
      vaultDir: '/vault',
    });
    expect(result.unsupported).toEqual(['--filter=pandoc-crossref']);
    expect(files.text('/vault/out.html')).toContain('<h1');
  });

  test('a conversion that fails says why', async () => {
    const files = store({ '/vault/note.md': '# T\n' });
    await expect(
      convertWithWasm(pandoc, files.store, {
        command: 'pandoc "/vault/note.md" -f markdown -t html --lua-filter="/vault/missing.lua" -o "/vault/out.html"',
        vaultDir: '/vault',
      })
    ).rejects.toThrow(/missing\.lua/);
  });
});
