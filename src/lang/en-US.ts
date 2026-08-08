import { strTpl } from '../utils';

export default {
  exportToOo: 'Export to...',
  exportSuccessNotice: strTpl`Export file ${0} success!`,
  exportCommandOutputMessage: strTpl`Command: ${0}`,
  exportWithPrevious: 'Export with Previous',
  pleaseOpenFile: 'Please open a file first.',
  preparing: strTpl`generating "${0}"...`,
  exportDialog: {
    exportTo: 'Export location',
    /* The name only. What it is written as is the template's, so the extension
       is said beside the field rather than typed into it. */
    fileName: 'Enter the file name',
    fileNameDesc: strTpl`Will be written as ${0}`,
    title: strTpl`Pandoc GUI export`,
    export: 'Export',
    selectExportFolder: 'Please select an export folder.',
    overwriteConfirmation: 'Overwrite confirmation',
    type: 'Select export template',
  },
  /*
   * The box a failed export ends in. It says which template was run and which
   * file was being written, then the error itself — the command line is left
   * out, since it is a screenful of options the template already holds and none
   * of it is what went wrong.
   */
  exportError: {
    title: 'Export failed',
    template: 'Template',
    file: 'File',
    /* A command can fail silently — a wrong exit code and nothing on stderr. */
    noOutput: 'The command failed without reporting anything. Check the command in the template.',

    /* One suggestion per error the plugin can recognise, said as the next thing
       to try rather than as a diagnosis. */
    hint: {
      fileInUse: 'The file may be open in another program — a PDF viewer, Word, or a preview pane. Close it and export again.',
      outputFolder: 'The export folder could not be written to. Pick a folder that exists, or create it first.',
      pdfEngine:
        'The PDF engine is not installed. Install a LaTeX distribution (MiKTeX or TeX Live), or choose another engine under Advanced in the template.',
      pandocNotFound: 'Pandoc could not be run. Install it, or set the Pandoc folder in this plugin’s settings.',
      latexUnicode: 'pdfLaTeX cannot write these characters. Switch the template’s PDF engine to XeLaTeX or LuaLaTeX under Advanced.',
      latexPackage: 'A LaTeX package is missing. Install it with your TeX distribution’s package manager, then export again.',
      luaFilter: 'A Lua filter failed. Check what it needs in its readme, or remove it from the template’s Lua filters.',
      missingDataFile:
        'A file the template points at could not be read. Check the paths under Advanced — layout template, reference document, stylesheet.',
      missingResource: 'An image or attachment the note links to could not be found. Check that the file is still in the vault.',
      frontMatter: 'The note’s frontmatter could not be read. Check the YAML block at the top of the note.',
      citations: 'The bibliography or citation style could not be used. Check those files under Citations in the template.',
      unknownOption: 'Pandoc did not recognise one of the options. Check “Options of your own” in the template.',
    },
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
    name: 'Template name',
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
    openExportedFile: 'Open exported file',
    pandocPath: 'Pandoc path',
    pandocPathPlaceholder: '(Auto Detect)',
    exportTemplates: 'Export templates',
    templateOutput: 'Output format',
    newTemplate: 'New template',
    noTemplates: 'No export templates yet.',
    removeTemplateConfirmation: strTpl`Delete the export template "${0}"? This cannot be undone.`,
    edit: 'Edit',
    save: 'Save',
    editCommandTemplate: 'Edit template',
    customLocation: 'Custom location',
    template: 'Template',
    command: 'Command',
    add: 'Add',
    remove: 'Remove',
    sameFolderWithCurrentFile: 'Same folder with current file',
    targetFileExtensions: 'Target file extensions',
    showCommandOutput: 'Show command output',
    new: 'New',

    /* The panel at the foot of the template editor: the whole command as it will
       be run, shown to be read rather than edited. The `${...}` are filled in at
       export from the note and the chosen output folder, so they are shown as
       they stand rather than guessed at here. */
    resultingCommand: 'Resulting command',
    resultingCommandDesc: 'Everything above, as it is handed to pandoc. ${…} are filled in when a note is exported.',
    copyCommand: 'Copy command',
    commandCopied: 'Command copied.',
    commandCopyFailed: 'Could not copy the command.',

    /* The one field at the foot of that panel: options with no row of their own,
       kept in a field of their own so no row can rewrite them. */
    userArguments: 'Options of your own',
    userArgumentsDesc: 'Anything pandoc takes that has no row above. Written at the end of the command, so it has the last word.',

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

    /* Writes `--toc --toc-depth=N` into the template's extra arguments. Depth is
       one number rather than a set of levels, so it is asked for as one: a
       track from no contents at all down to the deepest heading pandoc reaches. */
    tableOfContents: 'Table of contents',
    tableOfContentsDesc: 'Headings down to the level chosen, and every level above it.',
    tocLevel: strTpl`Level ${0}`,
    tocNone: 'None',

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

    /* Read on the way in, before any writer sees the note, so these are asked of
       every format. */
    reading: 'Reading the note',
    readingDesc: 'What pandoc makes of the note itself, whatever it goes on to write.',
    shiftHeadings: 'Shift heading levels',
    shiftHeadingsDesc: 'Where the note’s headings land in the written document. Promoting a lone top heading makes it the title.',
    shiftHeadingsNone: 'Keep as written',
    shiftHeadingsDown: strTpl`${0} level deeper`,
    shiftHeadingsUp: strTpl`${0} level higher`,
    tabStop: 'Tab width',
    tabStopDesc: 'How many spaces a tab in the note stands for.',
    stripComments: 'Drop HTML comments',
    stripCommentsDesc: 'Leave <!-- … --> out of the written document rather than passing it through.',

    /* The three the plugin ships a filter for, all done to the note on the way
       in — so every writer answers to them. */
    embedNotes: 'Write in embedded notes',
    embedNotesDesc:
      'Replace ![[a note]] with what that note says, and ![[a note#heading]] with that section. Without this, pandoc reads an embedded note as a missing image.',

    today: 'Write today’s date for $today',
    todayDesc: 'Every $today in the note — body, headings, properties — becomes today’s date, in Obsidian’s language.',
    todayNone: 'Leave $today alone',

    keywords: 'Print the keywords property',
    keywordsDesc: 'Write the note’s keywords into the document itself, instead of leaving them in the file’s properties.',
    keywordsTitle: 'Keywords label',
    keywordsTitlePlaceholder: 'Keywords:',
    keywordsTitleDesc: 'What the line is labelled. Left empty, it reads “Keywords:”.',

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
    /* Only for the three methods that fetch something. */
    mathUrl: 'Script URL',
    mathUrlDesc: 'The build the page loads. Leave empty for the one pandoc names.',
    mathUrlPlaceholder: 'https://cdn.jsdelivr.net/npm/mathjax@3/es5/tex-mml-chtml.js',

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

    /* The rows that run a filter the plugin ships with, each undoing something
       pandoc's word-processor writers do that a reference document then cannot
       override. Every style named has to exist in that document. */
    wordStyles: 'Styles',
    wordStylesDesc: 'What the reference document gets to decide. Each of these is something pandoc otherwise settles for you.',

    figureStyle: 'Style images as figures',
    figureStyleDesc: 'Give an image with no caption a paragraph style of its own, instead of leaving it in body text.',
    figureStyleName: 'Figure style',
    styleNameDesc: 'The paragraph style to set, which the reference document has to hold.',

    tableStyle: 'Style text in table cells',
    tableStyleDesc: 'Stop pandoc stamping its own “Compact” style on every cell, which outranks the table style in Word.',
    tableStyleName: 'Cell style',
    tableHeadStyleName: 'Header cell style',
    tableHeadStyleDesc: 'Left empty, header cells take the same style as the rest.',
    tableHeadStylePlaceholder: 'Same as cells',

    listStyles: 'Use Word’s list styles',
    listStylesDesc: 'Let List Bullet and List Number draw the bullets and indents, instead of pandoc’s own numbering painting over them.',
    flattenOrdered: 'Numbered lists too',
    flattenOrderedDesc:
      'Exactly the style’s look, at the price of the one thing only pandoc’s numbering can do: separate lists no longer restart at 1.',

    /* The same question as the reference document, for the writers laid out by a
       template instead. No writer is asked both. */
    outputTemplate: 'Layout template',
    outputTemplateDesc: 'A pandoc template of your own, in place of the built-in one for this format.',

    syntaxDefinition: 'Syntax definition',
    syntaxDefinitionDesc: 'A KDE .xml file teaching the highlighter a language it does not know.',

    lineEndings: 'Line endings',
    lineEndingsDefault: 'Default (this platform’s)',
    lineEnding: {
      native: 'This platform’s',
      lf: 'LF (Unix, macOS)',
      crlf: 'CRLF (Windows)',
    },
    asciiOnly: 'ASCII only',
    asciiOnlyDesc: 'Escape everything outside ASCII — entities in HTML, commands in LaTeX.',

    epubSubdirectory: 'Contents folder',
    epubSubdirectoryDesc: 'The folder inside the EPUB the contents are put in. Pandoc’s own is EPUB.',

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

    /* Everything else, typed rather than picked. The document's own fields —
       title, author, date — are not asked for here: they are read from the
       exported note's frontmatter. */
    variables: 'Other variables',
    variablesDesc: 'One key=value a line, passed as -V. Read by the output template.',

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
