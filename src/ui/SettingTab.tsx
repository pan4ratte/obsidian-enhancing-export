import * as ct from 'electron';
import process from 'process';
import { PluginSettingTab } from 'obsidian';
import type { SettingDefinitionItem } from 'obsidian';
import type { SemVer } from 'semver'
import type UniversalExportPlugin from '../main';
import {
  CustomExportSetting,
  ExportSetting,
  PandocExportSetting,
  createEnv,
  DEFAULT_ENV
} from '../settings';
import { setPlatformValue, getPlatformValue } from '../utils';

import { createSignal, createRoot, onCleanup, createMemo, createEffect, Show, batch, Match, Switch, JSX } from 'solid-js';
import { createStore, produce } from 'solid-js/store';
import { insert, Dynamic } from 'solid-js/web';
import type { Lang } from '../lang';

import pandoc from '../pandoc';
import PandocDashboard from './PandocDashboard';
import TemplateTable from './TemplateTable';
import { MessageBox } from './message_box';
import Modal from './components/Modal';
import Button from './components/Button';
import Collapsible from './components/Collapsible';
import Setting, { Text, Toggle, ExtraButton, DropDown, TextArea } from './components/Setting';
import export_templates from '../export_templates';


const SettingTab = (props: { lang: Lang, plugin: UniversalExportPlugin }) => {
  const { plugin, lang } = props;
  const [settings, setSettings0] = createStore(plugin.settings);
  const [pandocVersion, setPandocVersion] = createSignal<SemVer>();
  const envVars = createMemo(() => Object.entries(Object.assign({}, getPlatformValue(DEFAULT_ENV), getPlatformValue(settings.env) ?? {})).map(([n, v]) => `${n}="${v}"`).join('\n'));
  const setSettings: typeof setSettings0 = (...args: unknown[]) => {
    (setSettings0 as ((...args: unknown[]) => void))(...args);
    plugin.saveSettings();
  };
  const setEnvVars = (envItems: string) => {
    try {
      const env: Record<string, string> = {};
      for (let line of envItems.split('\n')) {
        line = line.trim();
        const sepIdx = line.indexOf('=');
        if (sepIdx > 0) {
          const name = line.substring(0, sepIdx);
          let value = line.substring(sepIdx + 1).trim();
          if (value.startsWith('"') && value.endsWith('"')) {
            value = value.substring(1, value.length - 1);
          }
          env[name] = value;
        }
      }
      setSettings('env', setPlatformValue(settings.env ?? {}, env));
    } catch (e) {
      alert(e);
    }
  };

  const currentCommandTemplate = createMemo(() => settings.items.find(v => v.name === settings.lastEditName) ?? settings.items.first());
  const currentEditCommandTemplate = <T extends 'custom' | 'pandoc'>(type?: T) => {
    const template = currentCommandTemplate();
    return (type === undefined || type === template?.type ? template : undefined) as T extends 'custom' ? CustomExportSetting : T extends 'pandoc' ? PandocExportSetting : ExportSetting;
  };
  const customDefaultExportDirectory = createMemo(() => getPlatformValue(settings.customDefaultExportDirectory));

  // `Auto` is gone from the dropdown, so a vault still carrying it would show a
  // selection its setting does not hold. Same folder is what it now means.
  if (settings.defaultExportDirectoryMode === 'Auto') {
    setSettings('defaultExportDirectoryMode', 'Same');
  }

  const updateCurrentEditCommandTemplate = (update: (prev: Partial<ExportSetting>) => void) => {
    const idx = settings.items.findIndex(v => v.name === settings.lastEditName);
    setSettings('items', idx === -1 ? 0 : idx, produce(item => {
      update(item);
      return item;
    }));
  };

  /** `name`, or the first `name 2`, `name 3`… no other template answers to. */
  const uniqueTemplateName = (name: string, except?: string) => {
    const taken = new Set(settings.items.filter(v => v.name !== except).map(v => v.name));
    if (!taken.has(name)) {
      return name;
    }
    let n = 2;
    while (taken.has(`${name} ${n}`)) {
      n++;
    }
    return `${name} ${n}`;
  };

  const [modal, setModal] = createSignal<() => JSX.Element>();

  const AddCommandTemplateModal = () => {
    type TemplateKey = keyof typeof export_templates;
    const [templateName, setTemplateName] = createSignal(Object.keys(export_templates)[0] as TemplateKey);
    const [name, setName] = createSignal<string>();
    const doAdd = () => {
      const template = JSON.parse(JSON.stringify(export_templates[templateName()]));
      // A row of the table needs a name to be found by, so an empty field takes
      // the one the preset came with.
      template.name = uniqueTemplateName(name()?.trim() || template.name);
      batch(() => {
        setSettings('items', items => [...items, template]);
        setSettings('lastEditName', template.name);
      });
      const added: string = template.name;
      setModal(undefined);
      // Straight on to the arguments — naming a template is not the point of
      // adding one. Only once this modal is gone, though: it clears the signal
      // on its way out, and would take the next one with it.
      queueMicrotask(() => editCommandTemplate(added));
    };
    return <>
      <Modal app={app} title={lang.settingTab.newTemplate} onClose={() => setModal(undefined)}>
        <Setting name={lang.settingTab.template}>
          <DropDown
            options={Object.entries(export_templates).map(([k, v]) => ({ name: v.name, value: k })).sort((a, b) => a.name.localeCompare(b.name))}
            selected={templateName()}
            onChange={(v: TemplateKey) => setTemplateName(v)}
          />
        </Setting>
        <Setting name={lang.settingTab.name}>
          <Text value={name() ?? ''} placeholder={export_templates[templateName()].name} onChange={(value) => setName(value)} />
        </Setting>
        <div class="modal-button-container">
          <Button cta={true} onClick={doAdd}>{lang.settingTab.add}</Button>
        </div>
      </Modal>
    </>;
  };

  const renameCurrentCommandTemplate = (value: string) => {
    const name = uniqueTemplateName(value.trim() || currentEditCommandTemplate().name, currentEditCommandTemplate().name);
    if (name === currentEditCommandTemplate().name) {
      return;
    }
    // Both at once: the item is found again by the name the settings remember.
    batch(() => {
      updateCurrentEditCommandTemplate((v) => v.name = name);
      setSettings('lastEditName', name);
    });
  };

  /** The whole of one template. Every field writes straight through, so there is nothing to save. */
  const EditCommandTemplateModal = () => <>
    <Modal app={app} title={lang.settingTab.editCommandTemplate} onClose={() => setModal(undefined)}>
      <Setting name={lang.settingTab.name}>
        <Text value={currentEditCommandTemplate()?.name ?? ''} onChange={renameCurrentCommandTemplate} />
      </Setting>

      <Switch>
        <Match when={currentEditCommandTemplate('pandoc')}>
          <PandocCommandTempateEditBlock />
        </Match>
        <Match when={currentEditCommandTemplate('custom')}>
          <CustomCommandTempateEditBlock />
        </Match>
      </Switch>

      <div class="modal-button-container">
        <Button cta={true} onClick={() => setModal(undefined)}>{lang.settingTab.done}</Button>
      </div>
    </Modal>
  </>;

  const editCommandTemplate = (name: string) => {
    setSettings('lastEditName', name);
    setModal(() => EditCommandTemplateModal);
  };

  const removeCommandTemplate = (name: string) => {
    new MessageBox(app, {
      title: lang.settingTab.remove,
      message: lang.settingTab.removeTemplateConfirmation(name),
      buttons: 'YesNo',
      callback: {
        yes: () => batch(() => {
          setSettings('items', (items) => items.filter(v => v.name !== name));
          if (settings.lastEditName === name) {
            setSettings('lastEditName', settings.items.first()?.name);
          }
        }),
      },
    }).open();
  };

  const PandocCommandTempateEditBlock = () => {
    const template = () => currentEditCommandTemplate('pandoc');
    const updateTemplate = (update: (prev: Partial<PandocExportSetting>) => void) => {
      updateCurrentEditCommandTemplate(prev => prev.type === 'pandoc' ? update(prev) : undefined);
    };
    return <>
      <Setting name={lang.settingTab.arguments}>
        <Text style="width: 100%" value={template().arguments ?? ''} onChange={(value) => updateTemplate(v => v.arguments = value)} />
      </Setting>
      <Setting name={lang.settingTab.extraArguments}>
        <Text style="width: 100%" value={template().customArguments ?? ''} title={template().customArguments} onChange={(value) => updateTemplate(v => v.customArguments = value)} />
      </Setting>

      <Setting name={lang.settingTab.afterExport} heading={true} />
      <Setting name={lang.settingTab.openExportedFileLocation}>
        <Toggle checked={template().openExportedFileLocation ?? false} onChange={(checked) => updateTemplate(v => v.openExportedFileLocation = checked)} />
      </Setting>
      <Setting name={lang.settingTab.openExportedFile}>
        <Toggle checked={template().openExportedFile ?? false} onChange={(checked) => updateTemplate(v => v.openExportedFile = checked)} />
      </Setting>
      <Setting name={lang.settingTab.runCommand}>
        <Toggle checked={template().runCommand} onChange={(checked) => updateTemplate(v => v.runCommand = checked)} />
      </Setting>
      <Show when={template().runCommand}>
        <Setting>
          <Text style="width: 100%" value={template().command ?? ''} onChange={(value) => updateTemplate(v => v.command = value)} />
        </Setting>
      </Show>
    </>;
  };

  const CustomCommandTempateEditBlock = () => {
    const template = () => currentEditCommandTemplate('custom');
    const updateTemplate = (update: (prev: Partial<CustomExportSetting>) => void) => {
      updateCurrentEditCommandTemplate(prev => prev.type === 'custom' ? update(prev) : undefined);
    };
    return <>
      <Setting name={lang.settingTab.command}>
        <Text style="width: 100%" value={template().command} onChange={(value) => updateTemplate(v => v.command = value)} />
      </Setting>
      <Setting name={lang.settingTab.targetFileExtensions}>
        <Text value={template().targetFileExtensions ?? ''} onChange={(value) => updateTemplate(v => v.targetFileExtensions = value)} />
      </Setting>

      <Setting name={lang.settingTab.afterExport} heading={true} />
      <Setting name={lang.settingTab.showCommandOutput} >
        <Toggle checked={template().showCommandOutput ?? false} onChange={(checked) => updateTemplate(v => v.showCommandOutput = checked)} />
      </Setting>
      <Setting name={lang.settingTab.openExportedFileLocation}>
        <Toggle checked={template().openExportedFileLocation ?? false} onChange={(checked) => updateTemplate(v => v.openExportedFileLocation = checked)} />
      </Setting>
      <Setting name={lang.settingTab.openExportedFile}>
        <Toggle checked={template().openExportedFile ?? false} onChange={(checked) => updateTemplate(v => v.openExportedFile = checked)} />
      </Setting>
    </>;
  };

  const chooseCustomDefaultExportDirectory = async () => {
    const retval = await ct.remote.dialog.showOpenDialog({
      defaultPath: customDefaultExportDirectory() ?? ct.remote.app.getPath('documents'),
      properties: ['createDirectory', 'openDirectory'],
    });

    if (!retval.canceled && retval.filePaths.length > 0) {
      setSettings('customDefaultExportDirectory', v => setPlatformValue(v, retval.filePaths[0]));
    }
  };

  const choosePandocPath = async () => {
    const retval = await ct.remote.dialog.showOpenDialog({
      filters: process.platform == 'win32' ? [{ extensions: ['exe'], name: 'pandoc' }]: undefined,
      properties: ['openFile'],
    });

    if (!retval.canceled && retval.filePaths.length > 0) {
      setSettings('pandocPath', (v) => setPlatformValue(v, retval.filePaths[0]));
    }
  };

  createEffect(async () => {
    try {
      const env = createEnv(getPlatformValue(settings.env) ?? {});
      setPandocVersion(await pandoc.getVersion(getPlatformValue(settings.pandocPath), env));
    } catch {
      setPandocVersion(undefined);
    }
  });

  return <>
    <PandocDashboard
      lang={lang}
      version={pandocVersion()}
      path={getPlatformValue(settings.pandocPath) ?? ''}
      onPathChange={(value) => setSettings('pandocPath', (v) => setPlatformValue(v, value))}
      onChoosePath={choosePandocPath}
    />

    <Setting name={lang.settingTab.defaults} heading={true} />

    <Setting name={lang.settingTab.defaultFolderForExportedFile}>
      <DropDown options={[
        { name: lang.settingTab.sameFolderWithCurrentFile, value: 'Same' },
        { name: lang.settingTab.customLocation, value: 'Custom' }
      ]} selected={settings.defaultExportDirectoryMode} onChange={(v: 'Same' | 'Custom') => setSettings('defaultExportDirectoryMode', v)} />

    </Setting>

    <Collapsible when={settings.defaultExportDirectoryMode === 'Custom'}>
      <Setting class="ex-export-destination-path">
        <Text style="width: 100%" value={customDefaultExportDirectory() ?? ''} title={customDefaultExportDirectory()} />
        <ExtraButton icon="folder" onClick={chooseCustomDefaultExportDirectory} />
      </Setting>
    </Collapsible>

    <Setting name={lang.settingTab.openExportedFileLocation}>
      <Toggle
        checked={settings.openExportedFileLocation}
        onChange={(v) => setSettings('openExportedFileLocation', v)}
      />
    </Setting>

    <Setting name={lang.settingTab.openExportedFile} >
      <Toggle
        checked={settings.openExportedFile}
        onChange={(v) => setSettings('openExportedFile', v)} />
    </Setting>

    
    <Setting name={lang.settingTab.ShowExportProgressBar}>
      <Toggle
        checked={settings.showExportProgressBar}
        onChange={(v) => setSettings('showExportProgressBar', v)}
      />
    </Setting>

    <Setting name={lang.settingTab.exportTemplates} heading={true} />

    <TemplateTable
      lang={lang}
      templates={settings.items}
      onAdd={() => setModal(() => AddCommandTemplateModal)}
      onEdit={editCommandTemplate}
      onRemove={removeCommandTemplate}
    />

    <Setting name={lang.settingTab.advanced} heading={true} />

    {/* TODO:// optimize UI as https://www.jetbrains.com/help/idea/absolute-path-variables.html */}
    <Setting name={lang.settingTab.environmentVariables} description={lang.settingTab.environmentVariablesDesc}>
      <TextArea
        style='width: 100%;height: 5em'
        value={envVars()}
        onChange={setEnvVars}
      />
    </Setting>

    <Show when={modal()}>
      <Dynamic component={modal()} ref={(el: Node) => document.body.appendChild(el)} />
    </Show>
  </>;
};


/** Group element hosting the single row the whole tab is rendered into. */
const GROUP_CLASS = 'ex-settings-group';
/** The row itself — stripped of its stock chrome, see styles.css. */
const ANCHOR_CLASS = 'ex-settings-anchor';
/** Container the solid-js tree is mounted into. */
const ROOT_CLASS = 'ex-settings-root';

export default class extends PluginSettingTab {
  plugin: UniversalExportPlugin;
  #dispose?: () => void;
  #root?: HTMLElement;

  public get lang() {
    return this.plugin.lang;
  }

  constructor(plugin: UniversalExportPlugin) {
    super(plugin.app, plugin);
    this.plugin = plugin;
    this.name = this.plugin.lang.settingTab.title;
  }

  getSettingDefinitions(): SettingDefinitionItem[] {
    const { settingTab } = this.lang;
    return [
      {
        type: 'group',
        cls: GROUP_CLASS,
        items: [
          {
            // The whole tab is one custom-rendered row: the name, description and
            // aliases exist so the settings search can find and scroll to it, the
            // visible labels are drawn by the solid-js tree below.
            name: settingTab.title,
            desc: this.plugin.manifest.description,
            aliases: [
              settingTab.pandocDashboard,
              settingTab.pandocPath,
              settingTab.defaults,
              settingTab.defaultFolderForExportedFile,
              settingTab.openExportedFileLocation,
              settingTab.openExportedFile,
              settingTab.ShowExportProgressBar,
              settingTab.exportTemplates,
              settingTab.newTemplate,
              settingTab.editCommandTemplate,
              settingTab.command,
              settingTab.arguments,
              settingTab.extraArguments,
              settingTab.targetFileExtensions,
              settingTab.showCommandOutput,
              settingTab.runCommand,
              settingTab.afterExport,
              settingTab.advanced,
              settingTab.environmentVariables,
              'pandoc',
            ],
            render: setting => {
              setting.settingEl.addClass(ANCHOR_CLASS);
              // Must be built into settingEl: anything appended to the group's listEl
              // is pruned by the reconciler at the end of the render pass. Reuse the
              // existing root so a re-render cannot append a second copy of the UI.
              const root =
                setting.settingEl.querySelector<HTMLElement>(`:scope > .${ROOT_CLASS}`) ?? setting.settingEl.createDiv(ROOT_CLASS);
              this.#mount(root);
              return () => this.#unmount();
            },
          },
        ],
      },
    ];
  }

  hide() {
    this.#unmount();
  }

  #mount(root: HTMLElement) {
    if (this.#dispose && this.#root === root && root.isConnected) {
      return;
    }
    this.#unmount();
    this.#root = root;
    this.#dispose = createRoot(dispose => {
      insert(root, <SettingTab plugin={this.plugin} lang={this.lang} />);
      onCleanup(() => {
        root.empty();
      });
      return dispose;
    });
  }

  #unmount() {
    const dispose = this.#dispose;
    this.#dispose = undefined;
    this.#root = undefined;
    dispose?.();
  }
}