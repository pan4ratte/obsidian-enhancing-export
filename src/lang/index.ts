import enUS from './en-US';

export type Lang = typeof enUS;

export default {
  'en-US': enUS,
  get current(): Lang {
    return enUS;
  },
};
