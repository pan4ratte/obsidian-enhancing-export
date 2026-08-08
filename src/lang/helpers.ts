import { moment } from 'obsidian';
import en from './en';

export type Lang = typeof en;

const localeMap: Record<string, Lang> = { en };

export const t: Lang = localeMap[moment.locale()] ?? en;
