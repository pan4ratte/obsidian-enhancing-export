import { App, Menu, Plugin, PluginManifest, TFile, Notice, debounce } from 'obsidian';
import { UniversalExportPluginSettings, ExportSetting, DEFAULT_SETTINGS, DEFAULT_ENV } from './settings';
import { ExportSettingTab, ExportDialog } from './ui';
import { exportToOo } from './exporto0o';
import { getPlatformValue, PlatformKey } from './utils';
import lang, { Lang } from './lang';
import path from 'path';
import resources from './resources';
// `styles.css` is not imported: Obsidian loads the plugin folder's stylesheet
// itself, and keeping it out of the bundle means it can be edited live.

export default class UniversalExportPlugin extends Plugin {
  settings: UniversalExportPluginSettings;
  lang: Lang;

  constructor(app: App, manifest: PluginManifest) {
    super(app, manifest);
    this.lang = lang.current;
    this.saveSettings = debounce(this.saveSettings.bind(this), 1000, true) as unknown as typeof this.saveSettings;
  }

  async onload() {
    await this.releaseResources();

    await this.loadSettings();
    const { lang } = this;

    this.addSettingTab(new ExportSettingTab(this));

    this.addCommand({
      // Obsidian prefixes command ids with the plugin's own, so naming it here
      // too produced `obsidian-enhancing-export:obsidian-enhancing-export:export`.
      id: 'export',
      name: lang.exportToOo,
      icon: 'document',
      callback: () => {
        const file = this.app.workspace.getActiveFile();
        if (file) {
          ExportDialog.show(this, file);
        } else {
          new Notice(lang.pleaseOpenFile, 2000);
        }
      },
    });
    this.addCommand({
      id: 'export-with-previous',
      name: lang.exportWithPrevious,
      icon: 'document',
      callback: async () => {
        const file = this.app.workspace.getActiveFile();
        if (file) {
          if (this.settings.lastExportType && this.settings.lastExportDirectory) {
            const setting = this.settings.items.find(s => s.name === this.settings.lastExportType);
            if (setting) {
              await exportToOo(this, file, getPlatformValue(this.settings.lastExportDirectory), undefined, setting);
              return;
            }
          }
          ExportDialog.show(this, file);
        } else {
          new Notice(lang.pleaseOpenFile, 2000);
        }
      },
    });

    this.registerEvent(
      this.app.workspace.on('file-menu', (menu: Menu, file) => {
        if (file instanceof TFile) {
          menu
            .addItem(item => {
              item
                .setTitle(lang.exportToOo)
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
    const settings: UniversalExportPluginSettings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
    settings.items.forEach(v => {
      Object.assign(v, Object.assign({}, DEFAULT_SETTINGS.items.find(o => o.name === v.name) ?? {}, v));
    });
    // A template that came with the plugin is written to `data.json` as no more
    // than what it does not share with its default — often nothing but a name.
    // A default no longer seeded therefore leaves a husk: a name with nothing to
    // run, which the merge above could not fill in. Those go, rather than stand
    // in the export dropdown as templates that cannot export. Anything the user
    // made carries its own fields and stays.
    settings.items = settings.items.filter(v => v.type);
    for (const item of DEFAULT_SETTINGS.items) {
      if (settings.items.every(o => o.name !== item.name)) {
        settings.items.push(item);
      }
    }
    // The template last exported with is remembered by name, and a version
    // before this one could leave that name behind when the template it named
    // was deleted. The export dialog opens on it, so a name nothing answers to
    // is let go of here rather than carried into the UI.
    if (settings.lastExportType && settings.items.every(o => o.name !== settings.lastExportType)) {
      delete settings.lastExportType;
    }
    this.settings = settings;
  }

  public async saveSettings(): Promise<void> {
    const settings: UniversalExportPluginSettings = JSON.parse(JSON.stringify(this.settings)) as UniversalExportPluginSettings;
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
