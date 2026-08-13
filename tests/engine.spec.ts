import { capabilities, resolveEngine, unsupportedBy, writesPdf } from '../src/engine';
import export_templates from '../src/export_templates';

const template = (name: string) => export_templates[name];

describe('resolveEngine', () => {
  test('a named engine is the one used, wherever it is', () => {
    expect(resolveEngine('native', true)).toBe('native');
    expect(resolveEngine('wasm', false)).toBe('wasm');
  });

  test('left to itself, it is the installed pandoc on a desktop and the wasm build on a phone', () => {
    expect(resolveEngine('auto', false)).toBe('native');
    expect(resolveEngine('auto', true)).toBe('wasm');
    expect(resolveEngine(undefined, true)).toBe('wasm');
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

  test('the wasm build refuses a pdf and a command of your own', () => {
    expect(unsupportedBy(template('PDF'), 'wasm')).toBe('pdf');
    expect(unsupportedBy(template('Beamer slides (.pdf)'), 'wasm')).toBe('pdf');
    expect(unsupportedBy(template('Custom'), 'wasm')).toBe('command');
  });

  test('and runs everything else', () => {
    expect(unsupportedBy(template('Word (.docx)'), 'wasm')).toBeUndefined();
    expect(unsupportedBy(template('Epub'), 'wasm')).toBeUndefined();
    expect(unsupportedBy(template('Latex'), 'wasm')).toBeUndefined();
  });
});
