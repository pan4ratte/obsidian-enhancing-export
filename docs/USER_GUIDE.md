This guide can be opened from the command palette by typing “Pandoc GUI: Open user guide”, or with the “User guide” button in the plugin settings.

## 1. Pandoc WASM limitations

Pandoc WASM works somewhat differently from the ordinary version because of how it is built. Before exporting with it, mind these limits:

* **PDF through Typst only.** The “PDF (Typst)” template works everywhere, a phone included: Pandoc writes Typst source, and Typst sets the PDF from it. That needs Typst installed from the plugin settings, separately from Pandoc WASM. The ordinary “PDF” template is set with LaTeX, which Pandoc WASM cannot start: templates like it are left out of the export dialog, as are Beamer slides.
* **LaTeX (.tex) templates do not work with Typst.** Typst is a different typesetting program with a language of its own: `--template=neurips.tex`, `-V geometry` and raw LaTeX (`\newpage`, `tikzpicture`) do not reach a Typst PDF. Maths, tables, images, the table of contents and citations work as they always did.
* **Typst has to be handed its fonts.** It cannot see the system's: Libertinus, New Computer Modern and DejaVu are installed with it, which covers Latin and Cyrillic. For CJK, emoji, or a font of your own named in `-V mainfont`, point the settings at a folder of fonts in the vault.
* **No templates that run a command of your own.**
* **Lua filters only.** Ordinary Pandoc takes filters of other kinds, Python among them; WASM does not. The good news: every filter in the plugin's store is a lua filter.

What else to keep in mind:

* The file takes about 56 MB in the plugin folder. If you sync your vault between devices, the WASM file is synced along with it. Typst and its fonts are about 36 MB more, and only if you install it.
* Images named by URL are fetched by the plugin before the conversion starts and put into the document: Pandoc WASM itself never reaches the network. Up to 64 of them per export, and only what is written as an image — an ordinary link stays a link.
* WASM needs a recent phone: iOS 18.4 or newer, or an up-to-date Android WebView.
* Templates Pandoc WASM cannot run are left out of the export dialog.

### Options Pandoc WASM does not support

A supported template can still hold options Pandoc WASM does not support: they are left out of the export, and the export dialog says so beforehand.

Options you will be warned about:

* `--filter` — filters that are programs, which there is nothing to run. Lua filters (`--lua-filter`) work, and every filter in the plugin's store is one.
* `--defaults` — a Pandoc defaults file.
* `--sandbox`, `--fail-if-warnings`.
* Any option the plugin does not know, including deprecated ones such as `--atx-headers` and `--epub-chapter-level`.

Options that simply do nothing, and are not warned about because they change no result:

* `--pdf-engine`, `--pdf-engine-opt` — a PDF is always set with the Typst build that comes with the plugin.
* `--request-header`, `--no-check-certificate` — the plugin reaches the network, not Pandoc.
* `--data-dir`, `--log`, `--verbose`, `--quiet`, `--trace`, `--dump-args` — there are no system folders and no console to send them to.

## 2. Custom export commands

Choose `Custom` when creating an export template, and write whatever command you like — a Pandoc invocation the setting rows do not cover, or another program entirely. The variables below are filled in before it runs.

### Variables

You can use `${variables}` in your export command, their values are:

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

### What can go inside `${...}`

Besides a variable name, `${...}` takes a small set of expressions — enough to let an option appear in the command only when it is wanted:

| Written | What it does |
| ------- | ------------ |
| `${metadata.keyword}`, `${today.iso}` | Field access; `${options["key"]}` is the same thing in brackets. |
| `` ${ x ? `--opt="${x}"` : `` } `` | A condition. Nested template literals work inside the branches. |
| `${x ?? "default"}`, `${x \|\| "fallback"}`, `${x && "…"}`, `${!x}` | Defaults and logic. |
| `${fmt === "pdf" ? "…" : "…"}` | Comparison: `===`, `!==`, `==`, `!=`. |

A name that is not among the variables stays in the command as written: `${user}` prints as `${user}`, so a typo shows up in the *Resulting command* line.
