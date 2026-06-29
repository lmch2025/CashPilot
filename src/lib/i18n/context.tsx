"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from "react";
import {
  dictionaries,
  DEFAULT_LOCALE,
  type Locale,
} from "./dictionaries";

const STORAGE_KEY = "cashpilot-locale";

interface I18nContextValue {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: string, params?: Record<string, string | number>) => string;
  ready: boolean;
}

const I18nContext = createContext<I18nContextValue | null>(null);

/**
 * Détection intelligente de la langue, par ordre de priorité:
 * 1. localStorage (préférence explicite de l'utilisateur)
 * 2. navigator.languages (langue du navigateur)
 * 3. Intl timezone (indice: zones francophones → fr)
 * 4. Fallback: français (DEFAULT_LOCALE)
 */
function detectLocale(): Locale {
  // 1. localStorage (préférence utilisateur)
  if (typeof window !== "undefined") {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored === "fr" || stored === "en") {
        return stored;
      }
    } catch {
      // localStorage may be unavailable (private mode)
    }

    // 2. navigator.languages
    const nav = navigator as Navigator & { languages?: readonly string[] };
    const languages =
      nav.languages ?? (navigator.language ? [navigator.language] : []);
    for (const lang of languages) {
      const lower = lang.toLowerCase();
      if (lower.startsWith("fr")) return "fr";
      if (lower.startsWith("en")) return "en";
    }

    // 3. Timezone hint (zones francophones)
    try {
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || "";
      // Francophone African timezones
      const francophoneTzs = [
        "Africa/Douala",
        "Africa/Lagos",
        "Africa/Libreville",
        "Africa/Bangui",
        "Africa/Brazzaville",
        "Africa/Kinshasa",
        "Africa/Ndjamena",
        "Africa/Abidjan",
        "Africa/Dakar",
        "Africa/Bamako",
        "Africa/Ouagadougou",
        "Africa/Cotonou",
        "Africa/Lome",
        "Africa/Niamey",
        "Africa/Porto-Novo",
        "Indian/Antananarivo",
        "Africa/Tunis",
        "Africa/Algiers",
        "Africa/Casablanca",
        "Europe/Paris",
      ];
      if (francophoneTzs.includes(tz)) {
        return "fr";
      }
    } catch {
      // Intl may be unavailable
    }
  }

  // 4. Fallback
  return DEFAULT_LOCALE;
}

export function I18nProvider({ children }: { children: ReactNode }) {
  // On first render (SSR + initial client), use default to avoid hydration mismatch.
  const [locale, setLocaleState] = useState<Locale>(DEFAULT_LOCALE);
  const [ready, setReady] = useState(false);

  // Detect locale on mount (client-side only)
  useEffect(() => {
    const detected = detectLocale();
    setLocaleState(detected);
    setReady(true);
  }, []);

  // Update <html lang> attribute when locale changes
  useEffect(() => {
    if (typeof document !== "undefined") {
      document.documentElement.lang = locale;
    }
  }, [locale]);

  const setLocale = useCallback((newLocale: Locale) => {
    setLocaleState(newLocale);
    try {
      localStorage.setItem(STORAGE_KEY, newLocale);
    } catch {
      // ignore
    }
  }, []);

  const t = useCallback(
    (key: string, params?: Record<string, string | number>) => {
      const dict = dictionaries[locale] ?? dictionaries[DEFAULT_LOCALE];
      let value = dict[key];
      // Fallback to FR if key missing in current locale
      if (value === undefined) {
        value = dictionaries.fr[key];
      }
      // Fallback to key itself if missing in both
      if (value === undefined) {
        return key;
      }
      // Interpolation: replace {param} with actual values
      if (params) {
        for (const [paramKey, paramVal] of Object.entries(params)) {
          value = value.replace(
            new RegExp(`\\{${paramKey}\\}`, "g"),
            String(paramVal)
          );
        }
      }
      return value;
    },
    [locale]
  );

  return (
    <I18nContext.Provider value={{ locale, setLocale, t, ready }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n(): I18nContextValue {
  const ctx = useContext(I18nContext);
  if (!ctx) {
    throw new Error("useI18n must be used within I18nProvider");
  }
  return ctx;
}

// Convenience hook for just the translation function
export function useT() {
  return useI18n().t;
}
