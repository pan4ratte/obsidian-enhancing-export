import { Index } from 'solid-js';
import { t } from '../../lang/helpers';
import { PATH_SEPARATOR } from '../../system/platform';
import FileInput, { choosePath } from '../components/FileInput';
import { ExtraButton } from '../components/Setting';

/** What this platform lists folders with. */
const SEPARATOR = PATH_SEPARATOR();

/** The folders a value names. */
const folders = (value: string) => value.split(SEPARATOR).filter(folder => folder !== '');

/**
 * The folders back as one value. A value ending in the separator ends in one still: an empty last entry is how
 * `TEXINPUTS` and `PATH` say “and whatever the system already had”, which is not a folder to show and not ours to
 * drop either.
 */
const join = (list: string[], value: string) => list.join(SEPARATOR) + (value.endsWith(SEPARATOR) ? SEPARATOR : '');

/** The environment with one variable's folders rewritten. */
const withFolders = (env: Record<string, string>, name: string, update: (list: string[]) => string[]) => {
  const value = env[name] ?? '';
  return { ...env, [name]: join(update(folders(value)), value) };
};

/**
 * Ask for a folder and add it to a variable. Straight to the dialog: an empty row is not a folder, so there is none
 * to add and then fill in. Exported because the buttons that do this stand in the panel's own row, below the rows
 * they add to.
 */
export const addEnvFolder = async (env: Record<string, string>, name: string, onChange: (env: Record<string, string>) => void) => {
  const chosen = await choosePath({ folder: true });
  if (chosen !== undefined) {
    onChange(withFolders(env, name, list => [...list, chosen]));
  }
};

/** The environment pandoc is run with, a folder a row. */
export default (props: { env: Record<string, string>; onChange: (env: Record<string, string>) => void }) => {
  const write = (name: string, update: (list: string[]) => string[]) => props.onChange(withFolders(props.env, name, update));

  return (
    <div class="ex-env-list">
      {/* `Index` throughout: the rows are worked out afresh from the value on every change, and `For` would throw
          away the field being typed into rather than write the new path into it. */}
      <Index each={Object.entries(props.env)}>
        {entry => (
          <div class="ex-env-var">
            <div class="ex-env-var-name">{entry()[0]}</div>
            <Index each={folders(entry()[1])}>
              {(folder, index) => (
                <div class="ex-env-folder">
                  {/* Still typed into as well as picked: a folder is as often written as `${pluginDir}/…`, which no
                      dialog can name. */}
                  <FileInput
                    value={folder()}
                    folder={true}
                    tooltip={t.CHOOSE_FOLDER}
                    onChange={value => write(entry()[0], list => list.map((f, i) => (i === index ? value.trim() : f)))}
                  />
                  <ExtraButton
                    icon="x"
                    tooltip={t.ACTION_REMOVE}
                    onClick={() => write(entry()[0], list => list.filter((_, i) => i !== index))}
                  />
                </div>
              )}
            </Index>
          </div>
        )}
      </Index>
    </div>
  );
};
