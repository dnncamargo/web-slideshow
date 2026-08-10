"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

import type { ReactNode } from "react";

import {
  DEFAULT_STUDIO_LOCALE,
  STUDIO_LOCALE_STORAGE_KEY,
  isStudioLocale,
  translateStudioMessage,
} from "./studio-i18n";

import type {
  StudioLocale,
  StudioMessageKey,
  StudioMessageValues,
  StudioTranslate,
} from "./studio-i18n";

// ============================================================
// BEGIN: STUDIO I18N CONTEXT
// ============================================================

interface StudioI18nContextValue {
  locale: StudioLocale;
  setLocale: (locale: StudioLocale) => void;
  t: StudioTranslate;
}

const StudioI18nContext = createContext<StudioI18nContextValue | null>(null);

function readPersistedLocale(): StudioLocale | null {
  try {
    const persistedLocale = window.localStorage.getItem(
      STUDIO_LOCALE_STORAGE_KEY,
    );

    return isStudioLocale(persistedLocale) ? persistedLocale : null;
  } catch {
    return null;
  }
}

function persistLocale(locale: StudioLocale): void {
  try {
    window.localStorage.setItem(STUDIO_LOCALE_STORAGE_KEY, locale);
  } catch {
    // The selected locale still applies to the current tab when storage is
    // unavailable, for example in a restricted private browsing context.
  }
}

export function StudioI18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<StudioLocale>(
    DEFAULT_STUDIO_LOCALE,
  );

  // ============================================================
  // BEGIN: POST-HYDRATION LOCALE RESTORATION
  // ============================================================

  useEffect(() => {
    const persistedLocale = readPersistedLocale();
    let active = true;

    if (persistedLocale) {
      queueMicrotask(() => {
        if (!active) {
          return;
        }

        setLocaleState(persistedLocale);
        document.documentElement.lang = persistedLocale;
      });
    }

    return () => {
      active = false;
    };
  }, []);

  // ============================================================
  // END: POST-HYDRATION LOCALE RESTORATION
  // ============================================================

  const setLocale = useCallback((nextLocale: StudioLocale) => {
    setLocaleState(nextLocale);
    persistLocale(nextLocale);
    document.documentElement.lang = nextLocale;
  }, []);

  const t = useCallback(
    (key: StudioMessageKey, values?: StudioMessageValues) =>
      translateStudioMessage(locale, key, values),
    [locale],
  );

  const value = useMemo(
    () => ({
      locale,
      setLocale,
      t,
    }),
    [locale, setLocale, t],
  );

  return (
    <StudioI18nContext.Provider value={value}>
      {children}
    </StudioI18nContext.Provider>
  );
}

export function useStudioI18n(): StudioI18nContextValue {
  const context = useContext(StudioI18nContext);

  if (!context) {
    throw new Error("useStudioI18n must be used inside StudioI18nProvider.");
  }

  return context;
}

// ============================================================
// END: STUDIO I18N CONTEXT
// ============================================================
