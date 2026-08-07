-- table-spacing.lua
function Table(el)
  -- 240 твипов = 12 пунктов (стандартный отступ)
  local xml = [[
    <w:p>
      <w:pPr>
        <w:spacing w:before="240" w:after="0"/>
        <w:rPr>
          <w:sz w:val="2"/>
          <w:szCs w:val="2"/>
        </w:rPr>
      </w:pPr>
    </w:p>
  ]]
  
  -- Создаем сырой блок OpenXML
  local spacer = pandoc.RawBlock('openxml', xml)
  
  -- Возвращаем: отступ -> сама таблица -> отступ
  return {spacer, el, spacer}
end