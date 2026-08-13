import { t } from '../lang/helpers';
import pandoc from '../pandoc';
import { openExternal } from '../platform';
import Icon from './components/Icon';

/** Pandoc's own pages, which belong to neither engine in particular. */
export default () => (
  <div class="ex-pandoc-panel-row">
    <button class="ex-action" onClick={() => openExternal(pandoc.manualUrl)}>
      <Icon name="book-open" />
      {t.PANDOC_MANUAL}
    </button>

    <button class="ex-action" onClick={() => openExternal(pandoc.latestReleaseUrl)}>
      <Icon name="scroll-text" />
      {t.PANDOC_CHANGELOG}
    </button>
  </div>
);
