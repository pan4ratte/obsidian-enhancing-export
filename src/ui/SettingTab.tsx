import * as ct from 'electron';
import process from 'process';
import { Notice, PluginSettingTab } from 'obsidian';
import type { SettingDefinitionItem } from 'obsidian';
import type { SemVer } from 'semver';
import type UniversalExportPlugin from '../main';
import { CustomExportSetting, ExportSetting, PandocExportSetting, createEnv, DEFAULT_ENV } from '../settings';
import { setPlatformValue, getPlatformValue } from '../utils';

import { createSignal, createRoot, onCleanup, createMemo, createEffect, Show, batch, Match, Switch, JSX } from 'solid-js';
import { createStore, produce } from 'solid-js/store';
import { insert, Dynamic } from 'solid-js/web';
import type { Lang } from '../lang';

import pandoc from '../pandoc';
import PandocDashboard from './PandocDashboard';
import TemplateActions from './TemplateActions';
import TemplateTable from './TemplateTable';
import LuaFilterStore from './LuaFilterStore';
import { LuaFilterManager, addLuaFilterArg, hasLuaFilterArg, removeLuaFilterArg, type InstalledLuaFilter } from '../lua_filters';
import TemplateLuaFilters from './TemplateLuaFilters';
import CheckGrid from './components/CheckGrid';
import { TOC_MAX_DEPTH, setTocDepth, tocDepth } from '../toc_args';
import { PANDOC_EXTENSIONS, enabledExtensions, setExtensions } from '../pandoc_extensions';
import {
  HIGHLIGHT_NONE,
  HIGHLIGHT_STYLES,
  MATH_METHODS,
  PDF_ENGINES,
  TOP_LEVEL_DIVISIONS,
  highlightStyle,
  listOfFigures,
  listOfTables,
  mathMethod,
  numberOffset,
  numberSections,
  pdfEngine,
  setHighlightStyle,
  setListOfFigures,
  setListOfTables,
  setMathMethod,
  setNumberOffset,
  setNumberSections,
  setPdfEngine,
  setTopLevelDivision,
  topLevelDivision,
} from '../writer_args';
import {
  isPdfOutput,
  outputFormat,
  supportsHighlighting,
  supportsMathMethod,
  supportsNumberOffset,
  supportsNumberSections,
  supportsSectionLists,
  supportsToc,
  supportsTopLevelDivision,
} from '../pandoc_format';
import { MessageBox } from './message_box';
import Modal from './components/Modal';
import Button from './components/Button';
import Collapsible from './components/Collapsible';
import Section from './components/Section';
import Setting, { Text, Toggle, ExtraButton, DropDown, TextArea } from './components/Setting';
import export_templates from '../export_templates';
import { BUNDLED_LUA_FILES } from '../resources';

/**
 * Whether the template editor's advanced section stands open.
 *
 * Module scope, and so remembered for as long as the plugin is loaded: the
 * modal is built afresh on every open, and opening the same panel back up each
 * time would be a chore of its own. It is deliberately not written to
 * `data.json` — where someone is looking is not a setting.
 */
const [advancedOpen, setAdvancedOpen] = createSignal(false);

const SettingTab = (props: { lang: Lang; plugin: UniversalExportPlugin }) => {
  const { plugin, lang } = props;
  // Obsidian puts an app on `window`, but a plugin is meant to use the one it
  // was handed — see the plugin guidelines. This is that one.
  const { app } = plugin;
  const [settings, setSettings0] = createStore(plugin.settings);
  const [pandocVersion, setPandocVersion] = createSignal<SemVer>();
  // The variables are read far more often than they are written, so the field
  // stays out of the way until it is asked for.
  const [editingEnvVars, setEditingEnvVars] = createSignal(false);
  const envVars = createMemo(() =>
    Object.entries(Object.assign({}, getPlatformValue(DEFAULT_ENV), getPlatformValue(settings.env) ?? {}))
      .map(([n, v]) => `${n}="${v}"`)
      .join('\n')
  );
  const setSettings: typeof setSettings0 = (...args: unknown[]) => {
    (setSettings0 as (...args: unknown[]) => void)(...args);
    void plugin.saveSettings();
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
      new Notice(String(e));
    }
  };

  const currentCommandTemplate = createMemo(() => settings.items.find(v => v.name === settings.lastEditName) ?? settings.items.first());
  const currentEditCommandTemplate = <T extends 'custom' | 'pandoc'>(type?: T) => {
    const template = currentCommandTemplate();
    return (type === undefined || type === template?.type ? template : undefined) as T extends 'custom'
      ? CustomExportSetting
      : T extends 'pandoc'
        ? PandocExportSetting
        : ExportSetting;
  };
  const customDefaultExportDirectory = createMemo(() => getPlatformValue(settings.customDefaultExportDirectory));

  const updateCurrentEditCommandTemplate = (update: (prev: Partial<ExportSetting>) => void) => {
    const idx = settings.items.findIndex(v => v.name === settings.lastEditName);
    setSettings(
      'items',
      idx === -1 ? 0 : idx,
      produce(item => {
        update(item);
        return item;
      })
    );
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

  /** Whether the plugin gave the template this name, rather than the user typing it. */
  const isGeneratedName = (name: string, preset: string) =>
    name === preset || (name.startsWith(`${preset} `) && /^\d+$/.test(name.substring(preset.length + 1)));

  const outputOptions = Object.keys(export_templates)
    .map(k => ({ name: k, value: k }))
    .sort((a, b) => a.name.localeCompare(b.name));

  const [modal, setModal] = createSignal<() => JSX.Element>();

  /** Which preset the template being edited writes with. */
  const currentOutput = createMemo(() => currentEditCommandTemplate()?.preset);

  const setCurrentOutput = (key: string) => {
    const preset = export_templates[key];
    const template = currentEditCommandTemplate();
    if (!preset || !template || currentOutput() === key) {
      return;
    }
    // What the format decides comes from the preset; what the user decided
    // about this template — its name, what happens once the file is written —
    // is carried across. Extra arguments belong to the format that took them.
    const previous = currentOutput();
    const name = previous && isGeneratedName(template.name, previous) ? uniqueTemplateName(preset.name, template.name) : template.name;
    const carried =
      template.type === 'pandoc' && preset.type === 'pandoc' ? { runCommand: template.runCommand, command: template.command } : {};
    const idx = settings.items.findIndex(v => v.name === template.name);
    batch(() => {
      setSettings('items', idx === -1 ? 0 : idx, {
        ...JSON.parse(JSON.stringify(preset)),
        ...carried,
        openExportedFile: template.openExportedFile,
        openExportedFileLocation: template.openExportedFileLocation,
        preset: key,
        name,
      });
      setSettings('lastEditName', name);
    });
  };

  const addCommandTemplate = () => {
    const key = Object.keys(export_templates)[0];
    const template = JSON.parse(JSON.stringify(export_templates[key]));
    template.preset = key;
    template.name = uniqueTemplateName(template.name);
    batch(() => {
      setSettings('items', items => [...items, template]);
      setSettings('lastEditName', template.name);
    });
    setModal(() => EditCommandTemplateModal);
  };

  const renameCurrentCommandTemplate = (value: string) => {
    const name = uniqueTemplateName(value.trim() || currentEditCommandTemplate().name, currentEditCommandTemplate().name);
    if (name === currentEditCommandTemplate().name) {
      return;
    }
    // Both at once: the item is found again by the name the settings remember.
    batch(() => {
      updateCurrentEditCommandTemplate(v => (v.name = name));
      setSettings('lastEditName', name);
    });
  };

  /** The whole of one template. Every field writes straight through, so there is nothing to save. */
  const EditCommandTemplateModal = () => (
    <>
      <Modal
        app={app}
        title={lang.settingTab.editCommandTemplate}
        classList={{ 'ex-template-modal': true }}
        onClose={() => setModal(undefined)}
      >
        {/* What a template is called and what it writes are the one answer, so
            they share a row. The picker says what it picks on its own, since the
            label beside it asks for the name. */}
        <Setting name={lang.settingTab.name} class="ex-template-modal-name">
          <Text value={currentEditCommandTemplate()?.name ?? ''} onChange={renameCurrentCommandTemplate} />
          <DropDown
            options={outputOptions}
            selected={currentOutput()}
            title={lang.settingTab.templateOutput}
            autofocus={false}
            onChange={setCurrentOutput}
          />
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
          <Button cta={true} onClick={() => setModal(undefined)}>
            {lang.settingTab.done}
          </Button>
        </div>
      </Modal>
    </>
  );

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
        yes: () =>
          batch(() => {
            setSettings('items', items => items.filter(v => v.name !== name));
            if (settings.lastEditName === name) {
              setSettings('lastEditName', settings.items.first()?.name);
            }
          }),
      },
    }).open();
  };

  /*
   * Lua filters. The manager owns the files in `lua/`; what is installed is
   * settings, so it is written here and handed back to the store as a prop —
   * which is what keeps the store, the templates table and `data.json` telling
   * the same story.
   */
  const luaFilters = new LuaFilterManager(plugin, BUNDLED_LUA_FILES);

  const setInstalledLuaFilters = (update: (prev: InstalledLuaFilter[]) => InstalledLuaFilter[]) => {
    setSettings('installedLuaFilters', update(settings.installedLuaFilters ?? []));
  };

  /** Add or replace a filter's record — an update reinstalls under the same id. */
  const recordLuaFilter = (filter: InstalledLuaFilter) => setInstalledLuaFilters(prev => [...prev.filter(f => f.id !== filter.id), filter]);

  /**
   * Run a filter in a template, or stop running it. The flag goes in the extra
   * arguments rather than the arguments proper: those come from the output
   * preset and are rewritten whole whenever it changes, which would take the
   * filter with them.
   */
  const updateTemplateArguments = (templateName: string, update: (args?: string) => string) => {
    const idx = settings.items.findIndex(v => v.name === templateName);
    if (idx === -1) {
      return;
    }
    setSettings(
      'items',
      idx,
      produce(item => {
        if (item.type === 'pandoc') {
          item.customArguments = update(item.customArguments);
        }
      })
    );
  };

  /** Which filter the template being edited is having switched on or off. */
  const setLuaFilterOnCurrentTemplate = (fileName: string, running: boolean) => {
    const template = currentEditCommandTemplate('pandoc');
    if (!template) {
      return;
    }
    updateTemplateArguments(template.name, args => (running ? addLuaFilterArg(args, fileName) : removeLuaFilterArg(args, fileName)));
  };

  /**
   * Forget an uninstalled filter, and stop every template running it — the file
   * is gone, so a template still naming it would fail the whole export.
   */
  const forgetLuaFilter = (filter: InstalledLuaFilter) => {
    batch(() => {
      for (const template of settings.items) {
        if (template.type === 'pandoc' && hasLuaFilterArg(template.customArguments, filter.fileName)) {
          updateTemplateArguments(template.name, args => removeLuaFilterArg(args, filter.fileName));
        }
      }
      setInstalledLuaFilters(prev => prev.filter(f => f.id !== filter.id));
    });
  };

  const LuaFilterStoreModal = () => (
    <LuaFilterStore
      lang={lang}
      app={app}
      manager={luaFilters}
      installed={settings.installedLuaFilters ?? []}
      onInstalled={recordLuaFilter}
      onUninstalled={forgetLuaFilter}
      onClose={() => setModal(undefined)}
    />
  );

  // Both blocks read through `?.`: the output dropdown can turn a pandoc
  // template into a custom one and back, so a block outlives its own type by
  // however long the switch takes to swap it out.
  const PandocCommandTempateEditBlock = () => {
    const template = () => currentEditCommandTemplate('pandoc');
    const updateTemplate = (update: (prev: Partial<PandocExportSetting>) => void) => {
      updateCurrentEditCommandTemplate(prev => (prev.type === 'pandoc' ? update(prev) : undefined));
    };
    /**
     * What this template writes. Read from the arguments rather than the preset,
     * so a hand-edited `-t` is what the rows below answer to.
     */
    const format = createMemo(() => outputFormat(template()?.arguments, template()?.customArguments));

    /**
     * One box per heading level a table of contents can reach, ticked down to
     * the depth the arguments ask for — depth is one number, so the boxes fill
     * from the top rather than being picked out one at a time.
     */
    const tocLevels = createMemo(() => {
      const depth = tocDepth(template()?.customArguments);
      return Array.from({ length: TOC_MAX_DEPTH }, (_, i) => ({
        value: String(i + 1),
        label: lang.settingTab.tocLevel(i + 1),
        checked: depth >= i + 1,
      }));
    });

    /** The reader extensions, ticked where the arguments switch them on. */
    const extensions = createMemo(() => {
      const on = enabledExtensions(template()?.customArguments);
      return PANDOC_EXTENSIONS.map(id => ({
        value: id,
        label: lang.settingTab.extension[id],
        // What the flag actually carries, as the filters' boxes do.
        title: id,
        checked: on.includes(id),
      }));
    });

    const toggleExtension = (id: string, on: boolean) =>
      updateTemplate(v => {
        const current = enabledExtensions(v.customArguments).filter(e => e !== id);
        v.customArguments = setExtensions(v.customArguments, on ? [...current, id] : current);
      });

    /** The extra arguments, which every writer option below is read back out of. */
    const args = () => template()?.customArguments;

    /** Setting one is always the same move: that field, rewritten. */
    const writeArgs = (write: (args?: string) => string) => updateTemplate(v => (v.customArguments = write(v.customArguments)));

    /**
     * Numbering, and the two lists that keep a table of contents company: three
     * flags with nothing to say for themselves, so they share one card — less
     * whichever of them this writer would ignore.
     */
    const numbering = createMemo(() => {
      const items: { value: string; label: string; title: string; checked: boolean }[] = [];
      if (supportsNumberSections(format())) {
        items.push({
          value: 'sections',
          label: lang.settingTab.numberSections,
          title: '--number-sections',
          checked: numberSections(args()),
        });
      }
      if (supportsSectionLists(format())) {
        items.push({ value: 'figures', label: lang.settingTab.listOfFigures, title: '--list-of-figures', checked: listOfFigures(args()) });
        items.push({ value: 'tables', label: lang.settingTab.listOfTables, title: '--list-of-tables', checked: listOfTables(args()) });
      }
      return items;
    });

    const toggleNumbering = (value: string, on: boolean) =>
      writeArgs(a =>
        value === 'sections' ? setNumberSections(a, on) : value === 'figures' ? setListOfFigures(a, on) : setListOfTables(a, on)
      );

    /**
     * A dropdown's options: pandoc's own answer first, which writes no flag at
     * all, then the ones it names. When the arguments carry something else — a
     * theme file, an engine of the user's own — that is a real answer too, and
     * is added rather than dropped on the floor by a picker that cannot show it.
     */
    const withCurrent = (options: { name: string; value: string }[], current?: string) =>
      current && !options.some(o => o.value === current) ? [...options, { name: current, value: current }] : options;

    const divisionOptions = [
      { name: lang.settingTab.division.default, value: '' },
      ...TOP_LEVEL_DIVISIONS.map(d => ({ name: lang.settingTab.division[d], value: d })),
    ];

    const highlightOptions = createMemo(() =>
      withCurrent(
        [
          { name: lang.settingTab.highlightDefault, value: '' },
          { name: lang.settingTab.highlightNone, value: HIGHLIGHT_NONE },
          ...HIGHLIGHT_STYLES.map(s => ({ name: lang.settingTab.highlightStyle[s], value: s })),
        ],
        highlightStyle(args())
      )
    );

    const mathOptions = [
      { name: lang.settingTab.mathDefault, value: '' },
      ...MATH_METHODS.map(m => ({ name: lang.settingTab.mathMethod[m], value: m })),
    ];

    const engineOptions = createMemo(() =>
      withCurrent(
        [{ name: lang.settingTab.pdfEngineDefault, value: '' }, ...PDF_ENGINES.map(e => ({ name: e, value: e }))],
        pdfEngine(args())
      )
    );

    /**
     * Whether the advanced panel has anything to ask this writer. Every row in
     * it is gated on the format, so a writer that answers none of them would
     * otherwise be given a heading over an empty panel.
     */
    const hasAdvanced = () =>
      numbering().length > 0 ||
      supportsTopLevelDivision(format()) ||
      supportsHighlighting(format()) ||
      supportsMathMethod(format()) ||
      isPdfOutput(format());

    /*
     * The rows a template is usually opened for come first, under its name and
     * in plain sight. Everything a format allows but few templates use is folded
     * away into one panel below them — one fold, not five, so the modal is a
     * short list rather than a stack of headings. The command line stays where
     * it can be read at the foot of it.
     */
    return (
      <>
        {/* Only for the writers that would do something with it — asking man or
            textile for a table of contents changes nothing at all. */}
        <Show when={supportsToc(format())}>
          <Setting name={lang.settingTab.tableOfContents} description={lang.settingTab.tableOfContentsDesc} class="ex-template-modal-toc">
            <CheckGrid
              items={tocLevels()}
              onToggle={(value, checked) =>
                // Ticking a level takes the contents down to it; clearing one
                // stops them at the level above, so unticking the first is "none".
                updateTemplate(v => (v.customArguments = setTocDepth(v.customArguments, Number(value) - (checked ? 0 : 1))))
              }
            />
          </Setting>
        </Show>

        {/* Writes the extra arguments: adding a filter appends its
            `--lua-filter` flag to them. */}
        <Setting name={lang.settingTab.luaFilters} class="ex-template-modal-filters">
          <TemplateLuaFilters
            lang={lang}
            installed={settings.installedLuaFilters ?? []}
            format={format()}
            args={template()?.customArguments}
            onAdd={fileName => setLuaFilterOnCurrentTemplate(fileName, true)}
            onRemove={fileName => setLuaFilterOnCurrentTemplate(fileName, false)}
          />
        </Setting>

        {/* Writes that same field: ticking a box puts `-f
            ${fromFormat}+extension` in it. Every extension offered is one pandoc
            leaves off, so a cleared box is the reader's own behaviour. */}
        <Setting name={lang.settingTab.extensions} description={lang.settingTab.extensionsDesc} class="ex-template-modal-extensions">
          <CheckGrid items={extensions()} onToggle={toggleExtension} />
        </Setting>

        <Show when={hasAdvanced()}>
          <Section name={lang.settingTab.advanced} class="ex-template-modal-advanced" open={advancedOpen()} onToggle={setAdvancedOpen}>
            <Show when={numbering().length > 0}>
              <Setting name={lang.settingTab.numbering} description={lang.settingTab.numberingDesc} class="ex-template-modal-numbering">
                <CheckGrid items={numbering()} onToggle={toggleNumbering} />
              </Setting>
            </Show>

            {/* Once there is numbering for it to offset, and only in the two
                formats pandoc says it reaches. */}
            <Collapsible when={supportsNumberOffset(format()) && numberSections(args())} class="ex-template-modal-offset-panel">
              <Setting
                name={lang.settingTab.numberOffset}
                description={lang.settingTab.numberOffsetDesc}
                class="ex-template-modal-number-offset"
              >
                <Text value={numberOffset(args()) ?? ''} placeholder="0" onChange={value => writeArgs(a => setNumberOffset(a, value))} />
              </Setting>
            </Collapsible>

            <Show when={supportsTopLevelDivision(format())}>
              <Setting
                name={lang.settingTab.topLevelDivision}
                description={lang.settingTab.topLevelDivisionDesc}
                class="ex-template-modal-division"
              >
                <DropDown
                  options={divisionOptions}
                  selected={topLevelDivision(args()) ?? ''}
                  autofocus={false}
                  onChange={value => writeArgs(a => setTopLevelDivision(a, value))}
                />
              </Setting>
            </Show>

            <Show when={supportsHighlighting(format())}>
              <Setting
                name={lang.settingTab.syntaxHighlighting}
                description={lang.settingTab.syntaxHighlightingDesc}
                class="ex-template-modal-highlight"
              >
                <DropDown
                  options={highlightOptions()}
                  selected={highlightStyle(args()) ?? ''}
                  autofocus={false}
                  onChange={value => writeArgs(a => setHighlightStyle(a, value))}
                />
              </Setting>
            </Show>

            <Show when={supportsMathMethod(format())}>
              <Setting name={lang.settingTab.math} description={lang.settingTab.mathDesc} class="ex-template-modal-math">
                <DropDown
                  options={mathOptions}
                  selected={mathMethod(args()) ?? ''}
                  autofocus={false}
                  onChange={value => writeArgs(a => setMathMethod(a, value))}
                />
              </Setting>
            </Show>

            <Show when={isPdfOutput(format())}>
              <Setting name={lang.settingTab.pdfEngine} description={lang.settingTab.pdfEngineDesc} class="ex-template-modal-pdf-engine">
                <DropDown
                  options={engineOptions()}
                  selected={pdfEngine(args()) ?? ''}
                  autofocus={false}
                  onChange={value => writeArgs(a => setPdfEngine(a, value))}
                />
              </Setting>
            </Show>
          </Section>
        </Show>

        <Setting name={lang.settingTab.arguments} class="ex-template-modal-arguments">
          <Text style="width: 100%" value={template()?.arguments ?? ''} onChange={value => updateTemplate(v => (v.arguments = value))} />
        </Setting>
        <Setting name={lang.settingTab.extraArguments} class="ex-template-modal-extra-arguments">
          <Text
            style="width: 100%"
            value={template()?.customArguments ?? ''}
            title={template()?.customArguments}
            onChange={value => updateTemplate(v => (v.customArguments = value))}
          />
        </Setting>

        {/* The toggle and the field it reveals are one answer, so they share one
            card rather than standing as two. */}
        <div class="ex-card ex-template-modal-run">
          <Setting name={lang.settingTab.runCommand} class="ex-template-modal-run-toggle">
            <Toggle checked={template()?.runCommand} onChange={checked => updateTemplate(v => (v.runCommand = checked))} />
          </Setting>
          <Collapsible when={template()?.runCommand} class="ex-template-modal-run-panel">
            <Setting class="ex-template-modal-command ex-template-modal-nameless">
              <Text style="width: 100%" value={template()?.command ?? ''} onChange={value => updateTemplate(v => (v.command = value))} />
            </Setting>
          </Collapsible>
        </div>
      </>
    );
  };

  const CustomCommandTempateEditBlock = () => {
    const template = () => currentEditCommandTemplate('custom');
    const updateTemplate = (update: (prev: Partial<CustomExportSetting>) => void) => {
      updateCurrentEditCommandTemplate(prev => (prev.type === 'custom' ? update(prev) : undefined));
    };
    return (
      <>
        <Setting name={lang.settingTab.command} class="ex-template-modal-custom-command">
          <Text style="width: 100%" value={template()?.command ?? ''} onChange={value => updateTemplate(v => (v.command = value))} />
        </Setting>
        <Setting name={lang.settingTab.targetFileExtensions} class="ex-template-modal-target-extensions">
          <Text value={template()?.targetFileExtensions ?? ''} onChange={value => updateTemplate(v => (v.targetFileExtensions = value))} />
        </Setting>

        {/* The counterpart of the pandoc block's run-command toggle: a custom
          template is a command, and this is the only word it says back. */}
        <Setting name={lang.settingTab.showCommandOutput} class="ex-template-modal-show-output">
          <Toggle
            checked={template()?.showCommandOutput ?? false}
            onChange={checked => updateTemplate(v => (v.showCommandOutput = checked))}
          />
        </Setting>
      </>
    );
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
      filters: process.platform == 'win32' ? [{ extensions: ['exe'], name: 'pandoc' }] : undefined,
      properties: ['openFile'],
    });

    if (!retval.canceled && retval.filePaths.length > 0) {
      setSettings('pandocPath', v => setPlatformValue(v, retval.filePaths[0]));
    }
  };

  // Asked on every open, answered from the session's cache after the first one
  // that succeeded — see `getCachedPandocVersion`. Still an effect, so changing
  // the path or the environment goes and asks the binary it now points at.
  createEffect(async () => {
    try {
      const env = createEnv(getPlatformValue(settings.env) ?? {});
      setPandocVersion(await pandoc.getCachedVersion(getPlatformValue(settings.pandocPath), env));
    } catch {
      setPandocVersion(undefined);
    }
  });

  return (
    <>
      <PandocDashboard
        lang={lang}
        version={pandocVersion()}
        markdownLinks={app.vault.config.useMarkdownLinks}
        path={getPlatformValue(settings.pandocPath) ?? ''}
        onPathChange={value => setSettings('pandocPath', v => setPlatformValue(v, value))}
        onChoosePath={choosePandocPath}
      />

      <Setting name={lang.settingTab.defaults} heading={true} />

      <div class="ex-settings-card">
        <Setting name={lang.settingTab.defaultFolderForExportedFile}>
          <DropDown
            options={[
              { name: lang.settingTab.sameFolderWithCurrentFile, value: 'Same' },
              { name: lang.settingTab.customLocation, value: 'Custom' },
            ]}
            selected={settings.defaultExportDirectoryMode}
            onChange={(v: 'Same' | 'Custom') => setSettings('defaultExportDirectoryMode', v)}
          />
        </Setting>

        <Collapsible when={settings.defaultExportDirectoryMode === 'Custom'}>
          <Setting class="ex-export-destination-path">
            <Text style="width: 100%" value={customDefaultExportDirectory() ?? ''} title={customDefaultExportDirectory()} />
            <ExtraButton icon="folder" onClick={chooseCustomDefaultExportDirectory} />
          </Setting>
        </Collapsible>

        <Setting name={lang.settingTab.openExportedFileLocation}>
          <Toggle checked={settings.openExportedFileLocation} onChange={v => setSettings('openExportedFileLocation', v)} />
        </Setting>

        <Setting name={lang.settingTab.openExportedFile}>
          <Toggle checked={settings.openExportedFile} onChange={v => setSettings('openExportedFile', v)} />
        </Setting>

        <Setting name={lang.settingTab.ShowExportProgressBar}>
          <Toggle checked={settings.showExportProgressBar} onChange={v => setSettings('showExportProgressBar', v)} />
        </Setting>

        {/* TODO:// optimize UI as https://www.jetbrains.com/help/idea/absolute-path-variables.html */}
        <Setting name={lang.settingTab.environmentVariables}>
          <ExtraButton icon="pencil" tooltip={lang.settingTab.edit} onClick={() => setEditingEnvVars(v => !v)} />
        </Setting>

        <Collapsible when={editingEnvVars()}>
          <Setting class="ex-nameless-setting">
            <TextArea class="ex-env-vars" autoSize={true} visible={editingEnvVars()} value={envVars()} onChange={setEnvVars} />
          </Setting>
        </Collapsible>
      </div>

      <Setting name={lang.settingTab.exportTemplates} heading={true} />

      <TemplateActions lang={lang} onAdd={addCommandTemplate} onBrowseLuaFilters={() => setModal(() => LuaFilterStoreModal)} />

      <TemplateTable lang={lang} templates={settings.items} onEdit={editCommandTemplate} onRemove={removeCommandTemplate} />

      <Show when={modal()}>
        <Dynamic component={modal()} ref={(el: Node) => document.body.appendChild(el)} />
      </Show>
    </>
  );
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
              settingTab.browseLuaFilters,
              settingTab.luaFilters,
              this.lang.luaFilterStore.title,
              settingTab.editCommandTemplate,
              settingTab.command,
              settingTab.arguments,
              settingTab.extraArguments,
              settingTab.extensions,
              settingTab.tableOfContents,
              settingTab.targetFileExtensions,
              settingTab.showCommandOutput,
              settingTab.runCommand,
              settingTab.templateOutput,
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
