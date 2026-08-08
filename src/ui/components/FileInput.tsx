import { FileFilter, remote } from 'electron';
import { Text, ExtraButton } from './Setting';

/** Ask for a path, and answer with it — or with nothing, where the dialog was closed. */
export const choosePath = async (options: { value?: string; folder?: boolean; filters?: FileFilter[] }) => {
  const retval = await remote.dialog.showOpenDialog({
    // A path with `${...}` in it names nothing until an export resolves it, so the dialog is left to open wherever it
    // opened last.
    defaultPath: options.value && !options.value.includes('${') ? options.value : undefined,
    properties: options.folder ? ['createDirectory', 'openDirectory'] : ['openFile'],
    filters: options.folder ? undefined : options.filters,
  });

  return retval.canceled ? undefined : retval.filePaths[0];
};

/** A path, typed or chosen — to a file, or to a folder where `folder` says so. */
export default (props: {
  value?: string;
  placeholder?: string;
  /** What the dialog offers to open, most likely kind first. Files only. */
  filters?: FileFilter[];
  /** Ask for a folder rather than a file, and offer to make one. */
  folder?: boolean;
  /** Said on the button, since the field's own label asks for the path. */
  tooltip?: string;
  onChange: (value: string) => void;
}) => {
  const pick = async () => {
    const chosen = await choosePath(props);
    if (chosen !== undefined) {
      props.onChange(chosen);
    }
  };

  return (
    <>
      <Text style="width: 100%" value={props.value ?? ''} title={props.value} placeholder={props.placeholder} onChange={props.onChange} />
      <ExtraButton icon={props.folder ? 'folder' : 'folder-open'} tooltip={props.tooltip} onClick={pick} />
    </>
  );
};
