import { moment } from 'obsidian';
import en from './en';
import ru from './ru';
import userGuideEn from '../../docs/USER_GUIDE.md';
import userGuideRu from '../../docs/USER_GUIDE_RU.md';
import changelogEn from '../../docs/CHANGELOG.md';
import changelogRu from '../../docs/CHANGELOG_RU.md';

export type Lang = typeof en;

const localeMap: Record<string, Lang> = { en, ru };

export const t: Lang = localeMap[moment.locale()] ?? en;

const userGuides: Record<string, string> = { ru: userGuideRu };

/** The guide in the vault's language, English where there is none. */
export const userGuide = (): string => userGuides[moment.locale()] ?? userGuideEn;

const changelogs: Record<string, string> = { ru: changelogRu };

/**
 * What changed in each release, in the vault's language. The Russian one is where a release is written; the English
 * file is the translation, and the one the release workflow reads its notes out of.
 */
export const changelog = (): string => changelogs[moment.locale()] ?? changelogEn;
