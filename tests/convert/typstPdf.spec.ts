import { gatherAssets, sourceCommand, typesetTypstPdf } from '../../src/convert/typst_pdf';
import type { FileStore } from '../../src/system/file_store';
import type { TypstWasm } from '../../src/wasm/typst';

/*
 * The PDF an installed pandoc cannot make on its own: it writes the typst source, and the plugin's own build sets it.
 * What is tested here is the half that is neither of those programs — finding the pictures the source names, and
 * putting them where a compiler with no file system can reach them.
 */

const NOTE = '/vault/Notes';
const ATTACHMENTS = '/vault/Attachments';

const bytes = (text: string) => new TextEncoder().encode(text);

/** A disk with only the files named on it, keyed by the whole path. */
const disk = (files: Record<string, string>) => async (path: string) => (files[path] ? bytes(files[path]) : undefined);

describe('the pictures a source names', () => {
  test('are found where the export told pandoc to look, and renamed to something flat', async () => {
    const source = '#image("cat.png")\n#image("deep/dog.jpg")';
    const { source: rewritten, files } = await gatherAssets(
      source,
      [NOTE, ATTACHMENTS],
      disk({ '/vault/Notes/cat.png': 'CAT', '/vault/Notes/deep/dog.jpg': 'DOG' })
    );

    expect(Object.keys(files)).toEqual(['/assets/0-cat.png', '/assets/1-dog.jpg']);
    expect(rewritten).toBe('#image("/assets/0-cat.png")\n#image("/assets/1-dog.jpg")');
    expect(new TextDecoder().decode(files['/assets/0-cat.png'])).toBe('CAT');
  });

  test('the folders are tried in the order they were given', async () => {
    const { files } = await gatherAssets('#image("a.png")', [NOTE, ATTACHMENTS], disk({ '/vault/Attachments/a.png': 'ATTACHED' }));
    expect(new TextDecoder().decode(files['/assets/0-a.png'])).toBe('ATTACHED');
  });

  test('an absolute path is read as itself', async () => {
    const { files } = await gatherAssets('#image("/elsewhere/a.png")', [NOTE], disk({ '/elsewhere/a.png': 'OUTSIDE' }));
    expect(new TextDecoder().decode(files['/assets/0-a.png'])).toBe('OUTSIDE');
  });

  test('a windows path arrives escaped and is unescaped to read it', async () => {
    const { source, files } = await gatherAssets('#image("C:\\\\vault\\\\a.png")', [NOTE], disk({ 'C:/vault/a.png': 'WINDOWS' }));
    expect(new TextDecoder().decode(files['/assets/0-a.png'])).toBe('WINDOWS');
    expect(source).toBe('#image("/assets/0-a.png")');
  });

  test('the same picture twice is carried once', async () => {
    const { source, files } = await gatherAssets('#image("a.png")\n#image("a.png")', [NOTE], disk({ '/vault/Notes/a.png': 'ONE' }));
    expect(Object.keys(files)).toEqual(['/assets/0-a.png']);
    expect(source.match(/assets\/0-a\.png/g)).toHaveLength(2);
  });

  test('one that is nowhere is left as it was written, for typst to name in a diagnostic', async () => {
    const { source, files } = await gatherAssets('#image("gone.png")', [NOTE], disk({}));
    expect(files).toEqual({});
    expect(source).toBe('#image("gone.png")');
  });

  test('nothing is rewritten that was not found: a note about typst reads as it was written', async () => {
    // `image("…")` in prose or a code sample is the same run of characters as the one pandoc writes, and telling them
    // apart would take a parser. Finding the file is what decides it, and a sample names none.
    const source = 'Write #image("logo.png") to place a picture.';
    const { source: rewritten, files } = await gatherAssets(source, [NOTE], disk({}));
    expect(files).toEqual({});
    expect(rewritten).toBe(source);
  });
});

describe('the run itself', () => {
  const typst = (pdf?: Uint8Array, diagnostics = ''): TypstWasm =>
    ({ compile: async () => ({ pdf, diagnostics }) }) as unknown as TypstWasm;

  const store = (written: Record<string, Uint8Array>, files: Record<string, string> = {}): FileStore =>
    ({
      read: disk(files),
      write: async (path: string, data: Uint8Array): Promise<void> => void (written[path] = data),
    }) as unknown as FileStore;

  test('pandoc is asked for the source rather than the PDF', () => {
    expect(sourceCommand('pandoc "in.md" -s -o "/out/Note.pdf" -t typst --pdf-engine=typst')).toBe(
      'pandoc "in.md" -s -t typst --pdf-engine=typst'
    );
  });

  test('the PDF typst makes is what lands on disk', async () => {
    const written: Record<string, Uint8Array> = {};
    const warnings = await typesetTypstPdf({
      command: 'pandoc "in.md" -o "/out/Note.pdf" -t typst',
      run: async () => ({ stdout: '#image("a.png")', stderr: '' }),
      searchPaths: [NOTE],
      outputPath: '/out/Note.pdf',
      typst: typst(bytes('%PDF-1.7')),
      files: store(written, { '/vault/Notes/a.png': 'PIC' }),
    });

    expect(new TextDecoder().decode(written['/out/Note.pdf'])).toBe('%PDF-1.7');
    expect(warnings).toBe('');
  });

  test('what either program said on the side is reported as a warning', async () => {
    const written: Record<string, Uint8Array> = {};
    const warnings = await typesetTypstPdf({
      command: 'pandoc "in.md" -o "/out/Note.pdf" -t typst',
      run: async () => ({ stdout: '= Title', stderr: '[WARNING] This is a warning' }),
      searchPaths: [NOTE],
      outputPath: '/out/Note.pdf',
      typst: typst(bytes('%PDF'), 'warning: unknown font'),
      files: store(written),
    });

    expect(warnings).toBe('[WARNING] This is a warning\nwarning: unknown font');
  });

  test('a document typst could not set fails the export, saying why', async () => {
    await expect(
      typesetTypstPdf({
        command: 'pandoc "in.md" -o "/out/Note.pdf" -t typst',
        run: async () => ({ stdout: '= Title', stderr: '' }),
        searchPaths: [NOTE],
        outputPath: '/out/Note.pdf',
        typst: typst(undefined, 'error: unknown variable'),
        files: store({}),
      })
    ).rejects.toThrow('error: unknown variable');
  });

  test('a pandoc that wrote no source at all fails before typst is asked', async () => {
    await expect(
      typesetTypstPdf({
        command: 'pandoc "in.md" -o "/out/Note.pdf" -t typst',
        run: async () => ({ stdout: '   ', stderr: 'pandoc: nothing to do' }),
        searchPaths: [NOTE],
        outputPath: '/out/Note.pdf',
        typst: typst(bytes('%PDF')),
        files: store({}),
      })
    ).rejects.toThrow('pandoc: nothing to do');
  });
});
