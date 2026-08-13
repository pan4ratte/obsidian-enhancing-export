import { importedNotePath } from '../src/import';
import { relativeTo } from '../src/paths';

describe('importedNotePath', () => {
  test('the note takes the document’s own name, in the folder that was asked for', () => {
    expect(importedNotePath('C:/Users/me/Documents/A paper.docx', 'Imported')).toBe('Imported/A paper.md');
    expect(importedNotePath('/home/me/notes.odt', '')).toBe('notes.md');
  });
});

describe('relativeTo', () => {
  test('names a folder from another, which is how the command says where the images go', () => {
    expect(relativeTo('/vault/Notes', '/vault/Notes/media')).toBe('media');
    expect(relativeTo('/vault/Notes', '/vault/Attachments')).toBe('../Attachments');
    expect(relativeTo('/vault/a/b', '/vault/c')).toBe('../../c');
  });

  test('a folder relative to itself is the folder it is in', () => {
    expect(relativeTo('/vault/Notes', '/vault/Notes')).toBe('.');
  });

  test('separators are squared up, so a windows path reads like any other', () => {
    expect(relativeTo('C:\\vault\\Notes', 'C:\\vault\\Attachments')).toBe('../Attachments');
  });
});
