import { Show } from 'solid-js';
import { t } from '../lang/helpers';
import type { EngineMode } from '../engine';
import Button from './components/Button';
import Icon from './components/Icon';
import { DropDown } from './components/Setting';

/**
 * The two settings the card is read for: where the installed pandoc is, and when the wasm build stands in for it —
 * a half each, under the pandoc they belong to.
 */
export default (props: {
  /** Whether the installed pandoc is the one exports go to — a phone has no folder to point at. */
  showFolder?: boolean;
  path?: string;
  onPathChange?: (path: string) => void;
  onChoosePath?: () => void;
  mode?: EngineMode;
  onModeChange: (mode: EngineMode) => void;
}) => {
  const modes = [
    { name: t.WASM_ENGINE_AUTO, value: 'auto' },
    { name: t.WASM_ENGINE_WASM, value: 'wasm' },
  ];

  return (
    <div class="ex-pandoc-panel-row">
      <Show when={props.showFolder}>
        <div class="ex-pandoc-folder">
          <Button class="ex-action" tooltip={props.path || t.PANDOC_PATH_PLACEHOLDER} onClick={props.onChoosePath}>
            <Icon name="folder" />
            {t.PANDOC_FOLDER}
          </Button>

          {/* The dialog cannot pick "nothing", so clearing needs its own control. */}
          <Show when={props.path}>
            <Button class="ex-action is-icon" tooltip={t.PANDOC_PATH_RESET} onClick={() => props.onPathChange?.('')}>
              <Icon name="rotate-ccw" />
            </Button>
          </Show>
        </div>
      </Show>

      {/* Asked whether or not the build is installed: it is the answer that says what to install for. Anything the
          settings hold that is not `wasm` is the one place a phone can end up anyway. */}
      <div class="ex-pandoc-mode">
        <div class="ex-pandoc-mode-label">{t.WASM_ENGINE}</div>
        <DropDown
          options={modes}
          selected={props.mode === 'wasm' ? 'wasm' : 'auto'}
          autofocus={false}
          onChange={(v: EngineMode) => props.onModeChange(v)}
        />
      </div>
    </div>
  );
};
