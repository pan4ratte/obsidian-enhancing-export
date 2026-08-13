import type { App } from 'obsidian';
import { t } from '../../lang/helpers';
import pandoc from '../../pandoc/pandoc';
import { openExternal } from '../../system/platform';
import Icon from '../components/Icon';
import { UserGuideModal } from '../user_guide';

/** What is read rather than set: Pandoc's own pages, which belong to neither engine, and the plugin's guide. */
export default (props: { app: App }) => (
  <div class="ex-pandoc-panel-row ex-pandoc-links">
    <button class="ex-action" onClick={() => openExternal(pandoc.manualUrl)}>
      <Icon name="book-marked" />
      {t.PANDOC_MANUAL}
    </button>

    <button class="ex-action" onClick={() => openExternal(pandoc.latestReleaseUrl)}>
      <Icon name="scroll-text" />
      {t.PANDOC_CHANGELOG}
    </button>

    <button class="ex-action" onClick={() => new UserGuideModal(props.app).open()}>
      <Icon name="book-open" />
      {t.USER_GUIDE}
    </button>
  </div>
);
