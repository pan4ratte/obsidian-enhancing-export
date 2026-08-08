--[[
  list-styles.lua  —  pandoc Markdown -> docx

  Makes your Word list styles (List Bullet / List Number, all levels) actually
  drive the on-screen look of lists, instead of pandoc's "Compact" style and its
  own injected list numbering.

  ---------------------------------------------------------------------------
  THE PROBLEM THIS SOLVES
  ---------------------------------------------------------------------------
  Pandoc draws bullets/numbers with its OWN numbering (a direct <w:numPr> on
  each paragraph) and layers a paragraph style on top. That direct numbering
  carries its own indentation and bullet glyph, and in Word direct formatting
  beats the style. Result: the Styles pane shows "List Bullet" selected, but the
  paragraph is painted from pandoc's numbering — the style only "snaps in" when
  you click it (which re-applies the style's list and discards the direct one).

  FIX: for bullet lists, drop pandoc's numbering entirely and emit each item as
  a paragraph carrying only your List Bullet (N) style, whose OWN list definition
  then supplies the bullet + indent. Nothing overrides the style, so it renders
  correctly on load with no clicking.

  ---------------------------------------------------------------------------
  NUMBERED LISTS: ONE UNAVOIDABLE TRADE-OFF  (see FLATTEN_ORDERED below)
  ---------------------------------------------------------------------------
  Automatic "restart at 1" for each separate numbered list REQUIRES pandoc's
  per-list numbering. Driving numbers purely from the List Number style (the way
  we do bullets) means separate numbered lists keep counting up (…3, then 4, 5).
  You cannot have both from a filter alone, so numbered lists get a switch:

    FLATTEN_ORDERED = false  (default)
        Numbered lists stay real auto-numbered lists -> they RESTART correctly.
        They still get your List Number styles for font/spacing. (Their indent
        comes from pandoc's numbering; align it in your style if it matters.)

    FLATTEN_ORDERED = true
        Numbered lists are style-driven too -> exact List Number look, applied
        on load with no clicking, BUT separate lists no longer restart at 1.

  Bullets are always style-driven either way (they have no restart concept).

  ---------------------------------------------------------------------------
  REQUIREMENTS
  ---------------------------------------------------------------------------
  * Run with  --reference-doc=your-reference.docx
  * That reference must define paragraph styles named exactly as in the two
    tables below, AND (crucially) each must carry its own list numbering — i.e.
    a <w:numPr> in the style. Word's genuine built-in "List Bullet"/"List Number"
    styles do. If a style has no numbering of its own, its bullet/number will be
    blank; give the style a list format in Word, or fall back to FLATTEN_ORDERED
    handling. Names, not style IDs, must match.
  * pandoc 2.x or 3.x.

  Handles tight & loose lists, nesting to any depth (mapped to the leveled
  styles, clamped to the deepest one), mixed bullet/number nesting, and lists
  inside block quotes / callouts.
]]

-- ===== configuration =======================================================
-- Set from the template editor, which writes `-M list-flatten-ordered=true`.
-- See the trade-off above: it is a choice between numbered lists that restart
-- at 1 and numbered lists that look exactly like the style says.
local FLATTEN_ORDERED = false

local BULLET_STYLES = {
  "List Bullet", "List Bullet 2", "List Bullet 3",
  "List Bullet 4", "List Bullet 5", "List Bullet 6",
}
local NUMBER_STYLES = {
  "List Number", "List Number 2", "List Number 3",
  "List Number 4", "List Number 5", "List Number 6",
}
-- ===========================================================================

local function pick(styles, level)
  return styles[math.min(level, #styles)]
end

-- Wrap a single item paragraph so pandoc applies the given style to it.
local function styled(block, styles, level)
  if block.t == "Plain" then block = pandoc.Para(block.content) end
  return pandoc.Div(block, { ["custom-style"] = pick(styles, level) })
end

local render_list, transform_blocks

-- Process the blocks of one list item at `level`.
-- `force_native`: once we are inside a list we keep native (numbered, default
-- mode), every descendant must also stay native, otherwise flattened bullet
-- paragraphs would be spliced loose into a numbered item and corrupt its
-- numbering. So the flag propagates downward.
local function render_item(item, styles, level, force_native)
  local out = {}
  for _, b in ipairs(item) do
    if b.t == "Para" or b.t == "Plain" then
      out[#out + 1] = styled(b, styles, level)
    elseif b.t == "BulletList" then
      for _, x in ipairs(render_list(b, false, level + 1, force_native)) do out[#out + 1] = x end
    elseif b.t == "OrderedList" then
      for _, x in ipairs(render_list(b, true, level + 1, force_native)) do out[#out + 1] = x end
    elseif b.t == "BlockQuote" or b.t == "Div" then
      b.content = transform_blocks(b.content, level + 1)
      out[#out + 1] = b
    else
      out[#out + 1] = b
    end
  end
  return out
end

-- Returns a list (array) of blocks: either flattened styled paragraphs, or a
-- single native list element wrapped in a one-item array, so callers can splice
-- the result uniformly.
render_list = function(el, is_ordered, level, force_native)
  local styles = is_ordered and NUMBER_STYLES or BULLET_STYLES
  local keep_native = force_native or (is_ordered and not FLATTEN_ORDERED)
  if keep_native then
    for i, item in ipairs(el.content) do
      el.content[i] = render_item(item, styles, level, true)
    end
    return { el }
  else
    local acc = {}
    for _, item in ipairs(el.content) do
      for _, b in ipairs(render_item(item, styles, level, false)) do acc[#acc + 1] = b end
    end
    return acc
  end
end

-- Walk a block sequence that is NOT inside a list item, styling any lists found.
transform_blocks = function(blocks, base)
  base = base or 1
  local out = {}
  for _, b in ipairs(blocks) do
    if b.t == "BulletList" then
      for _, x in ipairs(render_list(b, false, base, false)) do out[#out + 1] = x end
    elseif b.t == "OrderedList" then
      for _, x in ipairs(render_list(b, true, base, false)) do out[#out + 1] = x end
    elseif b.t == "BlockQuote" or b.t == "Div" then
      b.content = transform_blocks(b.content, base)
      out[#out + 1] = b
    else
      out[#out + 1] = b
    end
  end
  return out
end

function Pandoc(doc)
  -- Read before the lists are rewritten: `Meta` in this same pass would run
  -- after `Pandoc`, which is too late to change how they are rewritten.
  local flatten = doc.meta['list-flatten-ordered']
  if flatten ~= nil then
    FLATTEN_ORDERED = flatten == true or pandoc.utils.stringify(flatten) == 'true'
  end
  doc.blocks = transform_blocks(doc.blocks, 1)
  return doc
end