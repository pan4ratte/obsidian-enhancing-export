// Electron is external — Obsidian supplies it at runtime and vite.config.ts
// leaves the import alone. Only the `remote` surface the plugin actually calls
// is declared here; the upstream definitions are 16k lines describing an API
// this plugin never touches.

declare module 'electron' {
  export interface FileFilter {
    name: string;
    extensions: string[];
  }

  export interface OpenDialogOptions {
    title?: string;
    defaultPath?: string;
    filters?: FileFilter[];
    properties?: Array<'openFile' | 'openDirectory' | 'multiSelections' | 'showHiddenFiles' | 'createDirectory'>;
  }

  export interface OpenDialogReturnValue {
    canceled: boolean;
    filePaths: string[];
  }

  export interface SaveDialogOptions {
    title?: string;
    defaultPath?: string;
    filters?: FileFilter[];
    properties?: Array<'showOverwriteConfirmation' | 'createDirectory' | 'showHiddenFiles'>;
  }

  export interface SaveDialogReturnValue {
    canceled: boolean;
    filePath: string;
  }

  export const remote: {
    app: {
      getPath(
        name: 'home' | 'appData' | 'userData' | 'temp' | 'desktop' | 'documents' | 'downloads'
      ): string;
    };
    dialog: {
      showOpenDialog(options: OpenDialogOptions): Promise<OpenDialogReturnValue>;
      showSaveDialog(options: SaveDialogOptions): Promise<SaveDialogReturnValue>;
    };
    shell: {
      openExternal(url: string): Promise<void>;
      // Resolves to '' on success, or to the error message when the open failed.
      openPath(path: string): Promise<string>;
      showItemInFolder(fullPath: string): void;
    };
  };
}
