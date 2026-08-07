import { For, JSX, createContext, createEffect, on, onCleanup, onMount, useContext } from 'solid-js';
import * as Ob from 'obsidian';

type SettingContext = {
  settingEl: HTMLDivElement;
};

const Context = createContext<SettingContext>();

const useSetting = () => useContext(Context);

export default (props: {
  name?: string;
  description?: string;
  class?: string;
  heading?: boolean;
  disabled?: boolean;
  noInfo?: boolean;
  children?: JSX.Element;
}) => {
  const context: SettingContext = {
    settingEl: null,
  };
  return (
    <>
      <Context.Provider value={context}>
        <div
          ref={el => (context.settingEl = el)}
          class={`setting-item ${props.class ?? ''}`.trimEnd()}
          classList={{
            'setting-item-heading': props.heading,
            'is-disable': props.disabled,
          }}
        >
          <div class="setting-item-info">
            <div class="setting-item-name">{props.name}</div>
            <div class="setting-item-description">{props.description}</div>
          </div>
          <div class="setting-item-control">{props.children}</div>
        </div>
      </Context.Provider>
    </>
  );
};

export const Toggle = (props: { checked?: boolean; onChange?: (checked: boolean) => void }) => {
  const setting = useSetting();
  onMount(() => {
    setting.settingEl.addClass('mod-toggle');
  });
  onCleanup(() => {
    setting.settingEl.removeClass('mod-toggle');
  });
  return (
    <>
      <div
        class="checkbox-container"
        classList={{ 'is-enabled': props.checked }}
        onClick={() => props.onChange && props.onChange(!props.checked)}
      >
        <input type="checkbox" />
      </div>
    </>
  );
};

export const ExtraButton = (props: { icon?: string; onClick?: () => void; tooltip?: string }) => {
  return (
    <div
      ref={el => props.icon && Ob.setIcon(el, props.icon)}
      class="setting-editor-extra-setting-button"
      classList={{ 'clickable-icon': props.icon && !!props.onClick }}
      aria-label={props.tooltip}
      onClick={props.onClick}
    />
  );
};

export const Text = (props: {
  placeholder?: string;
  title?: string;
  value?: string;
  style?: string;
  disabled?: boolean;
  readOnly?: boolean;
  spellcheck?: boolean;
  onChange?: (value: string) => void;
}) => {
  return (
    <input
      type="text"
      title={props.title}
      readOnly={props.readOnly}
      placeholder={props.placeholder}
      spellcheck={props.spellcheck ?? false}
      style={props.style}
      value={props.value}
      onChange={e => props.onChange?.(e.target.value)}
      disabled={props.disabled}
    />
  );
};

export const TextArea = (props: {
  placeholder?: string;
  title?: string;
  value?: string;
  style?: string;
  class?: string;
  /** Height follows the lines it holds, rather than a fixed number of them. */
  autoSize?: boolean;
  /** Turn this over when the field is shown: what is not rendered cannot be measured. */
  visible?: boolean;
  disabled?: boolean;
  spellcheck?: boolean;
  onChange?: (value: string) => void;
}) => {
  let el!: HTMLTextAreaElement;

  // The height is measured, not chosen: it is however tall the text currently is.
  // A stylesheet has no way to say that, which is why this function exists.
  const resize = () => {
    if (!props.autoSize) {
      return;
    }
    // Nothing rendered has a height to read. `rows` below carries the field
    // until it is on screen and can be measured for real.
    if (el.getClientRects().length === 0) {
      el.style.height = '';
      return;
    }
    // Measured with nothing of its own in the way; `scrollHeight` is content
    // and padding, and a border-box height has to carry the border as well.
    el.style.height = 'auto';
    const style = getComputedStyle(el);
    const border = parseFloat(style.borderTopWidth) + parseFloat(style.borderBottomWidth);
    el.style.height = `${el.scrollHeight + border}px`;
  };

  // Every way it can change: typed into, written from the settings, or brought
  // on screen where it can finally be measured. `on` names those dependencies
  // instead of reading them for their tracking side effect — the same thing to
  // solid, and a good deal plainer to everyone else.
  createEffect(on([() => props.value, () => props.visible], resize));

  return (
    <textarea
      ref={el}
      class={props.class}
      placeholder={props.placeholder}
      // A line per line, so a field that has never been on screen is still about
      // the right height for whatever reveals it.
      rows={props.autoSize ? Math.max(1, props.value?.split('\n').length ?? 1) : undefined}
      spellcheck={props.spellcheck ?? false}
      style={props.style}
      value={props.value}
      onInput={resize}
      onChange={e => props.onChange?.(e.target.value)}
      disabled={props.disabled}
    />
  );
};

export const DropDown = (props: {
  options: { name?: string; value: string }[];
  selected?: string;
  onChange?: (value: string, index: number) => void;
}) => {
  return (
    <>
      <select class="dropdown" onChange={e => props.onChange?.(e.target.value, e.target.selectedIndex)} autofocus={true}>
        <For each={props.options}>
          {item => (
            <option value={item.value} selected={item.value === props.selected}>
              {item.name ?? item.value}
            </option>
          )}
        </For>
      </select>
    </>
  );
};
