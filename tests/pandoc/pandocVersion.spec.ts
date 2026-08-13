import pandoc, { parsePandocVersion } from '../../src/pandoc/pandoc';

test('test get pandoc version', async () => {
  const out = await pandoc.getVersion();
  expect(out.compare('3.1.5')).toBe(1);
});

test('the renamed highlighting options are only used where pandoc knows them', () => {
  expect(pandoc.takesSyntaxHighlighting(parsePandocVersion('3.7'))).toBe(true);
  expect(pandoc.takesSyntaxHighlighting(parsePandocVersion('3.10.1'))).toBe(true);
  expect(pandoc.takesSyntaxHighlighting(parsePandocVersion('3.6.4'))).toBe(false);
  expect(pandoc.takesSyntaxHighlighting(parsePandocVersion('2.19'))).toBe(false);
  // Nothing answered: the old spelling, which every version takes.
  expect(pandoc.takesSyntaxHighlighting(null)).toBe(false);
});
