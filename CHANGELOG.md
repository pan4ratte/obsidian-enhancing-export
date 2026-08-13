# Changelog


## Unreleased

### New feature: User guide

* New command, “Open user guide”, and a button for it in the settings.
* The guide ships with the plugin and opens in Obsidian: what Pandoc WASM cannot do, custom export commands and the variables they take.
* Written in the vault's language, English where there is no translation.

### New feature: Pandoc on a phone and a tablet

* The plugin runs on mobile. Exporting, importing, the template editor and the lua-filter store all work there.
* New card in the settings: “Pandoc WASM” installs Pandoc's official WebAssembly build with one press — downloaded, unpacked and put in place by the plugin.
* New setting, “Use Pandoc WASM on this computer”: off, and the installed Pandoc converts; on, and the built-in build does. A phone runs the built-in build either way.
* The built-in Pandoc makes no PDF, runs no commands of your own and fetches nothing from the network; templates it cannot run are left out of the export dialog, and settings that mean nothing to it are hidden.
* Export and import on a phone write into the vault, and its folders are suggested as you type.
* The device is checked before anything is downloaded, and on a desktop the wasm feature the build needs is switched on where Obsidian's Chromium still keeps it behind a flag. A device that cannot run it is told so by the binary itself rather than by a guess.
* The export dialog names the options the built-in Pandoc cannot do before the export, and the button asks to export anyway. Nothing is dropped in silence.
* The dialog says so when it can run none of your templates, rather than reading as though you had written none.
* The templates table marks the ones the built-in Pandoc will not run, and the ones it will run without some of their options.
* `--natbib` and `--biblatex` are read by the built-in Pandoc, as `--citeproc` already was.
* A newer built-in Pandoc is noticed at startup and said once, rather than only in the settings.
* The settings open with one card holding everything about Pandoc: the installed one on the left of every row, the WebAssembly one on the right. Version and status first, with the update beside the line that reports it, then the pages to read — the user guide, Pandoc's manual and its changelog.
* “Pandoc folder” and “Use Pandoc WASM” are the first two rows of the general settings, where the rest of the answers are.
* A narrow settings pane stacks the two Pandocs into one column and breaks the button rows over two or three lines.
* A phone is not shown the installed Pandoc at all: no “Pandoc not found”, no engine choice, and nothing is looked up for a program that cannot be there. A desktop emulating a phone is shown the same settings, and goes on exporting with the Pandoc it really has.
* A template the built-in Pandoc will not run says so without pointing at an installed Pandoc that a phone cannot have.
* On a phone, a tap on a template row opens its editor and the pencil is dropped.
* On a phone and a tablet the row actions are always shown, there being no pointer to reveal them with.
* The lua-filter store and new-template buttons stack into a column where the card is too narrow for both.
* The wasm check is made once per session instead of on every ask, and says whether the flag was set when it fails.
* A device that will not run the built-in Pandoc reads “Unsupported” beside the status dot, rather than leaving it alone.
* Checkboxes in a narrow pane are the size of a checkbox again, instead of stretching across the column and hiding the name beside them.
* A phone being emulated says the built-in Pandoc cannot be switched on because there is no node to do it with, rather than blaming the device.
* A group's heading is drawn as a heading again — it had been losing the class that says so and wearing the box every row in a modal wears.
* Extensions are ticked off one to a line on a phone, where two columns cut their names in half.


## 1.3.0

### New feature: Import document and convert it to Markdown

* New command: “Import a file and convert it to a note”. The dialog asks for the flavour of Markdown, the file, and the destination folder, suggesting the vault's folders as you type.
* The default choice is GitHub Flavored Markdown — the flavour closest to Obsidian's own, maths included.
* Different formats support different settings: tracked changes, extracted images, document details, shifted headings, tab width, stripped comments, wrapping, heading style and reference links.


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
