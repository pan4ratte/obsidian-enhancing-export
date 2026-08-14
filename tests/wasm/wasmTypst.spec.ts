/*
 * The PDF half of a wasm export: pandoc writes typst source, typst sets it, and only the PDF reaches the disk.
 *
 * Both builds are stood in for here — what is under test is what passes between them.
 */

import { convertWithWasm } from '../../src/wasm/convert';
import type { PandocWasm, WasmFiles } from '../../src/wasm/runtime';
import type { PandocDefaults } from '../../src/wasm/defaults';
import type { TypstWasm } from '../../src/wasm/typst';
import type { FileStore } from '../../src/system/file_store';

const encoder = new TextEncoder();

const store = (files: Record<string, string> = {}) => {
  const written = new Map<string, Uint8Array>();
  const all = new Map<string, Uint8Array>(Object.entries(files).map(([path, text]) => [path, encoder.encode(text)]));
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

/** A pandoc that writes the source it was asked for, and remembers what it was asked. */
const pandocWriting = (source = '#set page(paper: "a4")\nHello.\n') => {
  const asked: { defaults?: PandocDefaults; files?: WasmFiles } = {};
  const pandoc = {
    run(defaults: PandocDefaults, _stdin?: string, files: WasmFiles = {}) {
      asked.defaults = defaults;
      asked.files = files;
      const output = defaults['output-file'];
      return {
        stdout: '',
        stderr: '',
        warnings: [] as unknown[],
        files: typeof output === 'string' ? { [output]: encoder.encode(source) } : {},
      };
    },
  } as unknown as PandocWasm;
  return { pandoc, asked };
};

/** A typst that answers with a PDF, and remembers the document it was handed. */
const typstMaking = (pdf?: Uint8Array, diagnostics = '') => {
  const asked: { main?: string; source?: string; files?: Record<string, Uint8Array> } = {};
  const typst = {
    compile(main: string, source: string, files: Record<string, Uint8Array>) {
      Object.assign(asked, { main, source, files });
      return Promise.resolve({ pdf, diagnostics });
    },
  } as unknown as TypstWasm;
  return { typst, asked };
};

const PDF = new Uint8Array([0x25, 0x50, 0x44, 0x46]);

describe('a PDF made with typst', () => {
  const command = 'pandoc "/vault/Notes/note.md" -f markdown -t typst -s -o "/vault/Notes/note.pdf"';

  test('has pandoc write typst source where the PDF will stand', async () => {
    const files = store({ '/vault/Notes/note.md': '# Heading\n' });
    const { pandoc, asked } = pandocWriting();
    const { typst, asked: typstAsked } = typstMaking(PDF);

    await convertWithWasm(pandoc, files.store, { command, vaultDir: '/vault', typst });

    // The source stands beside the note, so a relative image in it means the same file it always did.
    expect(asked.defaults['output-file']).toBe('Notes/note.typ');
    expect(typstAsked.main).toBe('Notes/note.typ');
    expect(typstAsked.source).toContain('Hello.');
  });

  test('writes the PDF and not the source it was made from', async () => {
    const files = store({ '/vault/Notes/note.md': '# Heading\n' });
    const { pandoc } = pandocWriting();
    const { typst } = typstMaking(PDF);

    const result = await convertWithWasm(pandoc, files.store, { command, vaultDir: '/vault', typst });

    expect(result.written).toEqual(['/vault/Notes/note.pdf']);
    expect(files.written.get('/vault/Notes/note.pdf')).toEqual(PDF);
    expect([...files.written.keys()]).not.toContain('/vault/Notes/note.typ');
  });

  test('hands typst the note’s own images', async () => {
    const files = store({ '/vault/Notes/note.md': '# Heading\n', '/vault/Attachments/a.png': 'PNG' });
    const { pandoc } = pandocWriting();
    const { typst, asked } = typstMaking(PDF);

    await convertWithWasm(pandoc, files.store, {
      command,
      vaultDir: '/vault',
      resources: ['/vault/Attachments/a.png'],
      typst,
    });

    expect(Object.keys(asked.files)).toContain('Attachments/a.png');
  });

  test('reports what typst said about a document it still set', async () => {
    const files = store({ '/vault/Notes/note.md': '# Heading\n' });
    const { pandoc } = pandocWriting();
    const { typst } = typstMaking(PDF, 'warning: unknown font family');

    const result = await convertWithWasm(pandoc, files.store, { command, vaultDir: '/vault', typst });

    expect(result.stderr).toContain('unknown font family');
  });

  test('fails with what typst said when no PDF came of it', async () => {
    const files = store({ '/vault/Notes/note.md': '# Heading\n' });
    const { pandoc } = pandocWriting();
    const { typst } = typstMaking(undefined, 'error: unclosed delimiter');

    await expect(convertWithWasm(pandoc, files.store, { command, vaultDir: '/vault', typst })).rejects.toThrow('unclosed delimiter');
  });

  test('leaves an export that is not a PDF alone', async () => {
    const files = store({ '/vault/Notes/note.md': '# Heading\n' });
    const { pandoc, asked } = pandocWriting();
    const { typst, asked: typstAsked } = typstMaking(PDF);

    const result = await convertWithWasm(pandoc, files.store, {
      command: 'pandoc "/vault/Notes/note.md" -f markdown -t typst -s -o "/vault/Notes/note.typ"',
      vaultDir: '/vault',
      typst,
    });

    expect(asked.defaults['output-file']).toBe('Notes/note.typ');
    expect(typstAsked.main).toBeUndefined();
    expect(result.written).toEqual(['/vault/Notes/note.typ']);
  });
});
