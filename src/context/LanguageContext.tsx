import { createContext, useCallback, useEffect, useState } from 'react';
import { translations, LANGUAGE_CONFIG } from '../translations';
import type { Language, TranslationKeys } from '../translations';

interface LanguageContextValue {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: TranslationKeys;
  dir: 'ltr' | 'rtl';
  isRTL: boolean;
}

export const LanguageContext = createContext<LanguageContextValue>({
  language: 'en',
  setLanguage: () => {},
  t: translations.en,
  dir: 'ltr',
  isRTL: false,
});

const STORAGE_KEY = 'studio-language';

function getInitialLanguage(): Language {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored && stored in translations) return stored as Language;
  return 'en';
}

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = useState<Language>(getInitialLanguage);

  const setLanguage = useCallback((lang: Language) => {
    setLanguageState(lang);
    localStorage.setItem(STORAGE_KEY, lang);
  }, []);

  const config = LANGUAGE_CONFIG[language];
  const dir = config.dir;
  const isRTL = dir === 'rtl';

  useEffect(() => {
    document.documentElement.setAttribute('dir', dir);
    document.documentElement.setAttribute('lang', language);
    if (isRTL) {
      document.documentElement.classList.add('rtl');
    } else {
      document.documentElement.classList.remove('rtl');
    }
  }, [dir, language, isRTL]);

  const value: LanguageContextValue = {
    language,
    setLanguage,
    t: translations[language],
    dir,
    isRTL,
  };

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  );
}
