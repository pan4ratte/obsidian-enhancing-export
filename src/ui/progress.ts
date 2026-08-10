import { Notice } from 'obsidian';
import { t } from '../lang/helpers';

/**
 * How long the finished notice stays before it takes itself away. Long enough to be read by someone who looked up at
 * the end of a long export, short enough not to be dismissed by hand after a quick one.
 */
const DONE_VISIBLE_MS = 4000;

/**
 * The notice an export runs behind: a line saying what is being done, and a bar under it. Borrowed from the Classy
 * PDF Extractor.
 *
 * Nothing here can be counted — pandoc is one child process that says nothing until it is done — so the bar sweeps
 * rather than fills, which says the export is still going where a bar standing still would not. It is the whole
 * report: the outcome is written into the same notice rather than raised as a second one.
 */
export class ExportProgress {
  private readonly notice: Notice;
  private readonly labelEl: HTMLElement;
  private readonly barEl: HTMLElement;

  /** Set once the run is over, whether it finished or gave up. */
  private ended = false;

  constructor() {
    // 0 keeps it on screen: an export takes as long as the note is long, and a notice that timed out halfway would
    // be saying the run had ended when it had not.
    this.notice = new Notice('', 0);

    // Obsidian lays a notice out as a column on the desktop and as a row on a phone, and `notice-message` is the
    // item in either. Left alone the row leaves it as wide as its contents, and the bar would sit short.
    this.notice.messageEl.addClass('ex-progress-message');

    const root = this.notice.messageEl.createDiv({ cls: 'ex-progress' });
    this.labelEl = root.createDiv({ cls: 'ex-progress-label', text: t.NOTICE_EXPORT_PREPARING });
    const track = root.createDiv({ cls: 'ex-progress-track' });
    this.barEl = track.createDiv({ cls: 'ex-progress-bar is-waiting' });
  }

  /** Pandoc is running, which is the whole of the wait. */
  running(file: string): void {
    if (!this.ended) {
      this.labelEl.setText(t.NOTICE_EXPORTING(file));
    }
  }

  /** The file was written, and the notice bows out by itself. */
  succeed(file: string): void {
    this.finish(t.NOTICE_EXPORT_SUCCESS(file), 'is-done');
  }

  /** Written, but pandoc had something to say about it. */
  warn(file: string): void {
    this.finish(t.NOTICE_EXPORT_WARNINGS(file), 'is-warn');
  }

  /**
   * The run stopped short. Taken off screen and nothing said: what went wrong is the caller's to report, and a bar
   * left sweeping would go on claiming the export was still running.
   */
  stop(): void {
    if (this.ended) {
      return;
    }
    this.ended = true;
    this.notice.hide();
  }

  private finish(text: string, tone: string): void {
    if (this.ended) {
      return;
    }
    this.ended = true;

    // The outcome is a sentence rather than a file name, so it is allowed the lines it needs.
    this.labelEl.addClass('is-final');
    this.labelEl.setText(text);
    this.barEl.removeClass('is-waiting');
    this.barEl.addClass(tone);
    this.barEl.setCssProps({ '--ex-progress': '100%' });

    // `window` and not `activeWindow`, which is where the notice itself was put: the plugin guidelines have timers on
    // `window`, and the two share a context, so a timer set here reaches a notice in a popped-out window all the same.
    window.setTimeout(() => this.notice.hide(), DONE_VISIBLE_MS);
  }
}
