import { DEFAULT_SETTINGS, restoreTemplates, type PandocGuiSettings } from '../src/settings';

/*
 * What a vault gets back when it starts: its own templates, and the defaults it has not been given yet — never one it
 * deleted, which used to reappear on every restart.
 */

const DEFAULT_NAMES = DEFAULT_SETTINGS.items.map(o => o.name);
const names = (saved: Partial<PandocGuiSettings> | null) => restoreTemplates(saved).items.map(o => o.name);

describe('restoreTemplates', () => {
  test('a vault with nothing saved gets every default', () => {
    expect(names(null)).toEqual(DEFAULT_NAMES);
    expect(restoreTemplates(null).seededTemplates).toEqual(DEFAULT_NAMES);
  });

  test('a deleted default stays deleted', () => {
    const saved = { items: DEFAULT_SETTINGS.items.filter(o => o.name !== 'PDF'), seededTemplates: DEFAULT_NAMES };
    expect(names(saved)).not.toContain('PDF');
  });

  test('a vault that deleted every template keeps none', () => {
    expect(names({ items: [], seededTemplates: DEFAULT_NAMES })).toEqual([]);
  });

  test('a default added by a later release arrives', () => {
    const saved = {
      items: DEFAULT_SETTINGS.items.filter(o => o.name !== 'PDF'),
      seededTemplates: DEFAULT_NAMES.filter(n => n !== 'PDF'),
    };
    expect(names(saved)).toContain('PDF');
  });

  test('a save from before the list was written is taken as having had them all', () => {
    const saved = { items: DEFAULT_SETTINGS.items.filter(o => o.name !== 'PDF') };
    expect(names(saved)).not.toContain('PDF');
    expect(restoreTemplates(saved).seededTemplates).toEqual(DEFAULT_NAMES);
  });

  test('a template stored as a diff is filled back out, and a husk of one no longer seeded is dropped', () => {
    const restored = restoreTemplates({
      items: [{ name: 'PDF', openExportedFile: false }, { name: 'Gone' }] as PandocGuiSettings['items'],
      seededTemplates: [...DEFAULT_NAMES, 'Gone'],
    });
    const pdf = restored.items.find(o => o.name === 'PDF');
    expect(pdf).toMatchObject({ type: 'pandoc', extension: '.pdf', openExportedFile: false });
    expect(restored.items.map(o => o.name)).not.toContain('Gone');
  });

  test('the defaults themselves are not handed out to be edited', () => {
    const restored = restoreTemplates(null);
    restored.items[0].name = 'Renamed';
    expect(DEFAULT_SETTINGS.items[0].name).not.toBe('Renamed');
  });
});
