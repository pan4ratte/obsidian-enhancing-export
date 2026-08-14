import { capabilities, droppedBy, resolveEngine, unsupportedBy, writesPdf, writesTypstPdf, type EngineMode } from '../../src/pandoc/engine';
import type { ExportSetting } from '../../src/settings';
import export_templates from '../../src/templates/export_templates';

const template = (name: string) => export_templates[name];

describe('resolveEngine', () => {
  test('the wasm build everywhere, where that is what was asked for', () => {
    expect(resolveEngine('wasm', false)).toBe('wasm');
    expect(resolveEngine('wasm', true)).toBe('wasm');
  });

  test('left to itself, it is the installed pandoc on a desktop and the wasm build on a phone', () => {
    expect(resolveEngine('auto', false)).toBe('native');
    expect(resolveEngine('auto', true)).toBe('wasm');
    expect(resolveEngine(undefined, true)).toBe('wasm');
  });

  test('the `native` older settings hold reads as auto, which on a phone is the wasm build', () => {
    const legacy = 'native' as unknown as EngineMode;
    expect(resolveEngine(legacy, false)).toBe('native');
    expect(resolveEngine(legacy, true)).toBe('wasm');
  });
});

describe('capabilities', () => {
  test('the installed pandoc can do all of it', () => {
    expect(capabilities('native')).toMatchObject({ pdf: true, commands: true, network: true });
  });

  test('the wasm build can start nothing and reach nothing', () => {
    expect(capabilities('wasm')).toMatchObject({ pdf: false, commands: false, network: false, jsonFilters: false });
  });

  test('on a desktop it can still be handed a file from outside the vault', () => {
    expect(capabilities('wasm', false).wholeFileSystem).toBe(true);
    expect(capabilities('wasm', true).wholeFileSystem).toBe(false);
  });
});

describe('writesPdf', () => {
  test('reads the writer where the template names one', () => {
    expect(writesPdf(template('PDF'))).toBe(true);
  });

  test('sees the pdf a slide deck writes through beamer', () => {
    expect(writesPdf(template('Beamer slides (.pdf)'))).toBe(true);
  });

  test('leaves everything else alone', () => {
    expect(writesPdf(template('Word (.docx)'))).toBe(false);
    expect(writesPdf(template('Html'))).toBe(false);
    expect(writesPdf(template('Latex'))).toBe(false);
    expect(writesPdf(template('Custom'))).toBe(false);
  });
});

describe('unsupportedBy', () => {
  test('the installed pandoc refuses nothing', () => {
    for (const setting of Object.values(export_templates)) {
      expect(unsupportedBy(setting, 'native')).toBeUndefined();
    }
  });

  test('the wasm build refuses a pdf it would need LaTeX for, and a command of your own', () => {
    expect(unsupportedBy(template('PDF'), 'wasm')).toBe('pdf');
    expect(unsupportedBy(template('Beamer slides (.pdf)'), 'wasm')).toBe('pdf');
    expect(unsupportedBy(template('Custom'), 'wasm')).toBe('command');
  });

  test('and runs everything else', () => {
    expect(unsupportedBy(template('Word (.docx)'), 'wasm')).toBeUndefined();
    expect(unsupportedBy(template('Epub'), 'wasm')).toBeUndefined();
    expect(unsupportedBy(template('Latex'), 'wasm')).toBeUndefined();
  });

  test('a PDF typst makes is one it can run — that build it carries', () => {
    expect(unsupportedBy(template('PDF (Typst)'), 'wasm')).toBeUndefined();
  });
});

describe('writesTypstPdf', () => {
  test('the template that writes a pdf from the typst writer', () => {
    expect(writesTypstPdf(template('PDF (Typst)'))).toBe(true);
  });

  test('and nothing else — not the LaTeX pdf, and not the typst source it stops at', () => {
    expect(writesTypstPdf(template('PDF'))).toBe(false);
    expect(writesTypstPdf(template('Beamer slides (.pdf)'))).toBe(false);
    expect(writesTypstPdf(template('Typst'))).toBe(false);
  });
});

describe('droppedBy', () => {
  /** A template as the settings hold one, with whatever was typed into its three argument fields. */
  const edited = (args: Partial<ExportSetting>): ExportSetting => ({ ...template('Word (.docx)'), ...args }) as ExportSetting;

  test('the templates that ship drop nothing', () => {
    for (const setting of Object.values(export_templates)) {
      expect({ name: setting.name, dropped: droppedBy(setting, 'wasm') }).toEqual({ name: setting.name, dropped: [] });
    }
  });

  test('the installed pandoc drops nothing whatever the template asks for', () => {
    expect(droppedBy(edited({ userArguments: '--filter=pandoc-crossref' }), 'native')).toEqual([]);
  });

  test('a json filter is a program, and there is nothing to run one with', () => {
    expect(droppedBy(edited({ userArguments: '--filter=pandoc-crossref' }), 'wasm')).toEqual(['--filter=pandoc-crossref']);
  });

  test('all three argument fields are read, and the order they were written in is kept', () => {
    const setting = edited({ customArguments: '--frobnicate', userArguments: '--filter pandoc-crossref' });
    expect(droppedBy(setting, 'wasm')).toEqual(['--frobnicate', '--filter=pandoc-crossref']);
  });

  test('the first option is not eaten as the name of the program', () => {
    expect(droppedBy(edited({ arguments: '--frobnicate', customArguments: '', userArguments: '' }), 'wasm')).toEqual(['--frobnicate']);
  });

  test("a template's own variables are values, not options, and go by unread", () => {
    expect(droppedBy(edited({ userArguments: '--resource-path="${embedDirs}"' }), 'wasm')).toEqual([]);
  });
});
