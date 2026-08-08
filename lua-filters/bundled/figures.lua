-- figures.lua — standalone images get the right figure paragraph style
--
-- Captioned images (`![подпись](img.png)`) already arrive as a pandoc Figure
-- element, and the docx writer styles those correctly on its own:
-- "Captioned Figure" for the image, "Image Caption" for the caption. Only
-- captionless ones (`![](img.png)`) need help -- they arrive as a bare
-- Para [Image] and fall back to the default body-text style.
--
-- Why the traversal is topdown:
--   A Figure's body is itself a Plain [Image]. Lua filters run bottom-up by
--   default, so a plain `function Plain(el)` rewrites that *inner* block
--   before the Figure is ever seen, and the Div it inserts defeats the
--   writer's figure handling -- the captioned image silently drops from
--   "Captioned Figure" to "Compact". Going topdown lets us reach the Figure
--   first and refuse to descend into it.
--
-- Requires a paragraph style named "Figure" in the reference doc.
--
-- Configure with metadata (default shown):
--   figure-style: "Figure"

local style = 'Figure'

local function only_image(el)
  return #el.content == 1 and el.content[1].t == 'Image'
end

local function as_figure(el)
  if not only_image(el) then return nil end
  -- Always rebuild as a Para, never keep a Plain: the writer hardcodes
  -- "Compact" for a Plain inside a list, and that beats the Div's style, so a
  -- bare image as a list item would keep the body-text look. A Para is left
  -- overridable.
  -- The `false` stops the topdown walk from re-entering the Div we just
  -- built, which would otherwise match this same Para forever.
  return pandoc.Div(pandoc.Para(el.content),
    pandoc.Attr('', {}, { { 'custom-style', style } })), false
end

return {
  {
    Meta = function(meta)
      if meta['figure-style'] then
        style = pandoc.utils.stringify(meta['figure-style'])
      end
      return meta
    end
  },
  {
    traverse = 'topdown',
    -- Leave captioned figures completely alone, contents included.
    Figure = function() return nil, false end,
    Para = as_figure,
    Plain = as_figure, -- images inside tight lists arrive as Plain
  },
}
