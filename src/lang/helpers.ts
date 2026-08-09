import { moment } from 'obsidian';
import en from './en';
import ru from './ru';

export type Lang = typeof en;

const localeMap: Record<string, Lang> = { en, ru };

export const t: Lang = localeMap[moment.locale()] ?? en;
