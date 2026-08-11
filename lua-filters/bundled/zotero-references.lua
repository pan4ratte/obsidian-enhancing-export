--[==[
  zotero-references.lua — the sources behind the citekeys, read straight from Zotero.

  Asks a running Zotero (through Better BibTeX) for every citekey the note cites
  and writes them into the document's `references`, which is where `--citeproc`
  looks. Nothing has to be exported to a .bib file first, and the library stays
  the one place a source is described.

  Runs before `--citeproc`, and before `zotero.lua` where that turns the
  rendered citations into live Zotero fields.

  Metadata, shared with zotero.lua:
    zotero-client   zotero (default) or jurism
    zotero-library  the library to read, where it is not the personal one
]==]

local config = { client = 'zotero' }

local citekeys = {}

local function urlencode(str)
  return (str:gsub('[^%w]', function(chr)
    return string.format('%%%X', string.byte(chr))
  end))
end

local function port()
  return config.client == 'jurism' and 24119 or 23119
end

--- What Better BibTeX answers with, or nil and a reason it could not.
local function fetch(keys)
  local request = {
    jsonrpc = '2.0',
    method = 'item.pandoc_filter',
    params = { citekeys = keys, asCSL = true, style = config.csl_style or 'apa' },
  }
  if config.library then
    request.params.libraryID = config.library
  end

  local url = string.format('http://127.0.0.1:%d/better-bibtex/json-rpc?%s', port(), urlencode(pandoc.json.encode(request)))

  local fetched, _, body = pcall(pandoc.mediabag.fetch, url, '.')
  if not fetched then
    return nil, 'is ' .. config.client .. ' running, with Better BibTeX installed?'
  end

  local decoded, response = pcall(pandoc.json.decode, body)
  if not decoded then
    return nil, 'the answer was not JSON'
  end
  if response.error then
    return nil, response.error.message
  end
  return response.result
end

function Meta(meta)
  for key, value in pairs(meta) do
    local name = key:match('^zotero[-_](.*)')
    if name then
      config[name:gsub('-', '_')] = pandoc.utils.stringify(value)
    end
  end
  return nil
end

function Cite(cite)
  for _, item in pairs(cite.citations) do
    citekeys[item.id] = true
  end
  return nil
end

function Pandoc(doc)
  local keys = {}
  for key in pairs(citekeys) do
    keys[#keys + 1] = key
  end
  if #keys == 0 then
    return nil
  end

  local result, why = fetch(keys)
  if not result then
    io.stderr:write('zotero-references: could not read the library — ' .. why .. '\n')
    return nil
  end

  local items = {}
  for citekey, item in pairs(result.items or {}) do
    -- Better BibTeX's own bookkeeping, which is no part of a CSL record.
    item.custom = nil
    -- What the note cites it by, which is what citeproc matches against.
    item.id = citekey
    items[#items + 1] = item
  end

  for citekey, reason in pairs(result.errors or {}) do
    io.stderr:write('zotero-references: @' .. citekey .. (reason == 0 and ': not found' or ': more than one item') .. '\n')
  end

  if #items == 0 then
    return nil
  end

  -- Read as CSL JSON rather than built by hand: the reader is what turns a record into the metadata citeproc reads.
  local references = pandoc.read(pandoc.json.encode(items), 'csljson').meta.references
  if doc.meta.references then
    for _, reference in ipairs(references) do
      doc.meta.references:insert(reference)
    end
  else
    doc.meta.references = references
  end
  return doc
end

return {
  { Meta = Meta },
  { Cite = Cite },
  { Pandoc = Pandoc },
}
