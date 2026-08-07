import { strTpl } from '../utils';

export default {
  exportToOo: 'Export to...',
  exportSuccessNotice: strTpl`Export file ${0} success!`,
  exportCommandOutputMessage: strTpl`Command: ${0}`,
  exportErrorOutputMessage: strTpl`Command: ${0}，Error:${1}`,
  exportWithPrevious: 'Export with Previous',
  pleaseOpenFile: 'Please open a file first.',
  preparing: strTpl`generating "${0}"...`,
  exportDialog: {
    exportTo: 'Export to',
    fileName: 'File Name',
    title: strTpl`Export to ${0}`,
    export: 'Export',
    selectExportFolder: 'Please select an export folder.',
    overwriteConfirmation: 'Overwrite confirmation',
    type: 'Type',
    extraArguments: 'Extra arguments',
  },
  messageBox: {
    yes: 'Yes',
    no: 'No',
    ok: 'Ok',
    cancel: 'Cancel',
  },
  overwriteConfirmationDialog: {
    replace: 'Replace',
    title: strTpl`"${0}" already exists. Do you want to replace it?`,
    message: strTpl`A file or folder with the same name already exists in the folder "${0}". Replacing it will overwrite its current contents.`,
  },
  settingTab: {
    name: 'Name',
    title: 'Export Settings',
    pandocVersion: strTpl`Pandoc version: ${0}`,
    pandocNotFound: 'Pandoc not found, please fill in the Pandoc file path, or add it to the system environment variables.',

    pandocDashboard: 'Pandoc dashboard',
    pandocNotInstalled: 'Not installed',
    pandocCheckingForUpdates: 'Checking for updates…',
    pandocUpToDate: 'Up to date',
    pandocUpdateAvailable: strTpl`Version ${0} is available`,
    pandocUpdateCheckFailed: 'Could not check for updates.',
    pandocUpgradeRequired: strTpl`This vault uses Markdown links, which require Pandoc ${0} or newer.`,
    pandocUpdate: 'Update',
    pandocChangelog: 'Changelog',
    pandocFolder: 'Pandoc folder',
    pandocPathReset: 'Reset to auto detect',
    pandocOpenManual: 'Open manual',

    defaults: 'Defaults',
    defaultFolderForExportedFile: 'Export destination',
    openExportedFileLocation: 'Open exported file location',
    ShowExportProgressBar: 'Show export progress bar',
    openExportedFile: 'Open exported file',
    pandocPath: 'Pandoc path',
    pandocPathPlaceholder: '(Auto Detect)',
    exportTemplates: 'Export templates',
    templateOutput: 'Output',
    newTemplate: 'New template',
    noTemplates: 'No export templates yet.',
    removeTemplateConfirmation: strTpl`Delete the export template "${0}"? This cannot be undone.`,
    edit: 'Edit',
    done: 'Done',
    editCommandTemplate: 'Edit template',
    customLocation: 'Custom location',
    template: 'Template',
    command: 'Command',
    add: 'Add',
    remove: 'Remove',
    sameFolderWithCurrentFile: 'Same folder with current file',
    targetFileExtensions: 'Target file extensions',
    showCommandOutput: 'Show command output',
    runCommand: 'Run command after export',
    extraArguments: 'Extra arguments',
    new: 'New',
    arguments: 'Arguments',

    environmentVariables: 'Environment Variables',

    /* The card above the templates table. */
    browseLuaFilters: 'Browse lua-filters',

    /* Writes `-f ${fromFormat}+extension` into the template's extra arguments.
       Every one offered is off in pandoc's markdown by default, so a cleared
       box means what pandoc does on its own. */
    extensions: 'Markdown extensions',
    extensionsDesc: 'Syntax pandoc does not read unless asked. Cleared is pandoc’s own behaviour.',
    extension: {
      alerts: 'Callouts (> [!note])',
      mark: 'Highlights (==text==)',
      hard_line_breaks: 'Keep single line breaks',
      lists_without_preceding_blankline: 'Lists with no blank line above',
      rebase_relative_paths: 'Paths relative to the note',
      emoji: 'Emoji shortcodes (:smile:)',
      autolink_bare_uris: 'Bare URLs as links',
      tex_math_single_backslash: 'Math in \\( \\) and \\[ \\]',
      east_asian_line_breaks: 'East Asian line breaks',
      short_subsuperscripts: 'Short sub/superscripts',
    },

    /* Writes `--toc --toc-depth=N` into the template's extra arguments. */
    tableOfContents: 'Table of contents',
    tableOfContentsDesc: 'Headings down to the deepest level ticked. Tick nothing for no contents.',
    tocLevel: strTpl`Level ${0}`,

    /* Running installed filters, from the template that runs them. */
    luaFilters: 'Lua filters',
    noLuaFiltersInstalled: 'No filters installed. Add some from Browse lua-filters.',
    noLuaFiltersForFormat: 'None of the installed filters are written for this output format.',
  },
  luaFilterStore: {
    title: 'Lua filters',
    searchPlaceholder: 'Search filters...',

    /* The chevrons at a cut-off edge of the chip row. */
    moreFilters: 'More filters',

    filterAll: 'All',
    filterInstalled: 'Installed',
    filterUpdatable: 'Update available',
    /* Filters that need no external program, no reference-document style and no
       other filter ahead of them — the ones that cannot fail an export for
       something that was never installed. */
    filterNoSetup: 'No setup needed',

    /* The shelves, named after what a user came to fix rather than after where
       the filter was published. */
    category: {
      structure: 'Structure',
      citations: 'Citations',
      figures: 'Figures & math',
      prose: 'Text & typography',
      word: 'Word & ODT',
      latex: 'LaTeX & PDF',
      tools: 'Tools',
      other: 'Other',
    },

    loading: 'Loading filters…',
    loadError: 'Could not load the filter catalogue.',
    retry: 'Retry',
    emptyCatalogue: 'The catalogue is empty.',
    noResults: 'No filters match your search.',
    noneInstalled: 'No filters installed yet.',

    byAuthor: strTpl`by ${0}`,
    byAuthorUnder: strTpl`by ${0} · ${1}`,
    /* Said before installing, so a missing program is not discovered as a
       failed export. */
    requires: strTpl`Needs: ${0}`,
    readme: 'Open readme',
    install: 'Install',
    installing: 'Installing…',
    update: 'Update',
    uninstall: 'Uninstall',
    installedNotice: strTpl`Installed "${0}".`,
    installFailed: strTpl`Install failed: ${0}`,
    uninstalledNotice: strTpl`Uninstalled "${0}".`,
    uninstallFailed: strTpl`Uninstall failed: ${0}`,

    /** Said on the cards, so it is clear where an installed filter is switched on. */
    installedHint: 'Installed. Add it to a template to run it.',
  },
};
