import { testConversion } from './common';

const stripWikilinks = { dir: 'pan4ratte', from: 'markdown+wikilinks_title_after_pipe' };

test('wikilinks go with the text inside them, embeds and outside links stay', async () => {
  await testConversion('strip-wikilinks', 'strip-wikilinks', stripWikilinks);
});

test('a vault writing markdown links has its .md and heading links stripped too', async () => {
  await testConversion('strip-wikilinks-markdown-links', 'strip-wikilinks', { ...stripWikilinks, from: 'markdown' });
});
