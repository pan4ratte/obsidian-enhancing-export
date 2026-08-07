import type { Lang } from '../lang';
import Button from './components/Button';
import Icon from './components/Icon';

/**
 * The card above the templates table: the two things to do that are not about a
 * template already in it. Adding one used to ride in the table's header row,
 * where it read as part of the header rather than as an action of its own —
 * and left nowhere to put a second one.
 */
export default (props: { lang: Lang; onAdd?: () => void; onBrowseLuaFilters?: () => void }) => {
  const { lang } = props;
  return (
    <div class="ex-template-actions">
      <div class="ex-template-action">
        <Button class="ex-template-action-button" onClick={props.onAdd}>
          <Icon name="plus" />
          {lang.settingTab.newTemplate}
        </Button>
        <div class="ex-template-action-desc">{lang.settingTab.newTemplateDesc}</div>
      </div>

      <div class="ex-template-action">
        <Button class="ex-template-action-button" onClick={props.onBrowseLuaFilters}>
          <Icon name="store" />
          {lang.settingTab.browseLuaFilters}
        </Button>
        <div class="ex-template-action-desc">{lang.settingTab.browseLuaFiltersDesc}</div>
      </div>
    </div>
  );
};
