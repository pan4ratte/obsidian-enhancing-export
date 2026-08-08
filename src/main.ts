import { App, Menu, Plugin, PluginManifest, TFile, Notice, debounce } from 'obsidian';
import { PandocGuiSettings, ExportSetting, DEFAULT_SETTINGS, DEFAULT_ENV } from './settings';
import { ExportSettingTab, ExportDialog } from './ui';
import { exportNote } from './export';
import { getPlatformValue, PlatformKey } from './utils';
import { t } from './lang/helpers';
import path from 'path';
import resources, { BUNDLED_LUA_FILES } from './resources';
// `styles.css` is not imported: Obsidian loads the plugin folder's stylesheet itself.

export default class PandocGuiPlugin extends Plugin {
  settings: PandocGuiSettings;

  constructor(app: App, manifest: PluginManifest) {
    super(app, manifest);
    this.saveSettings = debounce(this.saveSettings.bind(this), 1000, true) as unknown as typeof this.saveSettings;
  }

  async onload() {
    await this.releaseResources();
    await this.loadSettings();

    this.addSettingTab(new ExportSettingTab(this));

    this.addCommand({
      // Obsidian prefixes command ids with the plugin's own.
      id: 'export',
      name: t.CMD_EXPORT,
      icon: 'document',
      callback: () => {
        const file = this.app.workspace.getActiveFile();
        if (file) {
          ExportDialog.show(this, file);
        } else {
          new Notice(t.NOTICE_NO_FILE, 2000);
        }
      },
    });
    this.addCommand({
      id: 'export-with-previous',
      name: t.CMD_EXPORT_WITH_PREVIOUS,
      icon: 'document',
      callback: async () => {
        const file = this.app.workspace.getActiveFile();
        if (file) {
          if (this.settings.lastExportType && this.settings.lastExportDirectory) {
            const setting = this.settings.items.find(s => s.name === this.settings.lastExportType);
            if (setting) {
              await exportNote(this, file, getPlatformValue(this.settings.lastExportDirectory), undefined, setting);
              return;
            }
          }
          ExportDialog.show(this, file);
        } else {
          new Notice(t.NOTICE_NO_FILE, 2000);
        }
      },
    });

    this.registerEvent(
      this.app.workspace.on('file-menu', (menu: Menu, file) => {
        if (file instanceof TFile) {
          menu
            .addItem(item => {
              item
                .setTitle(t.CMD_EXPORT)
                .setIcon('document')
                .onClick((): void => {
                  ExportDialog.show(this, file);
                });
            })
            .addSeparator();
        }
      })
    );
    if (import.meta.env.DEV) {
      window.hmr?.(this);
    }
  }

  public async resetSettings(): Promise<void> {
    this.settings = {
      ...JSON.parse(JSON.stringify(DEFAULT_SETTINGS)),
      lastExportDirectory: this.settings.lastExportDirectory,
    };
    await this.saveSettings();
  }

  public async loadSettings(): Promise<void> {
    const settings: PandocGuiSettings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
    settings.items.forEach(v => {
      Object.assign(v, Object.assign({}, DEFAULT_SETTINGS.items.find(o => o.name === v.name) ?? {}, v));
    });
    // A bundled template is stored as only its diff from the default, so one no longer
    // seeded leaves a husk with nothing to run. User-made templates carry their own fields.
    settings.items = settings.items.filter(v => v.type);
    // A filter that used to come from the store and now ships with the plugin: drop the
    // claim that the user installed it, which would list it as theirs to uninstall.
    if (settings.installedLuaFilters?.some(f => BUNDLED_LUA_FILES.includes(f.fileName))) {
      settings.installedLuaFilters = settings.installedLuaFilters.filter(f => !BUNDLED_LUA_FILES.includes(f.fileName));
    }
    for (const item of DEFAULT_SETTINGS.items) {
      if (settings.items.every(o => o.name !== item.name)) {
        settings.items.push(item);
      }
    }
    // The last-exported template is remembered by name; drop a name nothing answers to.
    if (settings.lastExportType && settings.items.every(o => o.name !== settings.lastExportType)) {
      delete settings.lastExportType;
    }
    this.settings = settings;
  }

  public async saveSettings(): Promise<void> {
    const settings: PandocGuiSettings = JSON.parse(JSON.stringify(this.settings)) as PandocGuiSettings;
    settings.items.forEach(v => {
      const def = DEFAULT_SETTINGS.items.find(o => o.name === v.name);
      if (def) {
        Object.keys(v).forEach((k: keyof ExportSetting) => {
          if (k !== 'name' && JSON.stringify(v[k]) === JSON.stringify(def[k])) {
            delete v[k];
          }
        });
      }
    });
    if (settings.env) {
      for (const platform of Object.keys(settings.env) as PlatformKey[]) {
        const env = settings.env[platform];
        if (JSON.stringify(env) === JSON.stringify(DEFAULT_ENV[platform])) {
          delete settings.env[platform];
          continue;
        }
        const refEnv = getPlatformValue(DEFAULT_ENV, platform);
        for (const [name, value] of Object.entries(env)) {
          if (value === refEnv[name]) {
            delete env[name];
          }
        }
        if (Object.keys(env).length === 0) {
          delete settings.env[platform];
        }
      }
    }
    await this.saveData(settings);
  }

  async releaseResources(): Promise<void> {
    const { adapter } = this.app.vault;
    for (const [dir, res] of resources) {
      const resDir = path.join(this.manifest.dir, dir);
      await adapter.mkdir(resDir);
      for (const [fileName, bytes] of res) {
        const filePath = path.join(resDir, fileName);
        await adapter.writeBinary(filePath, bytes.buffer);
      }
    }
    resources.length = 0;
  }
}
