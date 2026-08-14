# Changelog


## 2.1.0

### New feature: PDF with Pandoc WASM, through Typst

* New template, “PDF (Typst)”: exports a PDF on any device, a phone included.
* Typst installs from the dashboard, separately from Pandoc WASM: about 36 MB with its fonts.
* Fonts: Libertinus, New Computer Modern and DejaVu ship with it; a vault folder can add more.
* LaTeX PDF templates and Beamer slides are still left out under WASM — they need a typesetter that cannot be run.

### Images by URL

* Images named by URL are fetched by the plugin and put into the document before the conversion starts, up to 64 per export.
* What could not be fetched is reported as a warning; the export goes on.


## 2.0.0

### Major update: Mobile devices support

This update introduces full mobile support for the plugin. Now you can export to almost every format and with almost every option into your vault as well as import (convert) files from other formats to Markdown. Pandoc WASM is an optional feature, and you can use it on mobile devices exclusively or on desktop too. The key advantage is that with WASM you don't need to install Pandoc locally at all — the key limitation is the WASM environment.

* **Install Pandoc WASM from the dasboard with one click.** Installation is optional and fully automatic, it imports Pandoc's official WebAssembly build. It is a single file that is stored in the plugin's folder: approximately 56 MB. If you sync your vault, Pandoc WASM will be available on all of your mobile and desktop devices. 
* **Pandoc WASM supports almost all features of regular Pandoc.** It cannod make PDF, runs no commands of your own and fetches nothing from the network; templates it cannot run are left out of the export dialog, and settings that mean nothing to it are hidden. Export and import on a phone write into the vault. All limitations are imposed by the platform.
* **New setting, “Use Pandoc WASM on this computer.”** When disabled, the local Pandoc does the conversion — when enabled, Pandoc WASM does. All mobile devices run the WASM as the only supported option.
* **New feature: User guide.** As the plugin grows, more features need an explanation. User guide will help with that. For example, all options that are not supported by the Pandoc WASM are listed there. The user guide opens with a command of from the plugin settings.

### UI/UX enhancements and bug fixes

* The dasboard was completely redesigned to fit new features. Note, that Pandoc WASM is updated separately from the regular one, but the update itsef is fully automatic for WASM specifically.
* The device compatibility is checked before anything is downloaded. A device that cannot run Pandoc WASM will be notified.


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
