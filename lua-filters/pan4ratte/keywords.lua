-- Injects the `keywords` metadata field into the document body.
-- The label text can be customized with the `keywords-title` field
-- (defaults to "Keywords:"). Keywords also remain in the file's
-- document properties.
function Pandoc(doc)
  local kw = doc.meta.keywords
  if not kw then return doc end

  local ptype     = pandoc.utils.type
  local stringify = pandoc.utils.stringify

  -- Convert a meta value into a flat list of inlines
  local function toInlines(v)
    if ptype(v) == "Inlines" then
      local out = {}
      for _, inl in ipairs(v) do table.insert(out, inl) end
      return out
    else
      return { pandoc.Str(stringify(v)) }
    end
  end

  -- Label: use `keywords-title` verbatim if present, else "Keywords:"
  local titleMeta = doc.meta["keywords-title"]
  local labelInlines = titleMeta and toInlines(titleMeta) or { pandoc.Str("Keywords:") }

  -- Normalize keywords to a list of items (handles `[a, b]` and `"a, b"`)
  local items = {}
  if ptype(kw) == "List" then
    for _, v in ipairs(kw) do table.insert(items, v) end
  else
    items = { kw }
  end

  local inlines = { pandoc.Strong(labelInlines), pandoc.Space() }
  for i, item in ipairs(items) do
    if i > 1 then
      table.insert(inlines, pandoc.Str(","))
      table.insert(inlines, pandoc.Space())
    end
    for _, inl in ipairs(toInlines(item)) do table.insert(inlines, inl) end
  end

  table.insert(doc.blocks, 1, pandoc.Para(inlines))
  return doc
end