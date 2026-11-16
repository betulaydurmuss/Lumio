import { defaultLocale, localeSchema, type Locale } from '@lumio/shared';
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import en from './en.json';
import tr from './tr.json';

const STORAGE_KEY = 'lumio.locale';

function initialLocale(): Locale {
  try {
    const stored = localeSchema.safeParse(localStorage.getItem(STORAGE_KEY));
    if (stored.success) return stored.data;
  } catch {
    // Storage can be unavailable (private mode); fall through to the browser language.
  }
  const browser = localeSchema.safeParse(navigator.language.slice(0, 2));
  return browser.success ? browser.data : defaultLocale;
}

export function setLocale(locale: Locale) {
  void i18n.changeLanguage(locale);
  try {
    localStorage.setItem(STORAGE_KEY, locale);
  } catch {
    // Not persisting is acceptable; the choice still applies to this visit.
  }
}

i18n.on('languageChanged', (lng) => {
  document.documentElement.lang = lng;
});

void i18n.use(initReactI18next).init({
  resources: { tr: { translation: tr }, en: { translation: en } },
  lng: initialLocale(),
  fallbackLng: defaultLocale,
  interpolation: { escapeValue: false },
});

export default i18n;
