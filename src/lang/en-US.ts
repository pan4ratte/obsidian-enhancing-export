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

    /* The one folded panel in the template editor: everything the format allows
       but few templates change. */
    advanced: 'Advanced',

    /* Writes `--toc --toc-depth=N` into the template's extra arguments. */
    tableOfContents: 'Table of contents',
    tableOfContentsDesc: 'Headings down to the deepest level ticked. Tick nothing for no contents.',
    tocLevel: strTpl`Level ${0}`,

    /* The rest of the writer options, written into the same field. Every row
       here is shown only for the formats that would do something with it, so a
       template that cannot be asked is never asked. */
    numbering: 'Numbering and lists',
    numberingDesc: 'Section numbers, and the lists that go with a table of contents.',
    numberSections: 'Number headings',
    listOfFigures: 'List of figures',
    listOfTables: 'List of tables',
    numberOffset: 'Start numbering at',
    numberOffsetDesc: 'The number before the first heading — 5 to start at 6. One per level, separated by commas.',

    topLevelDivision: 'Top-level headings',
    topLevelDivisionDesc: 'What a level-1 heading becomes in the written document.',
    division: {
      default: 'Default',
      section: 'Section',
      chapter: 'Chapter',
      part: 'Part',
    },

    syntaxHighlighting: 'Code highlighting',
    syntaxHighlightingDesc: 'The colours for fenced code blocks.',
    highlightDefault: 'Default (Pygments)',
    highlightNone: 'None',
    highlightStyle: {
      pygments: 'Pygments',
      tango: 'Tango',
      espresso: 'Espresso',
      zenburn: 'Zenburn',
      kate: 'Kate',
      monochrome: 'Monochrome',
      breezedark: 'Breeze Dark',
      haddock: 'Haddock',
    },

    math: 'Math rendering',
    mathDesc: 'How TeX math is written into the page.',
    mathDefault: 'Default (plain text)',
    mathMethod: {
      mathjax: 'MathJax',
      katex: 'KaTeX',
      mathml: 'MathML',
      webtex: 'WebTeX (images)',
      gladtex: 'GladTeX',
    },

    pdfEngine: 'PDF engine',
    pdfEngineDesc: 'The program that turns the document into a PDF. XeLaTeX and LuaLaTeX handle system fonts and non-Latin scripts.',
    pdfEngineDefault: 'Default (pdfLaTeX)',

    /* Citations. Citeproc is a filter over the document rather than a writer
       option, so every output format can be asked for it. */
    citations: 'Citations',
    citationsDesc: 'Replace [@citekey] with a rendered citation and add a bibliography.',
    bibliography: 'References',
    bibliographyDesc: 'The file the references are read from — .bib, .json, .yaml or .ris.',
    csl: 'Citation style',
    cslDesc: 'A .csl file saying how citations and the bibliography are written. Pandoc’s own is Chicago author-date.',

    /* Written into the same field, each shown only where its writer reads it. */
    referenceDoc: 'Reference document',
    referenceDocDesc: 'A document of your own to take styles, fonts and page setup from.',

    stylesheet: 'Stylesheet',
    stylesheetDesc: 'A CSS file the written page links to.',

    includes: 'Include files',
    includesDesc: 'Files copied into the document as they stand — a LaTeX preamble, a script, a footer.',
    includeInHeader: 'In the header',
    includeBeforeBody: 'Before the body',
    includeAfterBody: 'After the body',

    /* The template variables asked for by name. Each row is shown only for the
       writers measured to read that variable. */
    pageSetup: 'Page and fonts',
    pageSetupDesc: 'What the output template is told about the page it is laying out.',
    variableName: {
      papersize: 'Paper size',
      fontsize: 'Font size',
      mainfont: 'Main font',
      geometry: 'Page geometry',
      linkcolor: 'Link colour',
      lang: 'Language',
    },
    variablePlaceholder: {
      papersize: 'Default',
      fontsize: 'Default',
      mainfont: 'e.g. PT Serif',
      geometry: 'e.g. margin=1in',
      linkcolor: 'e.g. blue',
      lang: 'e.g. en-GB',
    },
    variableDefault: 'Default',

    /* The format-specific groups, each shown only when the writer matches. */
    writtenSource: 'Written source',
    writtenSourceDesc: 'How the file itself is laid out, as against how it reads once rendered.',
    wrap: 'Line wrapping',
    wrapDefault: 'Default (wrap at a column)',
    wrapMode: {
      none: 'None — a paragraph a line',
      preserve: 'As written in the note',
    },
    columns: 'Wrap at column',
    markdownHeadings: 'Heading style',
    markdownHeadingsDefault: 'Default (ATX, # Heading)',
    markdownHeadingSetext: 'Setext (underlined)',
    referenceLinks: 'Reference-style links',
    referenceLocation: 'Footnotes',
    referenceLocationDesc: 'Where footnotes are collected in the written document.',
    referenceLocationDefault: 'Default (after the block)',
    referenceLocationOption: {
      section: 'End of each section',
      document: 'End of the document',
    },

    slides: 'Slides',
    slidesDesc: 'How the document is cut into slides, and what a slide shows at first.',
    incremental: 'Reveal lists one item at a time',
    slideLevel: 'New slide at level',
    slideLevelDefault: 'Default (worked out from the document)',
    slideLevelNone: 'Never — only a rule starts a slide',

    epub: 'EPUB',
    epubDesc: 'The parts of an EPUB that are not part of the document.',
    epubCoverImage: 'Cover image',
    epubEmbedFont: 'Embedded font',
    epubTitlePage: 'Title page',
    splitLevel: 'New file at level',
    splitLevelDesc: 'The heading level that starts a new chapter file.',
    splitLevelDefault: 'Default (level 1)',

    htmlPage: 'Page',
    htmlPageDesc: 'What the written page carries, and what it says about itself.',
    embedResources: 'Embed images, styles and scripts',
    sectionDivs: 'Wrap each section in a div',
    emailObfuscation: 'Email addresses',
    emailObfuscationDefault: 'Default (as written)',
    emailObfuscationMethod: {
      none: 'As written',
      javascript: 'Hidden behind a script',
      references: 'Hidden as character references',
    },
    idPrefix: 'Identifier prefix',

    media: 'Media',
    mediaDesc: 'The images the note carries, and what the writer makes of them.',
    extractMedia: 'Extract images to',
    chooseFolder: 'Choose folder',
    dpi: 'Pixels per inch',

    /* Everything else, typed rather than picked. */
    variables: 'Other variables',
    variablesDesc: 'One key=value a line, passed as -V. Read by the output template.',
    metadata: 'Metadata',
    metadataDesc: 'One key=value a line, passed as -M. Fields of the document itself — title, author, date.',

    chooseFile: 'Choose file',

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
