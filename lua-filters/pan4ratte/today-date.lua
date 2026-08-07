-- today-date.lua — подставляет сегодняшнюю дату вместо `$today`
--
-- Работает в любом месте документа: в тексте заметки, в заголовках и в полях
-- метаданных (свойствах файла в Obsidian). Формат — `December 12, 2026`.
-- Русский вариант — в today-date-ru.lua.
--
-- Подстановкой в тексте и в метаданных занимаются два разных обработчика:
-- поля YAML pandoc разбирает как разметку (MetaInlines), поэтому их покрывает
-- Str, — а вот значения, переданные через `-M ключ=значение`, остаются простыми
-- строками, до которых Str не доходит. Их и добирает Meta.

local function get_date()
  return os.date("%B %d, %Y")
end

-- Текст заметки, заголовки и текстовые поля метаданных
function Str(el)
  if el.text:find("%$today") then
    return pandoc.Str(el.text:gsub("%$today", get_date()))
  end
end

-- Метаданные-строки: в pandoc 3 это обычные строки Lua, в pandoc 2 — MetaString
function Meta(m)
  local current_date = get_date()
  for key, val in pairs(m) do
    local text = nil
    if type(val) == "string" then
      text = val
    elseif type(val) == "table" and val.t == "MetaString" then
      text = val.text
    end
    if text and text:find("%$today") then
      m[key] = text:gsub("%$today", current_date)
    end
  end
  return m
end
