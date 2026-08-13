import { t } from '../lang/helpers';
import Icon from './components/Icon';

/** The card above the templates table: the actions that are not about a template already in it. */
export default (props: { onAdd?: () => void; onBrowseLuaFilters?: () => void }) => (
  <div class="ex-actions-card">
    <button class="ex-action" onClick={props.onBrowseLuaFilters}>
      <Icon name="store" />
      {t.ACTION_BROWSE_FILTERS}
    </button>

    <button class="ex-action" onClick={props.onAdd}>
      <Icon name="plus" />
      {t.ACTION_NEW_TEMPLATE}
    </button>
  </div>
);
