import { getContext, setContext } from 'svelte';
import { writable } from 'svelte/store';
import { browser } from '$app/environment';
import { en, type Translations } from './en';
import { pt } from './pt';

export type Locale = 'en' | 'pt';

const translations: Record<Locale, Translations> = { en, pt };

const LOCALE_KEY = 'sylvan-locale';

function getInitialLocale(): Locale {
  if (!browser) return 'en';
  const stored = localStorage.getItem(LOCALE_KEY) as Locale | null;
  if (stored && (stored === 'en' || stored === 'pt')) return stored;
  const browserLang = navigator.language?.startsWith('pt') ? 'pt' : 'en';
  return browserLang;
}

export function createLocaleStore() {
  const { subscribe, set, update } = writable<Locale>(getInitialLocale());

  return {
    subscribe,
    set: (locale: Locale) => {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(LOCALE_KEY, locale);
      }
      set(locale);
    },
    toggle: () => {
      update((current) => {
        const next: Locale = current === 'en' ? 'pt' : 'en';
        if (typeof localStorage !== 'undefined') {
          localStorage.setItem(LOCALE_KEY, next);
        }
        return next;
      });
    }
  };
}

export type LocaleStore = ReturnType<typeof createLocaleStore>;

const CONTEXT_KEY = Symbol('locale');

export function setLocaleContext(store: LocaleStore) {
  setContext(CONTEXT_KEY, store);
}

export function getLocaleStore(): LocaleStore {
  return getContext(CONTEXT_KEY);
}

export function t(locale: Locale, path: string): string {
  const keys = path.split('.');
  let result: unknown = translations[locale];
  for (const key of keys) {
    if (result && typeof result === 'object' && key in result) {
      result = (result as Record<string, unknown>)[key];
    } else {
      // Fall back to English
      result = translations['en'];
      for (const k of keys) {
        if (result && typeof result === 'object' && k in result) {
          result = (result as Record<string, unknown>)[k];
        } else {
          return path;
        }
      }
      return typeof result === 'string' ? result : path;
    }
  }
  return typeof result === 'string' ? result : path;
}
