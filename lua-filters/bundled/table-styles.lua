-- table-styles.lua
--
-- Stops pandoc's docx/odt writer from stamping "Compact" (and "Body Text")
-- onto the paragraphs inside table cells, and applies a dedicated paragraph
-- style instead -- one that leaves typography to the table style.
--
-- Why this is needed:
--   The docx writer hardcodes the "Compact" paragraph style for every Plain
--   block that sits inside a table or a list, and "Body Text" for real Para
--   blocks in cells. In Word's formatting hierarchy a paragraph style outranks
--   a table style, so whatever "Compact" inherits (font, size, first-line
--   indent, justification) wins over the "Table" table style and its
--   conditional first-row formatting.
--
--   Wrapping cells in a custom-style Div is not enough on its own: the writer
--   applies "Compact" *inside* the Div's environment, so it still takes
--   priority. The Plain blocks have to become Para blocks first -- those the
--   writer leaves overridable.
--
-- Requires a paragraph style with the target name in the reference doc.
-- Keep that style free of font/size/bold settings so the table style governs
-- them; use it only for spacing, indent and alignment.
--
-- Configure with metadata (defaults shown):
--   table-text-style: "Table Text"     -- body cells
--   table-head-style: false            -- header cells; set to a style name
--                                         to style them separately
-- Usage: pandoc doc.md -o doc.docx --reference-doc=ref.docx \
--          --lua-filter=table-styles.lua

local body_style = 'Table Text'
local head_style = nil

function Meta(meta)
  if meta['table-text-style'] then
    body_style = pandoc.utils.stringify(meta['table-text-style'])
  end
  local h = meta['table-head-style']
  if h ~= nil then
    -- MetaBool arrives as a plain Lua boolean; `false` keeps header cells
    -- on the body style.
    if type(h) == 'boolean' then
      head_style = h and body_style or nil
    else
      head_style = pandoc.utils.stringify(h)
    end
  end
  return meta
end

-- Turn Plain into Para at any depth so the writer no longer forces "Compact".
local function unplain(blocks)
  return pandoc.Blocks(blocks):walk {
    Plain = function(p) return pandoc.Para(p.content) end
  }
end

local function restyle(rows, style)
  if not style then return end
  for _, row in ipairs(rows) do
    for _, cell in ipairs(row.cells) do
      local blocks = unplain(cell.contents)
      -- An empty cell still needs a paragraph: Word requires one per <w:tc>,
      -- and left to itself the writer emits a bare <w:p/> that falls back to
      -- docDefaults spacing, making the whole row taller than its neighbours.
      -- The empty Str is what keeps the Para from being dropped; it produces
      -- no run of its own.
      if #blocks == 0 then
        blocks = pandoc.Blocks { pandoc.Para { pandoc.Str '' } }
      end
      cell.contents = pandoc.Blocks {
        pandoc.Div(blocks, pandoc.Attr('', {}, { { 'custom-style', style } }))
      }
    end
  end
end

function Table(tbl)
  restyle(tbl.head.rows, head_style or body_style)
  for _, b in ipairs(tbl.bodies) do
    restyle(b.head, head_style or body_style)
    restyle(b.body, body_style)
  end
  restyle(tbl.foot.rows, body_style)
  return tbl
end

-- Metadata must be read before the tables are rewritten.
return {
  { Meta = Meta },
  { Table = Table },
}
