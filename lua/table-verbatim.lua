-- table-verbatim.lua
--
-- Applies the "Table Verbatim" character style to inline code inside tables,
-- so code spans in cells can be sized to match the table rather than the
-- body text.
--
-- Why it is written this way:
--   Pandoc honours the `custom-style` attribute only on Div and Span -- never
--   on Code. Setting el.attributes['custom-style'] on a Code element is
--   silently ignored, and wrapping the Code in a styled Span does not help
--   either: the docx writer hardcodes "VerbatimChar" for Code from inside the
--   Span's environment, so it still wins. The Code element has to be replaced
--   by a Span outright -- the same shape of problem as "Compact" in
--   table-styles.lua.
--
-- Requires a *character* style named "Table Verbatim" in the reference doc.
-- A paragraph style of that name cannot apply to a run and will be ignored.
--
-- Configure with metadata (default shown):
--   table-verbatim-style: "Table Verbatim"

local style = 'Table Verbatim'

function Meta(meta)
  if meta['table-verbatim-style'] then
    style = pandoc.utils.stringify(meta['table-verbatim-style'])
  end
  return meta
end

function Table(tbl)
  -- Only the word-processor writers understand custom-style; leave the AST
  -- alone elsewhere so HTML and friends keep real <code> elements.
  if not (FORMAT:match 'docx' or FORMAT:match 'odt') then
    return nil
  end
  return pandoc.walk_block(tbl, {
    Code = function(el)
      local classes = el.classes:clone()
      classes:insert('table-verbatim')
      return pandoc.Span(
        { pandoc.Str(el.text) },
        pandoc.Attr(el.identifier, classes, { { 'custom-style', style } })
      )
    end
  })
end

-- Metadata must be read before the tables are rewritten.
return {
  { Meta = Meta },
  { Table = Table },
}
