import { Platform } from 'obsidian';
import {
  chooseFile,
  chooseSavePath,
  currentPlatform,
  documentsFolder,
  isMobile,
  openExternal,
  openFile,
  showInFolder,
} from '../../src/system/platform';
import { resolveEngine } from '../../src/pandoc/engine';
import { getPlatformValue, setPlatformValue } from '../../src/system/utils';

/*
 * Nothing reaches for node or electron where there is neither to reach.
 *
 * A phone has neither. A desktop emulating one is still a desktop by `isMobileApp`, but Obsidian withholds every node
 * package from a plugin while the emulation is on — so an import there fails with a notice and leaves nothing to call.
 * `Platform.isDesktop` is the flag that turns over in both cases, which is what `isDesktop`/`isMobile` are read from.
 */

const asEmulatedPhone = () => {
  Platform.isDesktop = false;
  Platform.isMobileApp = false;
};

const asDesktop = () => {
  Platform.isDesktop = true;
  Platform.isMobileApp = false;
};

afterEach(asDesktop);

describe('a desktop emulating a phone', () => {
  test('converts with the wasm build, as the phone it is pretending to be would', () => {
    asEmulatedPhone();
    expect(isMobile()).toBe(true);
    // Whatever the engine setting says: an installed pandoc cannot be started from here, so it is not the answer.
    expect(resolveEngine(undefined, isMobile())).toBe('wasm');
    expect(resolveEngine('auto', isMobile())).toBe('wasm');
  });

  test('opens a link with the window rather than the shell', () => {
    asEmulatedPhone();
    const opened: string[] = [];
    // A test run has no window of its own; what the fallback reaches for is the one Obsidian is drawn in.
    vi.stubGlobal('window', { open: (url: string): void => void opened.push(url) });

    openExternal('https://pandoc.org/MANUAL.html');

    expect(opened).toEqual(['https://pandoc.org/MANUAL.html']);
    vi.unstubAllGlobals();
  });

  test('has no file dialog to open, and says so instead of failing', async () => {
    asEmulatedPhone();
    await expect(chooseFile({})).resolves.toBeUndefined();
    await expect(documentsFolder()).resolves.toBeUndefined();
    // The path it was going to write to, which the plugin then asks about in a modal of its own.
    await expect(chooseSavePath({ defaultPath: '/out/Note.pdf' })).resolves.toBe('/out/Note.pdf');
  });

  test('has nothing to show a written file with, and does nothing', async () => {
    asEmulatedPhone();
    await expect(openFile('/out/Note.pdf')).resolves.toBeUndefined();
    await expect(showInFolder('/out/Note.pdf')).resolves.toBeUndefined();
  });
});
describe('a desktop that is not pretending', () => {
  test('still runs the pandoc it has installed', () => {
    asDesktop();
    expect(isMobile()).toBe(false);
    expect(resolveEngine(undefined, isMobile())).toBe('native');
    expect(resolveEngine('wasm', isMobile())).toBe('wasm');
  });
});

/*
 * A folder is remembered per device, and the emulator is a device of its own.
 *
 * A vault synced between a computer and a phone carries both of their answers: `C:/Docs/Exports` under `win32`, a
 * folder of the vault under `ios`. A desktop emulating a phone answers as the phone does — a vault folder, because it
 * can write nowhere else — so it is kept apart from the computer it is really running on.
 */
describe('where an export folder is remembered', () => {
  const asIphone = () => Object.assign(Platform, { isDesktop: false, isMobileApp: true, isIosApp: true, isWin: false });
  const asWindows = () => Object.assign(Platform, { isDesktop: true, isMobileApp: false, isIosApp: false, isWin: true });
  const emulating = (on: boolean) =>
    vi.stubGlobal('document', { body: { hasClass: (cls: string): boolean => on && cls === 'emulate-mobile' } });

  afterEach(() => {
    asWindows();
    vi.unstubAllGlobals();
  });

  test('a computer and a phone keep their own, and neither reads the other', () => {
    asWindows();
    let stored = setPlatformValue<string>({}, 'C:/Docs/Exports');
    asIphone();
    expect(getPlatformValue(stored)).toBeUndefined();

    stored = setPlatformValue(stored, '/var/mobile/Vault/Exports');
    expect(getPlatformValue(stored)).toBe('/var/mobile/Vault/Exports');
    asWindows();
    expect(getPlatformValue(stored)).toBe('C:/Docs/Exports');
    expect(stored).toEqual({ win32: 'C:/Docs/Exports', ios: '/var/mobile/Vault/Exports' });
  });

  test('the emulator writes into a slot of its own, leaving the computer’s folder alone', () => {
    asWindows();
    const stored = setPlatformValue<string>({}, 'C:/Docs/Exports');

    // The same machine, now pretending to be a phone: it picks a folder of the vault, as a phone would.
    emulating(true);
    expect(currentPlatform()).toBe('emulated');
    const after = setPlatformValue(stored, '/vault/Exports');
    expect(getPlatformValue(after)).toBe('/vault/Exports');

    emulating(false);
    expect(getPlatformValue(after)).toBe('C:/Docs/Exports');
    expect(after).toEqual({ win32: 'C:/Docs/Exports', emulated: '/vault/Exports' });
  });

  test('every desktop keeps its own, under the name node gives it', () => {
    const asMac = () => Object.assign(Platform, { isDesktop: true, isMobileApp: false, isIosApp: false, isWin: false, isMacOS: true });
    const asLinux = () => Object.assign(Platform, { isDesktop: true, isMobileApp: false, isIosApp: false, isWin: false, isMacOS: false });

    asWindows();
    let stored = setPlatformValue<string>({}, 'C:/Docs/Exports');
    asMac();
    expect(currentPlatform()).toBe('darwin');
    expect(getPlatformValue(stored)).toBeUndefined();
    stored = setPlatformValue(stored, '/Users/mark/Documents/Exports');
    asLinux();
    expect(currentPlatform()).toBe('linux');
    expect(getPlatformValue(stored)).toBeUndefined();
    stored = setPlatformValue(stored, '/home/mark/exports');

    expect(stored).toEqual({
      win32: 'C:/Docs/Exports',
      darwin: '/Users/mark/Documents/Exports',
      linux: '/home/mark/exports',
    });
    asWindows();
    expect(getPlatformValue(stored)).toBe('C:/Docs/Exports');
    asMac();
    expect(getPlatformValue(stored)).toBe('/Users/mark/Documents/Exports');
  });

  test('a real phone is itself, whatever the emulation class says', () => {
    asIphone();
    emulating(true);
    expect(currentPlatform()).toBe('ios');
  });
});
