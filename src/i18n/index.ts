import { en } from "./en";
import { es } from "./es";

export type TranslationKey = keyof typeof en;
export type Translations = Record<TranslationKey, string>;

const locales: Record<string, Translations> = {
  en,
  es: es as unknown as Translations,
};

/**
 * Resolve the best matching locale from an Accept-Language header value.
 * Falls back to "en".
 */
export function resolveLocale(acceptLanguage?: string): string {
  if (!acceptLanguage) return "en";
  for (const part of acceptLanguage.split(",")) {
    const lang = part.trim().split(/[-;]/)[0].toLowerCase();
    if (locales[lang]) return lang;
  }
  return "en";
}

export function getTranslations(acceptLanguage?: string): Translations {
  return locales[resolveLocale(acceptLanguage)] ?? en;
}
