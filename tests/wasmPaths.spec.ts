import { VirtualPaths } from '../src/wasm/paths';
import { basename, dirname, extname, isAbsolute, normalize, resolve, stem } from '../src/paths';

describe('path pieces', () => {
  test('normalize squares up separators and drops a trailing one', () => {
    expect(normalize('C:\\vault\\Notes\\')).toBe('C:/vault/Notes');
    expect(normalize('/vault/Notes')).toBe('/vault/Notes');
  });

  test('basename and dirname read the last piece off', () => {
    expect(basename('C:\\vault\\Notes\\a note.md')).toBe('a note.md');
    expect(dirname('C:\\vault\\Notes\\a note.md')).toBe('C:/vault/Notes');
    expect(dirname('a.md')).toBe('');
  });
});

describe('resolve', () => {
  test('an absolute path is already the answer', () => {
    expect(isAbsolute('/a/b')).toBe(true);
    expect(isAbsolute('C:\\a')).toBe(true);
    expect(isAbsolute('a/b')).toBe(false);
    expect(resolve('/vault/Notes', '/other/a.md')).toBe('/other/a.md');
    expect(resolve('/vault/Notes', 'C:/other/a.md')).toBe('C:/other/a.md');
  });

  test('a relative one is read against the folder the command runs in', () => {
    // The import command names the note it writes relatively, from the folder it is written into.
    expect(resolve('/vault/Notes', 'note.md')).toBe('/vault/Notes/note.md');
    expect(resolve('/vault/Notes', './note.md')).toBe('/vault/Notes/note.md');
    expect(resolve('/vault/Notes', '../Attachments/a.png')).toBe('/vault/Attachments/a.png');
    expect(resolve('/vault/a/b/c', '../../x')).toBe('/vault/a/x');
  });

  test('a climb with nothing above it is left as it stands rather than silently becoming another path', () => {
    expect(resolve('a', '../../x')).toBe('../x');
  });
});

describe('VirtualPaths', () => {
  test('a file in the vault stands where it does, relative to the vault', () => {
    const paths = new VirtualPaths('/home/me/vault');
    expect(paths.file('/home/me/vault/Notes/a.md')).toBe('Notes/a.md');
    expect(paths.directory('/home/me/vault/Attachments')).toBe('Attachments');
    expect(paths.directory('/home/me/vault')).toBe('.');
  });

  test('a windows path is matched whatever it is spelled like', () => {
    const paths = new VirtualPaths('C:\\Users\\me\\vault');
    expect(paths.file('C:/users/ME/vault/Notes/a.md')).toBe('Notes/a.md');
  });

  test('a file outside the vault is given a folder of its own', () => {
    const paths = new VirtualPaths('/vault');
    expect(paths.file('/elsewhere/ref.docx')).toBe('_external/0/ref.docx');
    // The same folder again is the same folder, so two files from it stay together.
    expect(paths.file('/elsewhere/style.csl')).toBe('_external/0/style.csl');
    expect(paths.file('/other/ref.docx')).toBe('_external/1/ref.docx');
  });

  test('two files of the same name from different folders do not collide', () => {
    const paths = new VirtualPaths('/vault');
    expect(paths.file('/a/ref.docx')).not.toBe(paths.file('/b/ref.docx'));
  });

  test('what was mapped can be traced back', () => {
    const paths = new VirtualPaths('/vault');
    const virtual = paths.file('/vault/Notes/a.md');
    expect(paths.toReal(virtual)).toBe('/vault/Notes/a.md');
    expect(paths.toReal('_external/9/nothing')).toBeUndefined();
  });

  test('a file pandoc wrote into a folder it was given lands under that folder', () => {
    const paths = new VirtualPaths('/vault');
    const media = paths.directory('/exports');
    // Extracted media keeps whatever nesting pandoc gave it under the folder it was told to use.
    expect(paths.toReal(`${media}/media/image1.png`)).toBe('/exports/media/image1.png');
  });

  test('and so does one written inside the vault', () => {
    const paths = new VirtualPaths('/vault');
    expect(paths.toReal(`${paths.directory('/vault/Exports')}/media/a.png`)).toBe('/vault/Exports/media/a.png');
  });

  test('inVault answers only for what is inside it', () => {
    const paths = new VirtualPaths('/vault');
    expect(paths.inVault('/vault/a.md')).toBe('a.md');
    expect(paths.inVault('/vaultish/a.md')).toBeUndefined();
    expect(paths.inVault('/elsewhere/a.md')).toBeUndefined();
  });
});

describe('extname and stem', () => {
  test('read the extension off a name, and the name off it', () => {
    expect(extname('/vault/Notes/a note.md')).toBe('.md');
    expect(stem('/vault/Notes/a note.md')).toBe('a note');
    expect(extname('archive.tar.gz')).toBe('.gz');
    expect(stem('archive.tar.gz')).toBe('archive.tar');
  });

  test('a name with no extension has none, and a dotfile is a name', () => {
    expect(extname('/vault/README')).toBe('');
    expect(stem('/vault/README')).toBe('README');
    expect(extname('.gitignore')).toBe('');
    expect(stem('.gitignore')).toBe('.gitignore');
  });
});
