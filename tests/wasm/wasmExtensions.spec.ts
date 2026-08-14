/*
 * What the wasm build can be given past itself.
 *
 * The downloads are not exercised here — there is no network in a test run, and the manager's own share of that is a
 * loop. What is: where the files go, what a template is told to call them, and the one extension that is written
 * rather than fetched, which is checked against the real binary when it is named. See wasmConvert.spec.ts.
 */

import { existsSync, readFileSync } from 'fs';
import { ExtensionManager, EXTENSIONS } from '../../src/wasm/extensions';
import { PandocWasm } from '../../src/wasm/runtime';
import { pandocWasmSupport } from '../../src/wasm/support';

const CONFIG = '.config';
const DIR = `${CONFIG}/plugins/pandoc-gui`;

/** A vault that is a map, and settings nobody but the test writes. */
const plugin = (wasmVersion = '3.10.2') => {
  const files = new Map<string, ArrayBuffer>();
  const made: string[] = [];
  return {
    files,
    made,
    manifest: { dir: DIR },
    settings: { wasmVersion },
    app: {
      vault: {
        adapter: {
          exists: (path: string) => Promise.resolve(files.has(path)),
          mkdir: (path: string) => {
            made.push(path);
            return Promise.resolve();
          },
          writeBinary: (path: string, data: ArrayBuffer) => {
            files.set(path, data);
            return Promise.resolve();
          },
          remove: (path: string) => {
            files.delete(path);
            return Promise.resolve();
          },
        },
      },
    },
  };
};

const manager = (p = plugin()) => new ExtensionManager(p as unknown as ConstructorParameters<typeof ExtensionManager>[0]);

describe('where an extension is put', () => {
  test('a folder of the plugin, and the path a template writes to reach it', () => {
    const extensions = manager();
    expect(extensions.directory('csl')).toBe(`${DIR}/csl`);
    expect(extensions.templatePath('csl')).toBe('${pluginDir}/csl');
  });

  test('nothing is installed until a file of it is there', async () => {
    const p = plugin();
    const extensions = manager(p);
    expect(await extensions.isInstalled('csl')).toBe(false);

    p.files.set(`${DIR}/csl/apa.csl`, new ArrayBuffer(1));
    expect(await extensions.isInstalled('csl')).toBe(true);
  });

  test('removing takes away every file it brought, and nothing else', async () => {
    const p = plugin();
    const extensions = manager(p);
    for (const file of EXTENSIONS.csl.files('')) {
      p.files.set(`${DIR}/csl/${file.name}`, new ArrayBuffer(1));
    }
    p.files.set(`${DIR}/csl/mine.csl`, new ArrayBuffer(1));

    await extensions.remove('csl');

    expect(await extensions.isInstalled('csl')).toBe(false);
    // A style of the user's own is in the same folder and is none of the manager's business.
    expect(p.files.has(`${DIR}/csl/mine.csl`)).toBe(true);
  });
});

describe('pandoc’s own data files', () => {
  test('are read from the tag of the build that is installed', () => {
    const files = EXTENSIONS.templates.files('3.10.2');
    expect(files[0].url).toContain('/jgm/pandoc/3.10.2/data/templates/');
  });

  test('and from the branch when there is no version to name', () => {
    expect(EXTENSIONS.templates.files('').every(file => file.url.includes('/pandoc/main/'))).toBe(true);
  });
});

const binary = process.env['PANDOC_WASM'];

describe.skipIf(!(binary && existsSync(binary)))('the reference documents', () => {
  let pandoc: PandocWasm;

  beforeAll(async () => {
    expect((await pandocWasmSupport()).ok).toBe(true);
    pandoc = await PandocWasm.load(await WebAssembly.compile(readFileSync(binary)));
  }, 120_000);

  test('are written by pandoc rather than downloaded', async () => {
    const p = plugin();
    await manager(p).install('reference', undefined, pandoc);

    for (const name of ['reference.docx', 'reference.odt', 'reference.pptx']) {
      const written = p.files.get(`${DIR}/reference/${name}`) ?? new ArrayBuffer(0);
      // Every one of the three is a zip, and every zip starts `PK`.
      const head = new TextDecoder().decode(new Uint8Array(written).slice(0, 2));
      expect({ name, head, big: written.byteLength > 1000 }).toEqual({ name, head: 'PK', big: true });
    }
  }, 120_000);

  test('and are refused rather than half written where there is no pandoc to write them', async () => {
    await expect(manager().install('reference')).rejects.toThrow(/no pandoc/);
  });
});
