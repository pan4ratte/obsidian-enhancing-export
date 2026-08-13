import { convert, testConversion } from '../common';

const stripWikilinks = { dir: 'pan4ratte', from: 'markdown+wikilinks_title_after_pipe' };

test('wikilinks go with the text inside them, outside links stay', async () => {
  await testConversion('strip-wikilinks', 'strip-wikilinks', stripWikilinks);
});

test('a vault writing markdown links has its .md and heading links stripped too', async () => {
  await testConversion('strip-wikilinks-markdown-links', 'strip-wikilinks', { ...stripWikilinks, from: 'markdown' });
});

// Not a fixture: newer pandoc marks an embed with a class and older pandoc with a title, so its native form is not the
// same text on every version. What must hold on all of them is that it is still there and still an image.
test('an embed survives, links do not', async () => {
  const out = await convert('strip-wikilinks-embeds', 'strip-wikilinks', stripWikilinks);
  expect(out.match(/Image/g)).toHaveLength(2);
  expect(out).not.toMatch(/Link/);
  expect(out).toMatch(/Str "beside"/);
});
