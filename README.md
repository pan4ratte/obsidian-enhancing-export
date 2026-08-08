# Pandoc GUI plugin

Export notes with Pandoc without writing a command line. Every option Pandoc offers for the format you are exporting to is an ordinary Obsidian setting — page size, PDF engine, table of contents, citations, Word styles — and the command it builds is shown to you before it runs. Templates for Word, PDF, LaTeX, HTML, EPUB, slides, Markdown and a dozen more formats come ready to use, Obsidian's own syntax survives the trip, and a store of lua filters covers the rest.


## Features

### 1. Every Pandoc option as a row

The template editor lays out what Pandoc can do for the chosen output format as ordinary settings: table of contents and its depth, section numbering, heading shifts, tab width, top-level divisions, PDF engine, syntax highlighting, maths rendering, paper size and fonts, footnote placement, slide levels, EPUB cover and split level, HTML resource embedding, line endings, include files. A row appears only for the formats whose writer would actually read it, so a Word template is never asked which slide level to break on.

At the foot of the editor sits the whole command as it will be handed to Pandoc, to be read rather than typed, with a button to copy it. Anything with no row of its own goes in a field of its own — *Options of your own* — written last, so it always has the final word.

### 2. Templates for the formats you export to

Word, OpenOffice, PDF, LaTeX (whole document or a fragment to paste into an existing project), HTML, EPUB, Beamer and reveal.js slides, PowerPoint, Markdown in CommonMark, GFM or Hugo flavours, Typst, TextBundle, RTF, MediaWiki, reStructuredText, Textile, OPML, plain text and a BibTeX bibliography of everything a note cites. Each one is a template you can copy, rename or rewrite, and *Custom* runs any command you like with the note's paths filled in.

Export from the command palette, from the file's context menu, or with **Export with previous**, which reuses the last template and folder without opening a dialog at all.

### 3. Obsidian's own syntax, exported as it reads

`![[Another note]]` is a transclusion, not a missing image: the plugin resolves the link — which only Obsidian can do — and writes that note's text into the document, a single `![[note#heading]]` section included. Attachments are found wherever your vault keeps them, including the per-note attachment folders Pandoc has no way to know about. `==Highlights==` survive, `$$…$$` blocks are put back together, and every `$today` in the note becomes today's date in Obsidian's own language. A *Markdown extensions* row switches on the rest of the syntax Pandoc will not read unless asked — callouts, emoji shortcodes, bare URLs, hard line breaks and more.

### 4. Word and ODT that obey your reference document

Point a template at a `.docx` or `.odt` of your own and its styles, fonts and page setup govern the export. Three rows then undo what Pandoc otherwise settles for you: captionless images get a paragraph style of their own instead of landing in body text, table cells stop being stamped with Pandoc's "Compact" style — which outranks the table style in Word — and Word's own *List Bullet* and *List Number* styles draw the bullets and indents, instead of Pandoc's direct formatting painting over them.

### 5. Citations from the vault you already keep

Give a template a bibliography — `.bib`, `.json`, `.yaml` or `.ris` — and a `.csl` style, and `[@citekey]` becomes a rendered citation with a bibliography at the end, in any output format. A Bibliography template exports just the entries a note cites, and the catalogue adds live Zotero citations, per-chapter bibliographies, several bibliographies at once, DOI lookups and citation intent.

### 6. A store of lua filters

A lua filter is a small script Pandoc runs over the document on its way out — it is how you get real page breaks in Word, diagrams from Mermaid code blocks, included notes, chemical formulas or sheet music. **Browse lua-filters** in the settings opens a store of thirty-odd of them, grouped by the problem they solve, each naming its author, its licence and anything it needs installed *before* you install it rather than after a failed export.

Every filter offered is committed in this repository and served from it: browsing is one request and installing is one more, nothing is read from the GitHub API or from anyone else's branch, and what you install is the file that was reviewed when it was vendored. Installing only puts the file in place — a filter runs when a template asks for it, in that template's *Lua filters* row.

### 7. Exports that fail out loud

A failed export ends in a box naming the template and the file, the error itself, and one suggestion said as the next thing to try: the PDF is open in a viewer, the PDF engine is not installed, pdfLaTeX cannot set these characters so switch to XeLaTeX, a LaTeX package is missing, an image the note links to has moved, the frontmatter will not parse, Pandoc did not recognise one of your own options.

### 8. Pandoc, watched over

The settings open on the installed Pandoc: its version, whether it is the newest release, and links to the update, the changelog and the manual. If your vault writes Markdown links rather than wikilinks and the installed Pandoc is too old to resolve them, it says so there rather than at export time.

---

**Every row in the template editor carries its own description, so what an option does is answered where you set it.**


## Installation

### First of all, install Pandoc

This plugin drives Pandoc; it does not contain it. Install Pandoc 3.1.9 or newer from [https://pandoc.org/installing.html](https://pandoc.org/installing.html) and either add it to your `PATH` or point the plugin at its folder in the settings. Exporting to PDF additionally needs a LaTeX distribution — MiKTeX or TeX Live — or one of Pandoc's other PDF engines.

### Option 1: Obsidian plugin store

1. In Obsidian settings open the tab "Community plugins" and click "Browse" button.

2. In the search bar type `Pandoc GUI`, click on the result, then "Install" and "Enable" buttons.

Alternatively, you can install the plugin by following the link to the community website: [https://community.obsidian.md/plugins/pandoc-gui](https://community.obsidian.md/plugins/pandoc-gui)

### Option 2: BRAT plugin

If you want to test beta-versions of the plugin or use previous versions, you can do that with `BRAT` plugin:

1. Install `BRAT` plugin from the official Obsidian plugin store.

2. In the `BRAT` settings, find the “Beta plugin list” section and click on the “Add beta plugin” button.

3. In the window that appears, paste the link to the `Pandoc GUI` plugin repository: [https://github.com/pan4ratte/obsidian-pandoc-gui](https://github.com/pan4ratte/obsidian-pandoc-gui)

4. Under “Select a version” choose the desired version and click the “Add plugin” button. The plugin will be automatically installed and will be ready to use.


## The lua-filter catalogue

Everything below is offered by **Browse lua-filters** in the plugin settings, and everything below is vendored in [`lua-filters/`](lua-filters/README.md) — where the entry schema, the provenance of each folder and the filters the plugin ships with are documented. A filter's name links to its own readme; the *Needs* column is what has to exist before it can do anything.

The catalogue currently offers:

**Structure**

| Filter | What it does | Needs |
| :--- | :---------- | :--- |
| [Abstract as a section](https://github.com/pandoc-ext/abstract-section) | Write the abstract as an ordinary "# Abstract" heading instead of squeezing it into the note's properties. The filter lifts that section into the metadata the templates read. | — |
| [Include other notes](https://github.com/pandoc-ext/include-files) | Splices whole notes into the document where you name them, so a thesis or a manual can stay a folder of small notes and still export as one file. | — |
| [Include code from files](https://github.com/pandoc/lua-filters/tree/master/include-code-files) | Fills an empty code block from a file on disk — all of it, or just a range of lines. Code samples in the note can never drift from the code they came from. | — |
| [Page breaks](https://github.com/pandoc-ext/pagebreak) | Turns a \\newpage or \\pagebreak line in the note into a real page break — in Word, ODT, LaTeX/PDF, EPUB and HTML alike, rather than in LaTeX only. | — |
| [Format-only content](https://github.com/pandoc/lua-filters/tree/master/not-in-format) | Keeps a block or a span out of the formats it was not written for, so one note can carry both the printed wording and the web wording. | — |
| [Tables written as lists](https://github.com/pandoc-ext/list-table) | Write a table as a nested list and have it come out as a table. Cells that hold a paragraph, a list or a code block stay editable in the note instead of becoming an unreadable pipe table. | — |
| [reveal.js code blocks](https://github.com/pandoc/lua-filters/tree/master/revealjs-codeblock) | Passes code-block attributes through to reveal.js, so a slide can highlight lines and step through them. | — |

**Citations**

| Filter | What it does | Needs |
| :--- | :---------- | :--- |
| [Zotero live citations](https://retorque.re/zotero-better-bibtex/exporting/) | Resolves Better BibTeX citekeys against a running Zotero, so citations and the bibliography come out right without exporting a .bib file first. | Zotero running, with the Better BibTeX add-on installed. |
| [DOI to citation](https://github.com/pandoc/lua-filters/tree/master/doi2cite) | Looks up every DOI you cite and writes the matching bibliography entry for you, so a reference needs nothing but its DOI. | An internet connection at export time. |
| [Several bibliographies](https://github.com/pandoc-ext/multibib) | Splits the references into separate lists — sources and software, primary and secondary — from one library, each printed where you put it. | — |
| [References per chapter](https://github.com/pandoc-ext/section-bibliographies) | Gives every chapter or section its own reference list instead of one long list at the end. | — |
| [Export the cited entries](https://github.com/pandoc/lua-filters/tree/master/bibexport) | Writes out a .bib file holding only the entries the document actually cites — what you hand in with a manuscript instead of your whole library. | The bibexport program, part of TeX Live. |
| [Citation intent (CiTO)](https://github.com/pandoc-ext/cito) | Lets a citation record why it is there — agrees with, extends, uses a method from — and can list the sources by that relation. | — |
| [Scholarly metadata](https://github.com/pandoc/lua-filters/tree/master/scholarly-metadata) | Rewrites authors and affiliations into the shape journal templates expect, so a list of names in the note's properties comes out as a proper author list. | — |
| [Author and affiliation block](https://github.com/pandoc/lua-filters/tree/master/author-info-blocks) | Prints the authors, their affiliations and the corresponding address as a formatted block under the title. | Runs after "Scholarly metadata" — add that filter first. |

**Figures & math**

| Filter | What it does | Needs |
| :--- | :---------- | :--- |
| [Diagrams from code blocks](https://github.com/pandoc-ext/diagram) | Draws the diagram a code block describes and puts the picture in the document: Mermaid, GraphViz/Dot, PlantUML, TikZ, Asymptote and more. | The tool for the diagrams you use (mermaid-cli, dot, plantuml, …) on the PATH. |
| [Math as SVG](https://github.com/pandoc/lua-filters/tree/master/math2svg) | Renders TeX formulas to SVG with MathJax, so the maths shows up wherever the file is opened — no MathJax, no fonts, no internet needed by the reader. | Node.js with mathjax-node-cli installed. |
| [Short figure captions](https://github.com/pandoc/lua-filters/tree/master/short-captions) | Gives a figure a short caption for the list of figures, separate from the long one printed underneath it. | LaTeX/PDF output. |
| [Short table captions](https://github.com/pandoc/lua-filters/tree/master/table-short-captions) | The same for tables: a short caption for the list of tables, and a way to keep a table out of that list altogether. | LaTeX/PDF output. |
| [Chemical formulas (mhchem)](https://github.com/pandoc/lua-filters/tree/master/mhchem) | Sets \\ce{} chemical equations and isotopes written in mhchem notation. | — |
| [Sheet music (LilyPond)](https://github.com/pandoc/lua-filters/tree/master/lilypond) | Engraves LilyPond notation written in the note and puts the score in the document as an image. | The lilypond program on the PATH. |

**Text & typography**

| Filter | What it does | Needs |
| :--- | :---------- | :--- |
| [Quotation marks by language](https://github.com/pandoc/lua-filters/tree/master/pandoc-quotes.lua) | Replaces plain " and ' with the marks the document's language actually uses — « » in French, „ “ in German, “ ” in English. | — |
| [First-line indent](https://github.com/pandoc/lua-filters/tree/master/first-line-indent) | Indents the first line of every paragraph the way books do, and leaves the paragraph that opens a section flush, as typographers set it. | — |
| [Fonts and alignment](https://github.com/pandoc-ext/fonts-and-alignment) | Sets the font, size, colour and alignment of a marked span or section, for the passages a template has no style for. | — |
| [Tidier URLs](https://github.com/pandoc-ext/pretty-urls) | Drops the https:// and the trailing slash from a bare link, so an address printed in the text reads as text. | — |

**Word & ODT**

| Filter | What it does | Needs |
| :--- | :---------- | :--- |
| [Code inside tables](https://github.com/pan4ratte/course-it-in-science/blob/main/Obsidian/Pandoc/filters/table-verbatim.lua) | Lets inline code in a table cell take its own character style, so it can be sized for the table instead of the body text. Pandoc hardcodes VerbatimChar there and ignores anything else. | A character style named "Table Verbatim" in the reference document. |
| [Space around tables](https://github.com/pan4ratte/course-it-in-science/blob/main/Obsidian/Pandoc/filters/table-spacing.lua) | Puts a thin spacer paragraph before and after every table, so tables do not sit flush against the text in Word. | — |
| [Word tracked changes](https://github.com/pandoc/lua-filters/tree/master/track-changes) | Decides what to do with the tracked changes in a .docx you are reading in: accept them, reject them, or keep both readings. | — |

**LaTeX & PDF**

| Filter | What it does | Needs |
| :--- | :---------- | :--- |
| [Highlighted code in PDF](https://github.com/pandoc/lua-filters/tree/master/minted) | Sets code blocks with LaTeX's minted package, which highlights far more languages, and better, than the plain verbatim pandoc falls back to. | Pygments installed, and LaTeX run with --shell-escape. |
| [Keep hyphenated words whole](https://github.com/pandoc/lua-filters/tree/master/latex-hyphen) | Stops LaTeX breaking a hyphenated word at its hyphen when it justifies a line — the fix for names and compounds split across lines. | — |
| [Letter (KOMA-Script)](https://github.com/pandoc/lua-filters/tree/master/scrlttr2) | Sets the note as a letter through KOMA-Script's scrlttr2 class, addressee and closing included. No longer maintained upstream. | A LaTeX installation with KOMA-Script. |

**Tools**

| Filter | What it does | Needs |
| :--- | :---------- | :--- |
| [Word count](https://github.com/pandoc/lua-filters/tree/master/wordcount) | Counts the words pandoc reads, not the characters the file holds — markup, properties and link targets left out. Prints the count instead of exporting. | — |
| [Spellcheck](https://github.com/pandoc/lua-filters/tree/master/spellcheck) | Lists the misspelled words of a note, reading the prose and skipping code, links and maths. Prints the list instead of exporting. | The aspell program on the PATH. |

Want to add a filter of your own? The folder's [readme](lua-filters/README.md) says what an entry carries and where the file goes; `npm run docs:catalogue` writes the tables above from it.


## Custom export commands

Choose the `Custom` template when adding a new one, and write whatever command you like — a Pandoc invocation the rows do not cover, or another program entirely. The variables below are filled in before it runs.

## Variables

You can use `${variables}` in a custom export command, their values are:

| Key                       | Value                                                        |
| ------------------------- | ------------------------------------------------------------ |
| `${outputPath}`           | Full path of the exported file. Exporting to `/User/aaa/Documents/test.pdf`, that is the whole of it. |
| `${outputDir}`            | Directory the exported file is saved in — `/User/aaa/Documents` in the case above. |
| `${outputFileName}`       | File name of the exported file without its extension — `test` above. |
| `${outputFileFullName}`   | File name of the exported file with its extension — `test.pdf` above. |
| `${currentPath}`          | Path of the note being exported. Editing `/User/aaa/Documents/readme.md`, that is the whole of it. |
| `${currentDir}`           | Directory of the note being exported — `/User/aaa/Documents` above. |
| `${currentFileName}`      | File name of the note without its extension — `readme` above. |
| `${currentFileFullName}`  | File name of the note with its extension — `readme.md` above. |
| `${vaultDir}`             | The vault's own directory. |
| `${attachmentFolderPath}` | Obsidian's `attachmentFolderPath`. |
| `${pluginDir}`            | This plugin's folder, for the resources it ships. |
| `${luaDir}`               | The plugin's `lua/` folder, where installed filters are written — what `--lua-filter` names. |
| `${embedDirs}`            | The folders of the files the note embeds, for `--resource-path`. |
| Other variables           | Write `keyword: value` in the note's [YAML front matter](https://jekyllrb.com/docs/front-matter/) and use it as `${metadata.keyword}`. |


# About the Author

My name is Mark Ingram (Ingrem), I am a Religious Studies scholar. Apart from my main area of study (Protestant Political Theology in Russia), I teach the subject "Information Technologies in Scientific Research", a unique course that I developed myself from scratch. This plugin helps me in my studies and I use it in my teaching, as well as other plugins that I develop and that you can find on [my GitHub profile](https://github.com/pan4ratte/).

Hello to every student that came across this page!

I also recommend my other plugins: [Advanced Word Count](https://community.obsidian.md/plugins/advanced-word-count), which counts words the way your publisher or your supervisor does rather than the way Obsidian does, and [Publish to Telegram](https://community.obsidian.md/plugins/publish-to-telegram), which posts notes straight to Telegram channels and chats.


## Credits

This plugin began as a fork of [Enhancing Export](https://github.com/mokeyish/obsidian-enhancing-export) by **YISH ([@mokeyish](https://github.com/mokeyish))**, whose work is what made exporting from Obsidian with Pandoc possible in the first place, and whose export engine still sits under everything above. It is used and redistributed here under the MIT licence, and the original copyright notice is kept in [LICENSE](LICENSE).

Thanks are also owed to:

- **[John MacFarlane](https://johnmacfarlane.net/) and the Pandoc contributors** for Pandoc itself, which does all of the actual converting.
- **The [pandoc-ext](https://github.com/pandoc-ext) organisation** and the retired **[pandoc/lua-filters](https://github.com/pandoc/lua-filters)** collection, whose filters the catalogue vendors — each entry names its author and its licence, and every vendored copy keeps its original headers.
- **[Better BibTeX](https://retorque.re/zotero-better-bibtex/)** for the Zotero filter the catalogue offers.

---

In compliance with the Obsidian community guidelines, all external network calls should be disclosed in the plugin README and only made with user knowledge. This plugin makes network calls to [api.github.com](https://api.github.com) — to look up the latest Pandoc release for the version check in the settings — and to [raw.githubusercontent.com](https://raw.githubusercontent.com), to read the lua-filter catalogue when you open the store and to download a filter when you install one. Nothing else is fetched, and none of your notes leave your machine: exporting runs Pandoc locally. Templates you configure yourself may of course reach the network on their own — the HTML template loads MathJax from a CDN so that maths renders in a browser, and some catalogue filters fetch what they need at export time, which each of them says in its *Needs*.
