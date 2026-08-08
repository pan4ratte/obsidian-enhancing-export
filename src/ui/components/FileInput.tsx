import { FileFilter, remote } from 'electron';
import { Text, ExtraButton } from './Setting';

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
  const choosePath = async () => {
    const retval = await remote.dialog.showOpenDialog({
      // A path with `${...}` in it names nothing until an export resolves it, so the dialog is left to open wherever
      // it opened last.
      defaultPath: props.value && !props.value.includes('${') ? props.value : undefined,
      properties: props.folder ? ['createDirectory', 'openDirectory'] : ['openFile'],
      filters: props.folder ? undefined : props.filters,
    });

    if (!retval.canceled && retval.filePaths.length > 0) {
      props.onChange(retval.filePaths[0]);
    }
  };

  return (
    <>
      <Text style="width: 100%" value={props.value ?? ''} title={props.value} placeholder={props.placeholder} onChange={props.onChange} />
      <ExtraButton icon={props.folder ? 'folder' : 'folder-open'} tooltip={props.tooltip} onClick={choosePath} />
    </>
  );
};
