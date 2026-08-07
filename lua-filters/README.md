# Curated lua-filter catalogue

`index.json` is the catalogue the plugin's **Browse lua-filters** store reads under
its *Curated* chip. The store shows two sources side by side:

| Source | Where it comes from |
| --- | --- |
| **Curated** | This file. |
| **pandoc-ext** | The [pandoc-ext](https://github.com/pandoc-ext) organisation, read live from the GitHub API — one request returns every filter repository with its description and default branch, so there is no list to maintain here. |

Because pandoc-ext is read automatically, this catalogue exists for the filters it
does **not** carry. It is currently seeded with the ones from the retired
[pandoc/lua-filters](https://github.com/pandoc/lua-filters) collection that were
never re-published, so the two sources never offer the same filter twice.

The base URL is overridable per vault through the `luaFilterRepoUrl` setting, so a
vault can point the *Curated* chip at a catalogue of its own.

## Entry schema

```jsonc
{
  "filters": [
    {
      // Required. Unique within this catalogue, and what the installed record is
      // keyed by — changing it makes the entry a different filter.
      "id": "wordcount",

      // Required: one of "path" or "url".
      // "path" is resolved against this folder's URL; "url" may point anywhere
      // and wins if both are given.
      "path": "filters/wordcount.lua",
      "url": "https://raw.githubusercontent.com/…/wordcount.lua",

      // Shown on the card. "storeName" defaults to the id.
      "storeName": "Word count",
      "description": "Counts the words of a document as pandoc reads it.",
      "author": "pandoc/lua-filters",

      // ISO date, compared as a string against the installed copy's to offer an
      // update. Omit it and the filter simply never reports one.
      "updated": "2026-08-07",

      // What the filter is called in the plugin's lua/ folder. Defaults to
      // "<id>.lua". It is also the name the --lua-filter argument uses, so it
      // must be unique across everything installed.
      "fileName": "wordcount.lua",

      // Optional. Adds the card's "Open readme" button.
      "homepage": "https://github.com/pandoc/lua-filters/tree/master/wordcount"
    }
  ]
}
```

An entry with no `id`, or with neither `path` nor `url`, is skipped rather than
treated as an error — one malformed row cannot take the catalogue down with it.

## What installing does

The file is downloaded into the plugin's `lua/` folder next to the filters the
plugin ships with, and recorded in `data.json`. Two names are refused: one that
belongs to a bundled filter (it would be overwritten on the next start) and one
already taken by a different installed filter.

Installing does not run anything. A filter runs only once a template asks for it,
which is what the card's **Add to template…** dropdown does — it appends

```
--lua-filter="${luaDir}/<fileName>"
```

to that template's *Extra arguments*. Extra arguments, not the arguments proper:
those are rewritten wholesale whenever the template's output format changes, and
would take the filter with them.
