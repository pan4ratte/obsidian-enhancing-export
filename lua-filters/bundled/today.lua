--[[
  today.lua — writes today's date wherever the note says `$today`

  Works anywhere: in the body, in a heading, and in the note's own properties,
  which is where a title page usually wants it.

  The date itself is not this filter's business. It arrives already written, as
  `-M today=…`, because the plugin is the one that knows how to write it: it
  asks the system for the date in the language and the form the template names,
  and gets every language the machine has rather than the one or two anybody
  would think to hard-code into a filter. (This file used to come in an English
  edition and a Russian one, which is what a hard-coded month name costs.)

  Text and metadata are two different handlers. Pandoc reads a YAML field as
  markup, so `Str` reaches those; a value passed on the command line stays a
  plain string, which only `Meta` reaches.
]]

local PLACEHOLDER = '%$today'

local today = nil

--- Nothing at all until the plugin says what today is.
function Meta(meta)
  if meta.today then
    today = pandoc.utils.stringify(meta.today)
  end
  return meta
end

function Str(el)
  if today and el.text:find(PLACEHOLDER) then
    el.text = el.text:gsub(PLACEHOLDER, today)
    return el
  end
end

--- The note's own properties, which are read as markup and so are covered by
--- `Str` above, and the plain strings that are not.
local function substitute(value)
  if pandoc.utils.type(value) == 'Inlines' or pandoc.utils.type(value) == 'Blocks' then
    return value:walk { Str = Str }
  end
  if type(value) == 'string' then
    return (value:gsub(PLACEHOLDER, today))
  end
  return value
end

return {
  { Meta = Meta },
  {
    Meta = function(meta)
      if not today then
        return meta
      end
      for key, value in pairs(meta) do
        if key ~= 'today' then
          meta[key] = substitute(value)
        end
      end
      -- The field was this filter's way in, not the document's own: a template
      -- that writes its metadata out would otherwise print it.
      meta.today = nil
      return meta
    end,
  },
  { Str = Str },
}
