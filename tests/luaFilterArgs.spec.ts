import { addLuaFilterArg, hasLuaFilterArg, luaFilterArg, removeLuaFilterArg } from '../src/lua_filters';

/*
 * The flag carries `${luaDir}` as literal text — the export fills it in later.
 * Every character of `${...}` means something to a regular expression, so
 * taking a filter back out is the case most worth pinning down.
 */

const ARG = '--lua-filter="${luaDir}/wordcount.lua"';

test('the argument is the literal template variable, not an interpolation', () => {
  expect(luaFilterArg('wordcount.lua')).toBe(ARG);
});

test('adding to empty arguments yields just the flag', () => {
  expect(addLuaFilterArg(undefined, 'wordcount.lua')).toBe(ARG);
  expect(addLuaFilterArg('', 'wordcount.lua')).toBe(ARG);
  expect(addLuaFilterArg('   ', 'wordcount.lua')).toBe(ARG);
});

test('adding appends to arguments already there', () => {
  expect(addLuaFilterArg('--toc', 'wordcount.lua')).toBe(`--toc ${ARG}`);
});

test('adding the same filter twice changes nothing', () => {
  expect(addLuaFilterArg(ARG, 'wordcount.lua')).toBe(ARG);
  expect(addLuaFilterArg(`--toc ${ARG}`, 'wordcount.lua')).toBe(`--toc ${ARG}`);
});

test('removing takes the flag out and closes the gap', () => {
  expect(removeLuaFilterArg(`--toc ${ARG} --number-sections`, 'wordcount.lua')).toBe('--toc --number-sections');
  expect(removeLuaFilterArg(ARG, 'wordcount.lua')).toBe('');
  expect(removeLuaFilterArg(`--toc ${ARG}`, 'wordcount.lua')).toBe('--toc');
});

test('removing leaves other filters alone', () => {
  const other = luaFilterArg('spellcheck.lua');
  expect(removeLuaFilterArg(`${ARG} ${other}`, 'wordcount.lua')).toBe(other);
  expect(removeLuaFilterArg(`${ARG} ${other}`, 'spellcheck.lua')).toBe(ARG);
});

test('removing a filter that is not there changes nothing', () => {
  expect(removeLuaFilterArg('--toc', 'wordcount.lua')).toBe('--toc');
  expect(removeLuaFilterArg(undefined, 'wordcount.lua')).toBe('');
});

test('a file name is not read as a pattern', () => {
  // `+` and `.` are the characters a bundled filter's name actually contains.
  const tricky = luaFilterArg('markdown+hugo.lua');
  expect(hasLuaFilterArg(tricky, 'markdown+hugo.lua')).toBe(true);
  // Would match if `+` and `.` were left as regex operators.
  expect(hasLuaFilterArg(tricky, 'markdownXhugoXlua')).toBe(false);
  expect(removeLuaFilterArg(`--toc ${tricky}`, 'markdown+hugo.lua')).toBe('--toc');
  expect(removeLuaFilterArg(`--toc ${tricky}`, 'markdown-hugo.lua')).toBe(`--toc ${tricky}`);
});

test('hasLuaFilterArg reports what is and is not there', () => {
  expect(hasLuaFilterArg(undefined, 'wordcount.lua')).toBe(false);
  expect(hasLuaFilterArg('--toc', 'wordcount.lua')).toBe(false);
  expect(hasLuaFilterArg(`--toc ${ARG}`, 'wordcount.lua')).toBe(true);
  // A different filter whose name merely ends the same way.
  expect(hasLuaFilterArg(luaFilterArg('my-wordcount.lua'), 'wordcount.lua')).toBe(false);
});
