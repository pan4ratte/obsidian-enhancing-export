# Contributing to Pandoc GUI

Thank you for wanting to work on this plugin. Bug reports, export templates,
lua filters for the catalogue and pull requests are all welcome, and this file
says what you need to know before opening one.

The shortest useful contributions are usually not code: a failing export with
the *Resulting command* from the template editor and the text of the error box
pasted into an issue tells us almost everything.

## Getting set up

1. **Node.js** — version 24 or newer, as in CI.
   [https://nodejs.org/en/download](https://nodejs.org/en/download)

2. **Pandoc** — the plugin drives it and part of the test suite runs it, so it
   has to be on your `PATH`. Version 3.1.9 or newer.
   [https://pandoc.org/installing.html](https://pandoc.org/installing.html)

3. **The repository**

   ```shell
   git clone https://github.com/pan4ratte/obsidian-pandoc-gui.git
   cd obsidian-pandoc-gui
   npm ci
   ```

## A note on `package-lock.json`

Regenerate it on Linux only — under WSL on a Windows machine, using a native
`node`, not the one `/mnt/c` interop puts on `PATH`. `npm install` on Windows
resolves two fewer entries, dropping top-level `@emnapi/core` and
`@emnapi/runtime`: optional transitive deps of the native `@unrs/resolver`
binding. `npm ci` then fails on Linux with "package.json and package-lock.json
are not in sync", and npm's suggested remedy is a trap — re-running
`npm install` on Windows silently restores the broken lockfile.

It is invisible locally: install, lint, tests and build all pass on Windows
with the short lockfile. CI checks for the two entries before installing.

## Running it in a vault

The repository folder is itself a loadable plugin folder: `manifest.json` and
`styles.css` are committed at the root, and the build writes `main.js` beside
them. So the quickest setup is to clone into a test vault's
`.obsidian/plugins/` and build in place.

```shell
npm run dev      # rebuild on every change
npm run build    # one production build
```

To keep the sources elsewhere and build into a vault instead, add `.env.local`
at the project root:

```shell
# build straight into an obsidian plugin folder
OUT_DIR="path/to/.obsidian/plugins/pandoc-gui"
```

When `OUT_DIR` points somewhere else, `manifest.json` and `styles.css` are
copied along with `main.js`. When it does not — the default — only `main.js` is
written, because copying those two onto themselves would fail.

**`styles.css` is a source file, not build output.** It is edited by hand and
committed; nothing generates it, and a build never overwrites it.

Obsidian reloads a plugin when its folder changes if you have the
[Hot Reload](https://github.com/pjeby/hot-reload) plugin installed, which is
worth having for `npm run dev`.

To see the plugin's own debug output — and to keep a plugin that throws while
loading from failing quietly on each reload — open DevTools with `Ctrl+Shift+I`
(or `F12`) and run this once in the Console tab:

```shell
localStorage.setItem('debug-plugin', '1')
```

More debugging tips:
[How to debug TypeScript in Chrome](https://blog.logrocket.com/how-to-debug-typescript-chrome/)

## The checks

Everything below runs in CI on every pull request, and all of it is quick:

```shell
npm run typecheck             # tsc --noEmit
npm run lint                  # eslint, including the obsidianmd plugin rules
npm run format-check          # prettier over src/ and tests/
npm run docs:catalogue:check  # the lua-filter catalogue is generated, not hand-edited
npm test                      # jest
```

`npm run lint-fix` and `npm run format-fix` apply what the first two can fix on
their own. Anything else `package.json`'s `scripts` offers is fair game too.

## What lives where

| Path | What is in it |
| --- | --- |
| `src/` | The plugin. `main.ts` is the entry point; `exporto0o.ts` runs an export; `pandoc.ts` finds and questions the installed Pandoc. |
| `src/export_templates.ts` | The templates the plugin ships with. |
| `src/writer_args.ts`, `filter_args.ts`, `toc_args.ts` | The template editor's rows, read out of and written back into a template's arguments. |
| `src/pandoc_format.ts` | What each output format is and which rows it can answer — the format families a row and a filter are narrowed by. |
| `src/lua_filters.ts` | The store: reading the catalogue, installing, uninstalling, and the `--lua-filter` argument a template runs one through. |
| `src/ui/` | The settings tab, the export dialog and the filter store, in Solid. |
| `src/lang/` | Every string the user sees. `en.ts` is the type every other locale satisfies; `ru.ts` is the Russian one. |
| `lua-filters/` | The filters: `bundled/` is what the plugin ships, the rest is the store's catalogue. See its [readme](lua-filters/README.md). |
| `textemplate/` | LaTeX templates embedded into the build alongside the bundled filters. |
| `scripts/` | `gen-catalogue.js`, which writes the catalogue table in the readme. |
| `tests/` | Jest specs. Some shell out to the real Pandoc. |
| `styles.css` | The stylesheet, edited by hand. |

## Adding an export template

Add an entry to `src/export_templates.ts`. A template is a name, a `type`, the
arguments Pandoc is given and the extension the file is written with; the
comments at the top of that file explain the variables the arguments may use and
why the shared fragments exist. Templates the plugin ships are merged into a
vault's saved settings on load — a user's edits to one are stored as the
difference from the default, so renaming a shipped template retires it rather
than updating it.

Please export something real with a new template before proposing it.

## Adding a row to the template editor

A row is three things: the argument it reads and writes (in `writer_args.ts`,
or `filter_args.ts` for the rows that run a bundled filter), the formats it is
shown for (`pandoc_format.ts`), and its strings (`src/lang/en.ts`). Rows are
offered only to the writers that would do something with them, so a row with no
format restriction should genuinely apply everywhere.

Two rules the editor depends on: a row never writes into *Extra commands*,
which belongs to the user, and a row's argument must survive a round trip —
written into a template, read back out, and shown as the same value.

## Adding a lua filter to the catalogue

The catalogue lives in `lua-filters/`, and its [readme](lua-filters/README.md)
is the reference: what an entry carries, which folder the file goes in, and why
every filter offered is vendored in this repository rather than fetched from
wherever it was published.

In short: commit the `.lua` file unmodified under the folder for where it came
from, add its entry to `lua-filters/index.json` — leaving `fileName` out, since
it is derived from `path` — then run

```shell
npm run docs:catalogue
npm test
```

The first normalises your entry and rewrites the catalogue table in the
project's readme; that table is generated between two fixed prose lines and
should never be edited by hand. Include both changed files in the pull request,
or CI's `docs:catalogue:check` will fail.

Only add filters whose licence permits redistribution, and keep the original
licence header in the file. Every entry has to name its author and licence.

## Translations

`src/lang/en.ts` is the shape every other locale must satisfy — `ru.ts` is one,
and a new one is a file beside them, exporting the same keys, registered in the
`localeMap` of `src/lang/helpers.ts`. Nothing user-visible should be written as
a literal outside that folder.

## Pull requests

- One subject per pull request; a rename, a refactor and a fix are three.
- Run the checks above before pushing.
- Say what you exported to test it — the format, and the platform you are on.
  Word, PDF and LaTeX exports depend on things (a reference document, a TeX
  distribution) that CI does not have.
- Keep the existing style: comments explain *why* something is the way it is,
  not what the next line does. Prettier settles everything else.
- New behaviour that can be tested without Pandoc should come with a spec.

## Reporting a bug

Include the plugin version, your platform, the Pandoc version shown in the
settings, the template you exported with, the *Resulting command* copied from
the foot of the template editor, and what the error box said. An export that
fails only for one note is worth attaching that note to, reduced to the part
that still fails.
