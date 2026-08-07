
import  'obsidian';
import type { App, EventRef } from 'obsidian';

declare global {
  /**
   * Obsidian puts the app on `window` but does not declare it — the documented
   * way in is `plugin.app`. Declared here for the few places that have no
   * plugin to hand: a modal built from a component, a memo about the vault's
   * link style.
   */
  const app: App;
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
    on(name: 'raw', callback: (file: string) => void, ctx?: any): EventRef;
  }
}