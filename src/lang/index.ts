import enUS from './en-US';

export type Lang = typeof enUS;

/**
 * Shape a translation has to satisfy. New strings land in `en-US` first, so a
 * locale only has to carry the entries it has actually translated.
 */
export type PartialLang = {
  [K in keyof Lang]?: Lang[K] extends string | ((...args: never[]) => unknown) ? Lang[K] : Partial<Lang[K]>;
};

/*
 * The other locales (`de-DE`, `ru-RU`, `zh-CN`, `zh-TW`) are parked while the
 * settings strings are in flux — the files are still here, they are simply not
 * wired up, so the plugin runs in English everywhere. To bring them back: add
 * them to `langs` and let `current` pick by `moment.locale()` again, falling
 * back to `en-US` per entry (see git history for the previous lookup).
 */
const langs = {
  'en-US': enUS,
};

export default {
  ...langs,
  get current(): Lang {
    return enUS;
  },
};
