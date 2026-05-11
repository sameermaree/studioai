import { en } from './en';
import { ar } from './ar';
import { fr } from './fr';
import type { TranslationKeys } from './en';

export type { TranslationKeys };
export type Language = 'en' | 'ar' | 'fr';

export const translations: Record<Language, TranslationKeys> = { en, ar, fr };

export const LANGUAGE_CONFIG: Record<Language, { label: string; nativeLabel: string; dir: 'ltr' | 'rtl' }> = {
  en: { label: 'English', nativeLabel: 'English', dir: 'ltr' },
  ar: { label: 'Arabic', nativeLabel: 'العربية', dir: 'rtl' },
  fr: { label: 'French', nativeLabel: 'Français', dir: 'ltr' },
};
