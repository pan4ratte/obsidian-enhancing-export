import * as ct from 'electron';
import process from 'process';
import { Notice, PluginSettingTab } from 'obsidian';
import type { SettingDefinitionItem } from 'obsidian';
import type { SemVer } from 'semver';
import type UniversalExportPlugin from '../main';
import { CustomExportSetting, ExportSetting, PandocExportSetting, createEnv, DEFAULT_ENV } from '../settings';
import { setPlatformValue, getPlatformValue } from '../utils';

import { createSignal, createRoot, onCleanup, createMemo, createEffect, For, Show, batch, Match, Switch, JSX } from 'solid-js';
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
import StepSlider from './components/StepSlider';
import { TOC_MAX_DEPTH, TOC_NONE, setTocDepth, tocDepth } from '../toc_args';
import { PANDOC_EXTENSIONS, enabledExtensions, setExtensions } from '../pandoc_extensions';
import {
  CURATED_VARIABLES,
  EMAIL_OBFUSCATIONS,
  EOL_MODES,
  FONT_SIZES,
  HIGHLIGHT_NONE,
  HIGHLIGHT_STYLES,
  MATH_METHODS,
  PAPER_SIZES,
  PDF_ENGINES,
  REFERENCE_LOCATIONS,
  SHIFT_HEADING_LEVELS,
  SLIDE_LEVELS,
  SPLIT_LEVELS,
  TOP_LEVEL_DIVISIONS,
  WRAP_MODES,
  ascii,
  bibliography,
  citeproc,
  columns,
  commandLines,
  csl,
  css,
  dpi,
  emailObfuscation,
  embedResources,
  eol,
  epubCoverImage,
  epubEmbedFont,
  epubSubdirectory,
  epubTitlePage,
  extractMedia,
  highlightStyle,
  idPrefix,
  includeAfterBody,
  includeBeforeBody,
  includeInHeader,
  incremental,
  listOfFigures,
  listOfTables,
  markdownHeadings,
  mathMethod,
  mathUrl,
  numberOffset,
  numberSections,
  pairsFromText,
  pdfEngine,
  referenceDoc,
  referenceLinks,
  referenceLocation,
  sectionDivs,
  setAscii,
  setBibliography,
  setCiteproc,
  setColumns,
  setCsl,
  setCss,
  setDpi,
  setEmailObfuscation,
  setEmbedResources,
  setEol,
  setEpubCoverImage,
  setEpubEmbedFont,
  setEpubSubdirectory,
  setEpubTitlePage,
  setExtractMedia,
  setHighlightStyle,
  setIdPrefix,
  setIncludeAfterBody,
  setIncludeBeforeBody,
  setIncludeInHeader,
  setIncremental,
  setListOfFigures,
  setListOfTables,
  setMarkdownHeadings,
  setMathMethod,
  setMathUrl,
  setNumberOffset,
  setNumberSections,
  setPdfEngine,
  setReferenceDoc,
  setReferenceLinks,
  setReferenceLocation,
  setSectionDivs,
  setShiftHeadingLevelBy,
  setSlideLevel,
  setSplitLevel,
  setStripComments,
  setSyntaxDefinition,
  setTabStop,
  setTemplateFile,
  setTopLevelDivision,
  setVariable,
  setVariables,
  setWrap,
  shiftHeadingLevelBy,
  slideLevel,
  splitLevel,
  stripComments,
  syntaxDefinition,
  tabStop,
  takesMathUrl,
  templateFile,
  textFromPairs,
  topLevelDivision,
  variable,
  variables,
  wrap,
  type CuratedVariable,
} from '../writer_args';
import {
  isEpubOutput,
  isPdfOutput,
  isSlideOutput,
  outputFormat,
  supportsAscii,
  supportsCss,
  supportsDpi,
  supportsEmbedResources,
  supportsEol,
  supportsHeaderInclude,
  supportsHighlighting,
  supportsHtmlOptions,
  supportsIncludes,
  supportsMarkdownHeadings,
  supportsMathMethod,
  supportsNumberOffset,
  supportsNumberSections,
  supportsReferenceDoc,
  supportsReferenceLinks,
  supportsReferenceLocation,
  supportsSectionLists,
  supportsSplitLevel,
  supportsTemplate,
  supportsToc,
  supportsTopLevelDivision,
  supportsVariable,
  supportsWrap,
} from '../pandoc_format';
import { MessageBox } from './message_box';
import Modal from './components/Modal';
import Button from './components/Button';
import Collapsible from './components/Collapsible';
import Section from './components/Section';
import Setting, { Text, Toggle, ExtraButton, DropDown, TextArea } from './components/Setting';
import FileInput from './components/FileInput';
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

/** The same, for the command at the foot of it. Closed to begin with: it is a
    thing to check, not a thing to fill in. */
const [commandOpen, setCommandOpen] = createSignal(false);

/*
 * What the file dialogs offer to open. Every one of them ends in everything,
 * since a path a template names is as often a file kept under a name of the
 * user's own as it is one of these.
 */
const ANY_FILE = { name: 'All files', extensions: ['*'] };
const BIBLIOGRAPHY_FILES = [{ name: 'Bibliography', extensions: ['bib', 'bibtex', 'json', 'yaml', 'yml', 'ris', 'enl', 'xml'] }, ANY_FILE];
const CSL_FILES = [{ name: 'Citation style', extensions: ['csl'] }, ANY_FILE];
const CSS_FILES = [{ name: 'Stylesheet', extensions: ['css'] }, ANY_FILE];
const SYNTAX_FILES = [{ name: 'Syntax definition', extensions: ['xml'] }, ANY_FILE];
const IMAGE_FILES = [{ name: 'Image', extensions: ['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp'] }, ANY_FILE];
const FONT_FILES = [{ name: 'Font', extensions: ['otf', 'ttf', 'woff', 'woff2'] }, ANY_FILE];

/**
 * The two curated variables with an answer short enough to be picked from a
 * list. The rest are typed: a font is whatever is installed, and a geometry is
 * a line of options to the LaTeX package that reads it.
 */
const VARIABLE_CHOICES: Partial<Record<CuratedVariable, readonly string[]>> = {
  papersize: PAPER_SIZES,
  fontsize: FONT_SIZES,
};

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
    // is carried across. The rows' own arguments belong to the format that took
    // them, but options typed by hand are the user's and are kept.
    const previous = currentOutput();
    const name = previous && isGeneratedName(template.name, previous) ? uniqueTemplateName(preset.name, template.name) : template.name;
    const carried = template.type === 'pandoc' && preset.type === 'pandoc' ? { userArguments: template.userArguments } : {};
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

        {/* Every row writes straight through, so there is nothing here left to
            save — but the button is the way out of the modal, and "Save" is
            what a form of this length is expected to end with. */}
        <div class="modal-button-container">
          <Button cta={true} onClick={() => setModal(undefined)}>
            {lang.settingTab.save}
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
     * so a hand-edited `-t` is what the rows below answer to — in the order
     * pandoc will read them, the hand-written options last, since a `-t` there is
     * the one that wins.
     */
    const format = createMemo(() => outputFormat(template()?.arguments, template()?.customArguments, template()?.userArguments));

    /**
     * The steps a table of contents can be taken to: none at all, then one
     * heading level at a time down to the deepest pandoc reaches.
     *
     * Depth is a single number, and a slider is the control that says so. The
     * boxes that stood here before could be ticked into states no depth can
     * hold — level three without level two — and had to fill from the top to
     * keep the lie off the screen.
     */
    const tocLabels = [lang.settingTab.tocNone, ...Array.from({ length: TOC_MAX_DEPTH }, (_, i) => String(i + 1))];

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

    /** The curated variables this writer was measured to read, and no others. */
    const curatedVariables = createMemo(() => CURATED_VARIABLES.filter(name => supportsVariable[name](format())));

    const variableOptions = (name: CuratedVariable) =>
      withCurrent(
        [{ name: lang.settingTab.variableDefault, value: '' }, ...(VARIABLE_CHOICES[name] ?? []).map(value => ({ name: value, value }))],
        variable(args(), name)
      );

    /**
     * Everything the rows above do not ask for, as one `key=value` a line.
     *
     * What is on screen in a row of its own is left out of the list rather than
     * shown twice — and put back in the moment the format changes to one with
     * no row for it, so a variable can never go quietly missing.
     */
    const otherVariables = createMemo(() =>
      textFromPairs(variables(args()).filter(v => !curatedVariables().includes(v.key as CuratedVariable)))
    );

    /*
     * The format-specific pickers. Each carries pandoc's own answer first, as
     * the rows above do, and `withCurrent` keeps a hand-written one that none
     * of them names — `--wrap=auto`, said out loud rather than left to pandoc.
     */
    const wrapOptions = createMemo(() =>
      withCurrent(
        [
          { name: lang.settingTab.wrapDefault, value: '' },
          ...WRAP_MODES.map(mode => ({ name: lang.settingTab.wrapMode[mode], value: mode })),
        ],
        wrap(args())
      )
    );

    // ATX is pandoc's own answer and is written as no option at all, the way
    // the top-level division's default is — one less thing in the line.
    const headingStyleOptions = createMemo(() =>
      withCurrent(
        [
          { name: lang.settingTab.markdownHeadingsDefault, value: '' },
          { name: lang.settingTab.markdownHeadingSetext, value: 'setext' },
        ],
        markdownHeadings(args())
      )
    );

    const referenceLocationOptions = createMemo(() =>
      withCurrent(
        [
          { name: lang.settingTab.referenceLocationDefault, value: '' },
          ...REFERENCE_LOCATIONS.filter(where => where !== 'block').map(where => ({
            name: lang.settingTab.referenceLocationOption[where],
            value: where,
          })),
        ],
        referenceLocation(args())
      )
    );

    // Pandoc works the slide level out from the document unless it is told, so
    // the default is no option at all; `0` is an answer of its own.
    const slideLevelOptions = createMemo(() =>
      withCurrent(
        [
          { name: lang.settingTab.slideLevelDefault, value: '' },
          ...SLIDE_LEVELS.map(level => ({
            name: level === '0' ? lang.settingTab.slideLevelNone : lang.settingTab.tocLevel(Number(level)),
            value: level,
          })),
        ],
        slideLevel(args())
      )
    );

    const splitLevelOptions = createMemo(() =>
      withCurrent(
        [
          { name: lang.settingTab.splitLevelDefault, value: '' },
          ...SPLIT_LEVELS.map(level => ({ name: lang.settingTab.tocLevel(Number(level)), value: level })),
        ],
        splitLevel(args())
      )
    );

    /* Named by what they do rather than by the number they write: `-1` is a
       promotion, and `--shift-heading-level-by=-1` is not what anyone means to
       say. Pandoc reaches six either way; three is as far as a note goes. */
    const shiftHeadingOptions = createMemo(() =>
      withCurrent(
        [
          { name: lang.settingTab.shiftHeadingsNone, value: '' },
          ...SHIFT_HEADING_LEVELS.map(shift => ({
            name: shift < 0 ? lang.settingTab.shiftHeadingsUp(-shift) : lang.settingTab.shiftHeadingsDown(shift),
            value: String(shift),
          })),
        ],
        shiftHeadingLevelBy(args())
      )
    );

    const eolOptions = createMemo(() =>
      withCurrent(
        [
          { name: lang.settingTab.lineEndingsDefault, value: '' },
          ...EOL_MODES.map(mode => ({ name: lang.settingTab.lineEnding[mode], value: mode })),
        ],
        eol(args())
      )
    );

    const obfuscationOptions = createMemo(() =>
      withCurrent(
        [
          { name: lang.settingTab.emailObfuscationDefault, value: '' },
          ...EMAIL_OBFUSCATIONS.map(method => ({ name: lang.settingTab.emailObfuscationMethod[method], value: method })),
        ],
        emailObfuscation(args())
      )
    );

    /** The document a docx, odt or pptx export takes its styles from. */
    const referenceDocFiles = createMemo(() => [
      { name: lang.settingTab.referenceDoc, extensions: [format() === 'pptx' ? 'pptx' : format() === 'odt' ? 'odt' : 'docx'] },
      ANY_FILE,
    ]);

    /**
     * The line pandoc is given, assembled the way `exportToOo` assembles it —
     * the binary, the note, the preset's arguments, then the extra ones.
     *
     * The `${...}` are left standing. They are filled in at export time from the
     * note being exported and the folder it is going to, neither of which exists
     * while a template is being edited, and the PDF and Latex presets carry an
     * expression that cannot be evaluated without the export dialog's options.
     * Shown as they are, the line is the one worth pasting into a bug report.
     *
     * It is the whole of it, too: the export dialog no longer has a field of
     * its own to append to this, so what is here is what pandoc is run with.
     */
    const resultingCommand = createMemo(() =>
      [
        pandoc.normalizePath(getPlatformValue(settings.pandocPath)),
        '"${currentPath}"',
        template()?.arguments,
        template()?.customArguments,
        template()?.userArguments,
      ]
        .map(part => part?.trim())
        .filter(part => part)
        .join(' ')
    );

    /**
     * The same command, one option a line.
     *
     * Only for reading: a shell reads a newline as the end of a command, so it is
     * the single line above that gets copied.
     */
    const commandForReading = createMemo(() => commandLines(resultingCommand()).join('\n'));

    const copyCommand = async () => {
      try {
        await navigator.clipboard.writeText(resultingCommand());
        new Notice(lang.settingTab.commandCopied, 1500);
      } catch (e) {
        console.error(e);
        new Notice(lang.settingTab.commandCopyFailed);
      }
    };

    /*
     * The rows a template is usually opened for come first, under its name and
     * in plain sight. Everything a format allows but few templates use is folded
     * away into one panel below them — one fold, not five, so the modal is a
     * short list rather than a stack of headings. The command line stays where
     * it can be read at the foot of it.
     */
    return (
      <>
        {/* Directly under the name, where the template's own styles are read
            from: the docx, odt or pptx a template is written to look like is
            the first thing asked of it, not an advanced afterthought.

            The two rows are one question asked two ways, and no writer is asked
            both — a word processor is laid out by a document, everything else by
            a template — so exactly one of them stands here. */}
        <Show when={supportsReferenceDoc(format())}>
          <Setting
            name={lang.settingTab.referenceDoc}
            description={lang.settingTab.referenceDocDesc}
            class="ex-template-modal-reference-doc"
          >
            <FileInput
              value={referenceDoc(args())}
              filters={referenceDocFiles()}
              tooltip={lang.settingTab.chooseFile}
              onChange={value => writeArgs(a => setReferenceDoc(a, value.trim()))}
            />
          </Setting>
        </Show>

        <Show when={supportsTemplate(format())}>
          <Setting
            name={lang.settingTab.outputTemplate}
            description={lang.settingTab.outputTemplateDesc}
            class="ex-template-modal-output-template"
          >
            <FileInput
              value={templateFile(args())}
              filters={[ANY_FILE]}
              tooltip={lang.settingTab.chooseFile}
              onChange={value => writeArgs(a => setTemplateFile(a, value.trim()))}
            />
          </Setting>
        </Show>

        {/* Only for the writers that would do something with it — asking man or
            textile for a table of contents changes nothing at all. */}
        <Show when={supportsToc(format())}>
          <Setting name={lang.settingTab.tableOfContents} description={lang.settingTab.tableOfContentsDesc} class="ex-template-modal-toc">
            <StepSlider
              labels={tocLabels}
              min={TOC_NONE}
              value={tocDepth(template()?.customArguments)}
              // The step is the depth, and `setTocDepth` takes the flags back
              // out again at `TOC_NONE` — so sliding to the left end is "none".
              onChange={depth => updateTemplate(v => (v.customArguments = setTocDepth(v.customArguments, depth)))}
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

        {/* Not gated on the format the way the panel's rows once were: the
            citations and the variables at the foot of it are asked of every
            writer, so there is always something to open. */}
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

          {/* Read on the way in rather than written on the way out, which is why
              none of these three is asked of a format: they are done to the note
              before any writer sees it, so every writer answers to them. */}
          <div class="ex-card ex-template-modal-reading">
            <Setting name={lang.settingTab.reading} description={lang.settingTab.readingDesc} heading={true} />

            {/* Demoting makes room for a title above the note's own headings;
                promoting turns a single top heading into one. */}
            <Setting name={lang.settingTab.shiftHeadings} description={lang.settingTab.shiftHeadingsDesc} class="ex-template-modal-shift">
              <DropDown
                options={shiftHeadingOptions()}
                selected={shiftHeadingLevelBy(args()) ?? ''}
                autofocus={false}
                onChange={value => writeArgs(a => setShiftHeadingLevelBy(a, value))}
              />
            </Setting>

            <Setting name={lang.settingTab.tabStop} description={lang.settingTab.tabStopDesc} class="ex-template-modal-tab-stop">
              <Text value={tabStop(args()) ?? ''} placeholder="4" onChange={value => writeArgs(a => setTabStop(a, value))} />
            </Setting>

            <Setting
              name={lang.settingTab.stripComments}
              description={lang.settingTab.stripCommentsDesc}
              class="ex-template-modal-strip-comments"
            >
              <Toggle checked={stripComments(args())} onChange={checked => writeArgs(a => setStripComments(a, checked))} />
            </Setting>
          </div>

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

          {/* The colours and the language definition are one subject, so they
              share a card: a syntax file is only worth naming to a writer that
              highlights, which is the same writer this row is offered to. */}
          <Show when={supportsHighlighting(format())}>
            <div class="ex-card ex-template-modal-highlight">
              <Setting
                name={lang.settingTab.syntaxHighlighting}
                description={lang.settingTab.syntaxHighlightingDesc}
                class="ex-template-modal-highlight-style"
              >
                <DropDown
                  options={highlightOptions()}
                  selected={highlightStyle(args()) ?? ''}
                  autofocus={false}
                  onChange={value => writeArgs(a => setHighlightStyle(a, value))}
                />
              </Setting>
              <Setting
                name={lang.settingTab.syntaxDefinition}
                description={lang.settingTab.syntaxDefinitionDesc}
                class="ex-template-modal-syntax-definition"
              >
                <FileInput
                  value={syntaxDefinition(args())}
                  filters={SYNTAX_FILES}
                  tooltip={lang.settingTab.chooseFile}
                  onChange={value => writeArgs(a => setSyntaxDefinition(a, value.trim()))}
                />
              </Setting>
            </div>
          </Show>

          {/* The method and the build it loads are one answer, so they share a
              card: the URL is only a question once something has been chosen that
              would fetch one, and `--mathml` fetches nothing. */}
          <Show when={supportsMathMethod(format())}>
            <div class="ex-card ex-template-modal-math">
              <Setting name={lang.settingTab.math} description={lang.settingTab.mathDesc} class="ex-template-modal-math-method">
                <DropDown
                  options={mathOptions}
                  selected={mathMethod(args()) ?? ''}
                  autofocus={false}
                  onChange={value => writeArgs(a => setMathMethod(a, value))}
                />
              </Setting>
              <Collapsible when={takesMathUrl(mathMethod(args()))} class="ex-template-modal-math-url-panel">
                <Setting name={lang.settingTab.mathUrl} description={lang.settingTab.mathUrlDesc} class="ex-template-modal-math-url">
                  <Text
                    value={mathUrl(args()) ?? ''}
                    placeholder={lang.settingTab.mathUrlPlaceholder}
                    onChange={value => writeArgs(a => setMathUrl(a, value))}
                  />
                </Setting>
              </Collapsible>
            </div>
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

          {/* Citeproc reads the document rather than writing it, so this is
              the one row here with no format to be gated on. The two files are
              only ever read on its behalf, and are folded away with it. */}
          <div class="ex-card ex-template-modal-citations">
            <Setting
              name={lang.settingTab.citations}
              description={lang.settingTab.citationsDesc}
              class="ex-template-modal-citations-toggle"
            >
              <Toggle checked={citeproc(args())} onChange={checked => writeArgs(a => setCiteproc(a, checked))} />
            </Setting>
            <Collapsible when={citeproc(args())} class="ex-template-modal-citations-panel">
              <Setting name={lang.settingTab.bibliography} description={lang.settingTab.bibliographyDesc}>
                <FileInput
                  value={bibliography(args())}
                  filters={BIBLIOGRAPHY_FILES}
                  tooltip={lang.settingTab.chooseFile}
                  onChange={value => writeArgs(a => setBibliography(a, value.trim()))}
                />
              </Setting>
              <Setting name={lang.settingTab.csl} description={lang.settingTab.cslDesc}>
                <FileInput
                  value={csl(args())}
                  filters={CSL_FILES}
                  tooltip={lang.settingTab.chooseFile}
                  onChange={value => writeArgs(a => setCsl(a, value.trim()))}
                />
              </Setting>
            </Collapsible>
          </div>

          {/* The page itself, told to the writer as template variables. Each
              row is shown only where that writer was measured to read it, so
              the card is as long as the format has answers for. */}
          <Show when={curatedVariables().length > 0}>
            <div class="ex-card ex-template-modal-page-setup">
              <Setting name={lang.settingTab.pageSetup} description={lang.settingTab.pageSetupDesc} heading={true} />
              <For each={curatedVariables()}>
                {name => (
                  <Setting name={lang.settingTab.variableName[name]} class={`ex-template-modal-variable ex-template-modal-${name}`}>
                    <Show
                      when={VARIABLE_CHOICES[name]}
                      fallback={
                        <Text
                          value={variable(args(), name) ?? ''}
                          placeholder={lang.settingTab.variablePlaceholder[name]}
                          onChange={value => writeArgs(a => setVariable(a, name, value.trim()))}
                        />
                      }
                    >
                      <DropDown
                        options={variableOptions(name)}
                        selected={variable(args(), name) ?? ''}
                        autofocus={false}
                        onChange={value => writeArgs(a => setVariable(a, name, value))}
                      />
                    </Show>
                  </Setting>
                )}
              </For>
            </div>
          </Show>

          <Show when={supportsCss(format())}>
            <Setting name={lang.settingTab.stylesheet} description={lang.settingTab.stylesheetDesc} class="ex-template-modal-css">
              <FileInput
                value={css(args())}
                filters={CSS_FILES}
                tooltip={lang.settingTab.chooseFile}
                onChange={value => writeArgs(a => setCss(a, value.trim()))}
              />
            </Setting>
          </Show>

          {/* Three files around the one document, so they share a card. The
              header is left out of the writers that have a body to put a file
              around but no header to put one into. */}
          <Show when={supportsIncludes(format())}>
            <div class="ex-card ex-template-modal-includes">
              <Setting name={lang.settingTab.includes} description={lang.settingTab.includesDesc} heading={true} />
              <Show when={supportsHeaderInclude(format())}>
                <Setting name={lang.settingTab.includeInHeader}>
                  <FileInput
                    value={includeInHeader(args())}
                    filters={[ANY_FILE]}
                    tooltip={lang.settingTab.chooseFile}
                    onChange={value => writeArgs(a => setIncludeInHeader(a, value.trim()))}
                  />
                </Setting>
              </Show>
              <Setting name={lang.settingTab.includeBeforeBody}>
                <FileInput
                  value={includeBeforeBody(args())}
                  filters={[ANY_FILE]}
                  tooltip={lang.settingTab.chooseFile}
                  onChange={value => writeArgs(a => setIncludeBeforeBody(a, value.trim()))}
                />
              </Setting>
              <Setting name={lang.settingTab.includeAfterBody}>
                <FileInput
                  value={includeAfterBody(args())}
                  filters={[ANY_FILE]}
                  tooltip={lang.settingTab.chooseFile}
                  onChange={value => writeArgs(a => setIncludeAfterBody(a, value.trim()))}
                />
              </Setting>
            </div>
          </Show>

          {/* What the file itself looks like, for the writers that produce
              text a person reads. The heading style and the reference links
              are markdown's alone, so the card is as long as the writer has
              answers for. */}
          <Show when={supportsWrap(format())}>
            <div class="ex-card ex-template-modal-source">
              <Setting name={lang.settingTab.writtenSource} description={lang.settingTab.writtenSourceDesc} heading={true} />

              <Setting name={lang.settingTab.wrap} class="ex-template-modal-wrap">
                <DropDown
                  options={wrapOptions()}
                  selected={wrap(args()) ?? ''}
                  autofocus={false}
                  onChange={value => writeArgs(a => setWrap(a, value))}
                />
              </Setting>

              {/* A column to wrap at is only a question while something wraps. */}
              <Collapsible when={wrap(args()) !== 'none'} class="ex-template-modal-columns-panel">
                <Setting name={lang.settingTab.columns} class="ex-template-modal-columns">
                  <Text value={columns(args()) ?? ''} placeholder="72" onChange={value => writeArgs(a => setColumns(a, value))} />
                </Setting>
              </Collapsible>

              <Show when={supportsMarkdownHeadings(format())}>
                <Setting name={lang.settingTab.markdownHeadings} class="ex-template-modal-headings">
                  <DropDown
                    options={headingStyleOptions()}
                    selected={markdownHeadings(args()) ?? ''}
                    autofocus={false}
                    onChange={value => writeArgs(a => setMarkdownHeadings(a, value))}
                  />
                </Setting>
              </Show>

              <Show when={supportsReferenceLinks(format())}>
                <Setting name={lang.settingTab.referenceLinks} class="ex-template-modal-reference-links">
                  <Toggle checked={referenceLinks(args())} onChange={checked => writeArgs(a => setReferenceLinks(a, checked))} />
                </Setting>
              </Show>
            </div>
          </Show>

          {/* The bytes rather than the layout, and each on its own gate: a PDF
              has no line endings to choose, and only some of the writers that
              have them can escape what is not ASCII. */}
          <Show when={supportsEol(format())}>
            <Setting name={lang.settingTab.lineEndings} class="ex-template-modal-eol">
              <DropDown
                options={eolOptions()}
                selected={eol(args()) ?? ''}
                autofocus={false}
                onChange={value => writeArgs(a => setEol(a, value))}
              />
            </Setting>
          </Show>

          <Show when={supportsAscii(format())}>
            <Setting name={lang.settingTab.asciiOnly} description={lang.settingTab.asciiOnlyDesc} class="ex-template-modal-ascii">
              <Toggle checked={ascii(args())} onChange={checked => writeArgs(a => setAscii(a, checked))} />
            </Setting>
          </Show>

          {/* Its own row rather than part of the card above: an EPUB collects
              footnotes as well, and writes no source anybody reads. */}
          <Show when={supportsReferenceLocation(format())}>
            <Setting
              name={lang.settingTab.referenceLocation}
              description={lang.settingTab.referenceLocationDesc}
              class="ex-template-modal-reference-location"
            >
              <DropDown
                options={referenceLocationOptions()}
                selected={referenceLocation(args()) ?? ''}
                autofocus={false}
                onChange={value => writeArgs(a => setReferenceLocation(a, value))}
              />
            </Setting>
          </Show>

          <Show when={isSlideOutput(format())}>
            <div class="ex-card ex-template-modal-slides">
              <Setting name={lang.settingTab.slides} description={lang.settingTab.slidesDesc} heading={true} />
              <Setting name={lang.settingTab.incremental} class="ex-template-modal-incremental">
                <Toggle checked={incremental(args())} onChange={checked => writeArgs(a => setIncremental(a, checked))} />
              </Setting>
              <Setting name={lang.settingTab.slideLevel} class="ex-template-modal-slide-level">
                <DropDown
                  options={slideLevelOptions()}
                  selected={slideLevel(args()) ?? ''}
                  autofocus={false}
                  onChange={value => writeArgs(a => setSlideLevel(a, value))}
                />
              </Setting>
            </div>
          </Show>

          <Show when={isEpubOutput(format())}>
            <div class="ex-card ex-template-modal-epub">
              <Setting name={lang.settingTab.epub} description={lang.settingTab.epubDesc} heading={true} />
              <Setting name={lang.settingTab.epubCoverImage}>
                <FileInput
                  value={epubCoverImage(args())}
                  filters={IMAGE_FILES}
                  tooltip={lang.settingTab.chooseFile}
                  onChange={value => writeArgs(a => setEpubCoverImage(a, value.trim()))}
                />
              </Setting>
              <Setting name={lang.settingTab.epubEmbedFont}>
                <FileInput
                  value={epubEmbedFont(args())}
                  filters={FONT_FILES}
                  tooltip={lang.settingTab.chooseFile}
                  onChange={value => writeArgs(a => setEpubEmbedFont(a, value.trim()))}
                />
              </Setting>
              <Setting name={lang.settingTab.epubTitlePage}>
                <Toggle checked={epubTitlePage(args())} onChange={checked => writeArgs(a => setEpubTitlePage(a, checked))} />
              </Setting>
              <Setting name={lang.settingTab.epubSubdirectory} description={lang.settingTab.epubSubdirectoryDesc}>
                <Text
                  value={epubSubdirectory(args()) ?? ''}
                  placeholder="EPUB"
                  onChange={value => writeArgs(a => setEpubSubdirectory(a, value))}
                />
              </Setting>
            </div>
          </Show>

          {/* Outside the card above, because chunked HTML splits on the same
              option and takes nothing else an EPUB does — under a heading
              naming EPUB it would be answering a question nobody asked it. */}
          <Show when={supportsSplitLevel(format())}>
            <Setting name={lang.settingTab.splitLevel} description={lang.settingTab.splitLevelDesc} class="ex-template-modal-split-level">
              <DropDown
                options={splitLevelOptions()}
                selected={splitLevel(args()) ?? ''}
                autofocus={false}
                onChange={value => writeArgs(a => setSplitLevel(a, value))}
              />
            </Setting>
          </Show>

          <Show when={supportsHtmlOptions(format())}>
            <div class="ex-card ex-template-modal-page">
              <Setting name={lang.settingTab.htmlPage} description={lang.settingTab.htmlPageDesc} heading={true} />

              {/* Read across both lines: the shipped Html template asks for
                  this in the arguments proper, and what is written here only
                  has to differ from what those already say. */}
              <Show when={supportsEmbedResources(format())}>
                <Setting name={lang.settingTab.embedResources} class="ex-template-modal-embed">
                  <Toggle
                    checked={embedResources(template()?.arguments, args())}
                    onChange={checked => writeArgs(a => setEmbedResources(a, checked, embedResources(template()?.arguments)))}
                  />
                </Setting>
              </Show>

              <Setting name={lang.settingTab.sectionDivs} class="ex-template-modal-section-divs">
                <Toggle checked={sectionDivs(args())} onChange={checked => writeArgs(a => setSectionDivs(a, checked))} />
              </Setting>

              <Setting name={lang.settingTab.emailObfuscation} class="ex-template-modal-obfuscation">
                <DropDown
                  options={obfuscationOptions()}
                  selected={emailObfuscation(args()) ?? ''}
                  autofocus={false}
                  onChange={value => writeArgs(a => setEmailObfuscation(a, value))}
                />
              </Setting>

              <Setting name={lang.settingTab.idPrefix} class="ex-template-modal-id-prefix">
                <Text value={idPrefix(args()) ?? ''} onChange={value => writeArgs(a => setIdPrefix(a, value.trim()))} />
              </Setting>
            </div>
          </Show>

          {/* Extracting the media is asked of every writer — it writes the
              files out whatever comes of the document — while the resolution
              only matters where the writer puts a real size on an image. */}
          <div class="ex-card ex-template-modal-media">
            <Setting name={lang.settingTab.media} description={lang.settingTab.mediaDesc} heading={true} />
            <Setting name={lang.settingTab.extractMedia} class="ex-template-modal-extract-media">
              <FileInput
                value={extractMedia(template()?.arguments, args())}
                folder={true}
                tooltip={lang.settingTab.chooseFolder}
                onChange={value => writeArgs(a => setExtractMedia(a, value.trim()))}
              />
            </Setting>
            <Show when={supportsDpi(format())}>
              <Setting name={lang.settingTab.dpi} class="ex-template-modal-dpi">
                <Text value={dpi(args()) ?? ''} placeholder="96" onChange={value => writeArgs(a => setDpi(a, value))} />
              </Setting>
            </Show>
          </div>

          {/* The list everything else is said in. There is no metadata field
              beside it: the fields of the document itself — title, author,
              date — are read from the exported note's own frontmatter.
              `visible` is the panel it sits in rather than the field: a
              textarea that has never been on screen has no height to measure
              itself against. */}
          <Setting name={lang.settingTab.variables} description={lang.settingTab.variablesDesc} class="ex-template-modal-variables">
            <TextArea
              class="ex-template-modal-pairs"
              autoSize={true}
              visible={advancedOpen()}
              value={otherVariables()}
              placeholder="fontfamily=libertinus"
              onChange={text => writeArgs(a => setVariables(a, pairsFromText(text), curatedVariables()))}
            />
          </Setting>
        </Section>

        {/*
         * The foot of the modal: what every row above it amounts to, and the only
         * place the whole line can be read.
         *
         * The command itself is shown rather than typed into: the rows above write
         * one part of it and the preset wrote another, and an edit here could not
         * be told apart from either.
         *
         * The field below it is a third part, kept in `userArguments` where no row
         * can reach it — anything pandoc takes that has no row above, written last
         * so it has the final word. It appears at the end of the command, which is
         * exactly where pandoc will read it.
         */}
        <Section
          name={lang.settingTab.resultingCommand}
          description={lang.settingTab.resultingCommandDesc}
          class="ex-template-modal-command-section"
          open={commandOpen()}
          onToggle={setCommandOpen}
        >
          {/* The two rows share a card, as a group inside the advanced panel
              does: what the command comes to and the one field that adds to it
              are the one subject, and the line between them is all it takes to
              say they are two answers rather than one. */}
          <div class="ex-card ex-template-modal-command-card">
            <Setting class="ex-template-modal-resulting-command ex-template-modal-nameless">
              {/* The copy sits over the field's own top right corner rather than
                  up in the heading: what it copies is what is on screen, so it
                  belongs to the field and not to the panel around it. */}
              <div class="ex-template-modal-command-preview">
                <TextArea
                  class="ex-template-modal-command-line"
                  autoSize={true}
                  visible={commandOpen()}
                  readOnly={true}
                  value={commandForReading()}
                />
                <ExtraButton icon="copy" tooltip={lang.settingTab.copyCommand} onClick={() => void copyCommand()} />
              </div>
            </Setting>

            <Setting
              name={lang.settingTab.userArguments}
              description={lang.settingTab.userArgumentsDesc}
              class="ex-template-modal-user-arguments"
            >
              <Text
                style="width: 100%"
                value={template()?.userArguments ?? ''}
                title={template()?.userArguments}
                placeholder="--defaults=my.yaml"
                onChange={value => updateTemplate(v => (v.userArguments = value.trim() || undefined))}
              />
            </Setting>
          </div>
        </Section>
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
              settingTab.resultingCommand,
              settingTab.extensions,
              settingTab.tableOfContents,
              settingTab.reading,
              settingTab.shiftHeadings,
              settingTab.tabStop,
              settingTab.stripComments,
              settingTab.math,
              settingTab.mathUrl,
              settingTab.syntaxDefinition,
              settingTab.lineEndings,
              settingTab.asciiOnly,
              settingTab.citations,
              settingTab.bibliography,
              settingTab.csl,
              settingTab.referenceDoc,
              settingTab.outputTemplate,
              settingTab.stylesheet,
              settingTab.includes,
              settingTab.pageSetup,
              settingTab.writtenSource,
              settingTab.wrap,
              settingTab.referenceLocation,
              settingTab.slides,
              settingTab.epub,
              settingTab.htmlPage,
              settingTab.embedResources,
              settingTab.media,
              settingTab.extractMedia,
              settingTab.variables,
              settingTab.userArguments,
              settingTab.targetFileExtensions,
              settingTab.showCommandOutput,
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
