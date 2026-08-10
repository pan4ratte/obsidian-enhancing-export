import * as ct from 'electron';

/**
 * The window a file dialog should hang from: the one whose UI asked for it.
 *
 * Obsidian opens a modal in whichever window has focus, so the settings tab and every dialog can be sitting in a
 * popout. `getCurrentWindow` only ever names the main window, and on macOS a sheet parented to that opens on a
 * window the user is not looking at — nothing shows that the button did anything.
 */
export const dialogWindow = (): ct.BrowserWindow => activeWindow?.electronWindow ?? ct.remote.getCurrentWindow();
