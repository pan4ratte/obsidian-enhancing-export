
import  'obsidian';
import type { EventRef } from 'obsidian';
import type { BrowserWindow } from 'electron';


declare global {
  interface Window {
    /** Set by Obsidian on every window it owns, main and popout alike. */
    electronWindow?: BrowserWindow;
  }
}


declare module 'obsidian' {

  export interface DataAdapter {
    getBasePath(): string;
    getFullPath(path: string): string;
    startWatchPath(path: string): void;
    stopWatchPath(path: string): void;
  }

  export interface PluginSettingTab {
    name: string;
  }

  export interface App {
    readonly loadProgress: { show(): void; hide(): void; setMessage(msg: string): void; };
    plugins: {
      enablePlugin(id: string): Promise<void>;
      disablePlugin(id: string): Promise<void>;
    }
  }
  
  export interface Vault {
    config: {
      attachmentFolderPath: string,
      useMarkdownLinks: boolean,
    }
    on(name: 'raw', callback: (file: string) => void, ctx?: unknown): EventRef;
  }
}