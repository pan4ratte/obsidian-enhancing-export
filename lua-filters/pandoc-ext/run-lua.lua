local function run_lua (cmd, constr)
  -- allow `=` as a shorthand for `return`.
  cmd = cmd:gsub('^%s*=', 'return ')
  local chunkfn, err = load(cmd)
  -- Try again if the return is missing
  if chunkfn == nil then
    chunkfn, err = load('return ' .. cmd)
    -- still getting an error. Bail out
    if chunkfn == nil then
      return constr(tostring(err))
    end
  end

  local success, result = pcall(chunkfn)

  if not success then
    return constr(tostring(result))
  end

  local elements
  success, elements = pcall(constr, result)
  return success
    and elements
    or select(2, pcall(tostring, result))
end

local function get_code (raw)
  if raw.format:match 'html' then
    return raw.text:match '^%<%?lua%s+(.*)%?%>'
  elseif raw.format:match 'run[-_]?lua' then
    return raw.text
  end
  return nil
end

return {
  {
    RawInline = function (raw)
      local code = get_code(raw)
      if code then
        return run_lua(code, pandoc.Inlines)
      end
    end,
    RawBlock = function (raw)
      local code = get_code(raw)
      if code then
        return run_lua(code, pandoc.Blocks)
      end
    end
  }
}
