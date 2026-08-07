-- today-date-ru.lua — подставляет сегодняшнюю дату вместо `$today`
--
-- Работает в любом месте документа: в тексте заметки, в заголовках и в полях
-- метаданных (свойствах файла в Obsidian). Формат — `12 декабря 2026 г.`.
-- Английский вариант — в today-date.lua.
--
-- Подстановкой в тексте и в метаданных занимаются два разных обработчика:
-- поля YAML pandoc разбирает как разметку (MetaInlines), поэтому их покрывает
-- Str, — а вот значения, переданные через `-M ключ=значение`, остаются простыми
-- строками, до которых Str не доходит. Их и добирает Meta.

local months_ru = {
  "января", "февраля", "марта", "апреля", "мая", "июня",
  "июля", "августа", "сентября", "октября", "ноября", "декабря"
}

local function get_russian_date()
  local t = os.date("*t")
  return string.format("%d %s %d г.", t.day, months_ru[t.month], t.year)
end

-- Текст заметки, заголовки и текстовые поля метаданных
function Str(el)
  if el.text:find("%$today") then
    return pandoc.Str(el.text:gsub("%$today", get_russian_date()))
  end
end

-- Метаданные-строки: в pandoc 3 это обычные строки Lua, в pandoc 2 — MetaString
function Meta(m)
  local russian_date = get_russian_date()
  for key, val in pairs(m) do
    local text = nil
    if type(val) == "string" then
      text = val
    elseif type(val) == "table" and val.t == "MetaString" then
      text = val.text
    end
    if text and text:find("%$today") then
      m[key] = text:gsub("%$today", russian_date)
    end
  end
  return m
end
