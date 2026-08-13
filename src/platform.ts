/* What kind of device this is, and how to reach the parts of it that only a desktop has.
 *
 * On a phone there is no node and no electron: importing either at the top of a file stops the plugin loading at all.
 * So everything that needs one is reached through this file, which loads it when it is asked for and answers for the
 * platform when there is nothing to load.
 */

import { Platform, type DataAdapter } from 'obsidian';
import { normalize } from './paths';
import type { PlatformKey } from './utils';

/** Whether this device is a phone or a tablet — what can be run on it, and nothing about how it is drawn. */
export const isMobile = (): boolean => Platform.isMobileApp;

/**
 * Whether Obsidian is drawing its mobile UI, which a desktop emulating a phone is doing too.
 *
 * What the plugin shows follows this, so that emulation is worth something: a desktop set to emulate a phone gets the
 * settings a phone gets, the installed pandoc and all of its rows left out. What the plugin can actually do follows
 * `isMobile` — under emulation there is still a node to run pandoc with, and exports go on running it.
 */
export const isMobileUi = (): boolean => Platform.isMobile;

/** What separates one path from the next in a list of them, as this platform writes it. */
export const PATH_SEPARATOR = (): string => (Platform.isWin ? ';' : ':');

export const isDesktop = (): boolean => !Platform.isMobileApp;

/**
 * Which platform a per-platform setting belongs to.
 *
 * The desktop keys are node's own spelling, which is what vaults have been storing since before this file — a Mac's
 * pandoc path stays where it was. The two phones are named rather than folded into a desktop key, so a synced vault
 * does not have an iPhone reading the export folder of the Mac it syncs with.
 */
export const currentPlatform = (): PlatformKey => {
  if (Platform.isIosApp) {
    return 'ios';
  }
  if (Platform.isAndroidApp) {
    return 'android';
  }
  return Platform.isWin ? 'win32' : Platform.isMacOS ? 'darwin' : 'linux';
};

/** The vault's own folder on the device. `getBasePath` is the desktop adapter's; the other one answers the same way. */
export const vaultRoot = (adapter: DataAdapter): string => normalize(adapter.getBasePath?.() ?? adapter.getFullPath(''));

/** Electron, likewise — see `typings/electron.d.ts` for the part of it this plugin uses. */
export const electron = async () => await import('electron');

/**
 * The window a file dialog should hang from: the one whose UI asked for it.
 *
 * Obsidian opens a modal in whichever window has focus, so the settings tab and every dialog can be sitting in a
 * popout. `getCurrentWindow` only ever names the main window, and on macOS a sheet parented to that opens on a
 * window the user is not looking at — nothing shows that the button did anything.
 */
const dialogWindow = async () => {
  const ct = await electron();
  return activeWindow?.electronWindow ?? ct.remote.getCurrentWindow();
};

/** A page opened outside Obsidian, however this platform opens one. */
export const openExternal = (url: string): void => {
  if (isMobile()) {
    window.open(url, '_blank');
    return;
  }
  void electron().then(ct => ct.remote.shell.openExternal(url));
};

/** The exported file, opened in whatever the system opens it with. Nothing to do so on a phone. */
export const openFile = async (path: string): Promise<void> => {
  if (isDesktop()) {
    const ct = await electron();
    await ct.remote.shell.openPath(path);
  }
};

/** The exported file, shown where it was written. */
export const showInFolder = async (path: string): Promise<void> => {
  if (isDesktop()) {
    const ct = await electron();
    ct.remote.shell.showItemInFolder(path);
  }
};

export interface FileFilter {
  name: string;
  extensions: string[];
}

/** A file or folder chosen from the system, or nothing where there is no such dialog to open. */
export const chooseFile = async (options: {
  filters?: FileFilter[];
  folder?: boolean;
  defaultPath?: string;
}): Promise<string | undefined> => {
  if (isMobile()) {
    return undefined;
  }
  const ct = await electron();
  const chosen = await ct.remote.dialog.showOpenDialog(await dialogWindow(), {
    defaultPath: options.defaultPath,
    filters: options.folder ? undefined : options.filters,
    properties: options.folder ? ['createDirectory', 'openDirectory'] : ['openFile'],
  });
  return chosen.canceled ? undefined : chosen.filePaths[0];
};

/** Where to save a file, asked of the system with the overwrite warning it puts up itself. */
export const chooseSavePath = async (options: { title?: string; defaultPath?: string }): Promise<string | undefined> => {
  if (isMobile()) {
    return options.defaultPath;
  }
  const ct = await electron();
  const chosen = await ct.remote.dialog.showSaveDialog(await dialogWindow(), {
    title: options.title,
    defaultPath: options.defaultPath,
    properties: ['showOverwriteConfirmation', 'createDirectory'],
  });
  return chosen.canceled ? undefined : chosen.filePath;
};

/** The folder a file dialog starts in when nothing better is known. */
export const documentsFolder = async (): Promise<string | undefined> => {
  if (isMobile()) {
    return undefined;
  }
  const ct = await electron();
  return ct.remote.app.getPath('documents');
};
