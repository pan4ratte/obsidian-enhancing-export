import { MARKDOWN_HEADINGS, SHIFT_HEADING_LEVELS, WRAP_MODES } from './writer_args';
import { supportsMarkdownHeadings, supportsReferenceLinks, supportsWrap } from './pandoc_format';
import {
  supportsExtractMedia,
  supportsMetadata,
  supportsStripComments,
  supportsTabStop,
  supportsTrackChanges,
  writerFor,
  type MarkdownFlavour,
} from './import_format';

/* The options the import dialog asks for, and the command line they come to. */

export const TRACK_CHANGES = ['accept', 'reject', 'all'] as const;

export type TrackChanges = (typeof TRACK_CHANGES)[number];

export interface ImportOptions {
  flavour: MarkdownFlavour;
  /** What Word left in the document beside the text of it. */
  trackChanges?: string;
  /** Where the images go, written as the note will link to them. Unset leaves them where they are. */
  extractMedia?: string;
  tabStop?: string;
  stripComments?: boolean;
  shiftHeadingLevelBy?: string;
  /** The document's title, author and date, kept as the note's properties. */
  standalone?: boolean;
  wrap?: string;
  columns?: string;
  markdownHeadings?: string;
  referenceLinks?: boolean;
}

const digits = (value?: string): string => (value ?? '').replace(/\D/g, '');

const quote = (value: string): string => `"${value.replaceAll('"', '')}"`;

const oneOf = (values: readonly string[], value?: string): string | undefined => (value && values.includes(value) ? value : undefined);

/**
 * The arguments a conversion runs with: the reader, the writer, and only those options each of the two reads. The
 * gates are here rather than in the dialog alone — the rows come and go as another file is chosen, and an option left
 * standing from the last one would otherwise reach the command line.
 */
export const importArguments = (reader: string, options: ImportOptions): string[] => {
  const args = ['-f', reader, '-t', writerFor(options.flavour)];

  if (options.standalone && supportsMetadata(reader)) {
    args.push('-s');
  }
  const trackChanges = oneOf(TRACK_CHANGES, options.trackChanges);
  if (trackChanges && supportsTrackChanges(reader)) {
    args.push(`--track-changes=${trackChanges}`);
  }
  if (options.extractMedia && supportsExtractMedia(reader)) {
    args.push(`--extract-media=${quote(options.extractMedia)}`);
  }
  const tabStop = digits(options.tabStop);
  if (tabStop && supportsTabStop(reader)) {
    args.push(`--tab-stop=${tabStop}`);
  }
  if (options.stripComments && supportsStripComments(reader)) {
    args.push('--strip-comments');
  }
  const shift = oneOf(SHIFT_HEADING_LEVELS.map(String), options.shiftHeadingLevelBy);
  if (shift) {
    args.push(`--shift-heading-level-by=${shift}`);
  }

  const wrap = oneOf(WRAP_MODES, options.wrap);
  if (wrap && supportsWrap(options.flavour)) {
    args.push(`--wrap=${wrap}`);
  }
  const columns = digits(options.columns);
  // Nothing is wrapped at a column once the wrapping is off.
  if (columns && wrap !== 'none' && supportsWrap(options.flavour)) {
    args.push(`--columns=${columns}`);
  }
  const headings = oneOf(MARKDOWN_HEADINGS, options.markdownHeadings);
  if (headings && supportsMarkdownHeadings(options.flavour)) {
    args.push(`--markdown-headings=${headings}`);
  }
  if (options.referenceLinks && supportsReferenceLinks(options.flavour)) {
    args.push('--reference-links');
  }
  return args;
};

/** The whole command: pandoc, the file it reads, the options, and the note it writes in the folder it is run from. */
export const importCommand = (pandocPath: string, source: string, reader: string, options: ImportOptions, noteName: string): string =>
  [pandocPath, quote(source), ...importArguments(reader, options), '-o', quote(noteName)].join(' ');
