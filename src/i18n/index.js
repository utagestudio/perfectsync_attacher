import ja from './locales/ja.js';
import en from './locales/en.js';
import ko from './locales/ko.js';
import zhHant from './locales/zh-Hant.js';
import zhHans from './locales/zh-Hans.js';
import { formatMessage } from './messages.js';

export const catalogs = { ja, en, ko, 'zh-Hant': zhHant, 'zh-Hans': zhHans };
export const LANGUAGE_STORAGE_KEY = 'perfectsync-attacher.language';
export const isLanguage = (language) => Object.hasOwn(catalogs, language);

export function detectLanguage(languages = []) {
  for (const language of languages) {
    if (typeof language !== 'string') continue;
    const parts = language.toLowerCase().split('-');
    const base = parts[0];
    if (['ja', 'en', 'ko'].includes(base)) return base;
    if (base === 'zh') {
      if (parts.includes('hant')) return 'zh-Hant';
      if (parts.includes('hans')) return 'zh-Hans';
      return parts.some((part) => ['tw', 'hk', 'mo'].includes(part)) ? 'zh-Hant' : 'zh-Hans';
    }
  }
  return 'en';
}

export function initialLanguage(languages, storage) {
  try {
    const saved = storage?.getItem(LANGUAGE_STORAGE_KEY);
    if (isLanguage(saved)) return saved;
  } catch {
    // Storage may be blocked; browser preference detection still works.
  }
  return detectLanguage(languages);
}

export function saveLanguage(language, storage) {
  if (!isLanguage(language)) return;
  try {
    storage?.setItem(LANGUAGE_STORAGE_KEY, language);
  } catch {
    // Switching remains available even when persistence is unavailable.
  }
}

export function translate(language, message, params) {
  const { code, params: values } =
    typeof message === 'string' ? { code: message, params } : message;
  return formatMessage(catalogs[language] ?? en, code, values);
}

export function translateDocument(language, root = document) {
  root.documentElement.lang = language;
  for (const element of root.querySelectorAll('[data-i18n]')) {
    element.textContent = translate(language, element.dataset.i18n);
  }
  for (const attribute of ['aria-label', 'title', 'content']) {
    for (const element of root.querySelectorAll(`[data-i18n-${attribute}]`)) {
      element.setAttribute(
        attribute,
        translate(language, element.getAttribute(`data-i18n-${attribute}`)),
      );
    }
  }
}
