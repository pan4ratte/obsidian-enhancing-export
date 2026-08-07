import type { Lang } from '../lang';
import Icon from './components/Icon';

/**
 * The card above the templates table: the two things to do that are not about a
 * template already in it. Adding one used to ride in the table's header row,
 * where it read as part of the header rather than as an action of its own —
 * and left nowhere to put a second one.
 *
 * The two are halves of one card rather than buttons sitting in it, so they
 * carry no chrome of their own — only the rule between them says where one ends
 * and the other begins. They stay `button` elements all the same: what is
 * reachable by tab and answers to a keypress is not a matter of styling.
 */
export default (props: { lang: Lang; onAdd?: () => void; onBrowseLuaFilters?: () => void }) => {
  const { lang } = props;
  return (
    <div class="ex-template-actions">
      <button class="ex-template-action" onClick={props.onBrowseLuaFilters}>
        <Icon name="store" />
        {lang.settingTab.browseLuaFilters}
      </button>

      <button class="ex-template-action" onClick={props.onAdd}>
        <Icon name="plus" />
        {lang.settingTab.newTemplate}
      </button>
    </div>
  );
};
