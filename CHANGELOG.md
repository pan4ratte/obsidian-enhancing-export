# Changelog


## Unreleased

### Live Zotero citations, written out in a style you choose

* A docx or odt template has a Zotero group of its own, after the lua-filter list: live Zotero fields, and the style they are written in.
* Live citations ship with the plugin now — `zotero.lua` is bundled rather than installed from the store, and leaves the catalogue.
* The template offers the citation styles installed in Zotero, and exports the citations already written out in one — still as live Zotero fields.
* The sources are read from a running Zotero, so citeproc renders them without a `.bib` file. New bundled filter: `zotero-references.lua`.
* Fixed: the style list named styles by their id instead of their title.
* Fixed: citations were rendered in en-US whatever the style — a Russian source came out as «Vol. 14. – P. 49», and a repeated citation as an empty footnote.
* The URL of a paginated article is left out, as Zotero itself leaves it out; `-M zotero-article-urls=true` keeps it.
* The exported document records the style it was written in, in Word as well as in LibreOffice, so Refresh does not reformat it.
* The bibliography is a live Zotero field too, in both formats, and a row switches it off for a footnote style that has no use for one.
* GOST and other CSL-M styles are exported through a copy without the per-language layouts, which pandoc refuses to read.
* A footnote style can set the note marker before the punctuation — «в работе[1].» — which is how Russian typography sets it, and is what a Russian style starts on.
* Fixed: an ampersand in a citation came out as `&amp;` in Word.
* Fixed: `--citeproc` is put where the Zotero filters need it, since pandoc renders citations where the flag stands among the filters.


## 1.2.2

### UI/UX enhancements and bug fixes

* An export runs behind a notice that names the file, shows a progress bar, and turns green when the file is written.
* The resulting command scrolls sideways instead of wrapping, so a line is an option and a long path no longer folds over several.
* On MacOS: Fixed a big, buttons, toggles and every other control answer clicks again when the settings open in a popout window.
* On MacOS: Fixed a big, file dialogs open on the window that asked for them.


## 1.2.1

### Hotfix

* Pandoc 3.7 and later are given `--syntax-highlighting`, so code highlighting no longer warns that `--no-highlight` is deprecated.
* A warning from Pandoc no longer reports the export as failed; the file is exported and the warning is shown as a notice.
* A hand-written `--syntax-highlighting` is no longer read as the syntax definition file.
* A template can be duplicated from its row in the templates table.
* Row actions fade in on the row under the pointer, each in its own colour.

---

Chagelog for the 1.2.0 release:

> * Fixed a bug when deleted default templates came back on restart.
> * Localized all lua-filters info in the store.
> * New, cleaner layout for lua-filters in the store.
> * Reordered some options in the template modal for better UX, plus tweaked UI.
> * Tooltips use Obsidian's own element style now.
> * Updated the environment variables editor UI.
> * Wording corrections in both locales.


## 1.2.0

### UI/UX enhancements and bug fixes

* Fixed a bug when deleted default templates came back on restart.
* Localized all lua-filters info in the store.
* New, cleaner layout for lua-filters in the store.
* Reordered some options in the template modal for better UX, plus tweaked UI.
* Tooltips use Obsidian's own element style now.
* Updated the environment variables editor UI.
* Wording corrections in both locales.


## 1.1.0

### UI/UX enhancements and bug fixes

* Fixed file dialogs on macOS. Every file/folder picker now opens attached to the Obsidian window, as a sheet. Unattached, macOS draws a free-floating panel that follows neither full screen nor the window's Space, so the dialog opened out of sight and the button that asked for it looked as though it had done nothing.
* Fixed the output file a command names. `-o` and `--output` are now read from the assembled command line directly, so `--output=path`, `-o"path"` and a short flag written as part of a cluster all name the file they say. Where a template and a hand-written argument both give one, the later wins, which is both what Pandoc does and what the command is assembled to expect.
* Smaller download, quicker load. Two dependencies the plugin used a fraction of were replaced with the part it needed.


## 1.0.0

### First release

* **Graphical export editor.** Every Pandoc option is a row in a settings dialog rather than a flag on a command line. Rows are shown only for the output formats that read them, so a template is never asked a question its writer would ignore.
* **Export templates.** Ready-made templates for Word, PDF, LaTeX, HTML, EPUB, Markdown and slide formats, each editable and duplicable. The resulting command line is shown at the foot of the editor and can be copied.
* **Lua filter store.** Browse, install and update Lua filters from a bundled catalogue, then switch them on per template. Filters that need no external program are marked as such before installation.
* **Obsidian-aware conversion.** Bundled filters resolve `![[embeds]]`, internal links, `$today`, and the keywords property, so a note exports as it reads in the vault.
* **Word and ODT styling.** Optional filters keep Pandoc from overriding a reference document's figure, table-cell and list styles.
* **Failure diagnostics.** A failed export reports the template, the target file, and a suggested next step for the errors the plugin recognises — a locked output file, a missing PDF engine, an absent LaTeX package, and others.
* **Pandoc dashboard.** Shows the detected Pandoc version, checks for updates, and links to the manual. The binary is auto-detected, or its folder can be set by hand.
