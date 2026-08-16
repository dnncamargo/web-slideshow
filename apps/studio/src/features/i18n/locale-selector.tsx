"use client";

import type { StudioLocale } from "./studio-i18n";
import { useStudioI18n } from "./studio-i18n-context";

import styles from "./locale-selector.module.css";

/**
 * Shared Studio language selector.
 *
 * Reuses the Studio i18n context locale/setLocale/t behavior and reproduces
 * the Editor's locale control visual treatment exactly. Used by the Editor
 * top bar and the Library header.
 */
export function LocaleSelector() {
  const { t, locale, setLocale } = useStudioI18n();

  return (
    <label className={styles.localeControl} title={t("locale.language")}>
      <span className={styles.localeIcon} aria-hidden="true">
        <svg
          viewBox="0 0 24 24"
          width="15"
          height="15"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="12" cy="12" r="9" />

          <path d="M3 12h18" />

          <path d="M12 3a15 15 0 0 1 0 18" />

          <path d="M12 3a15 15 0 0 0 0 18" />
        </svg>
      </span>

      <select
        value={locale}
        aria-label={t("locale.language")}
        onChange={(event) => {
          setLocale(event.target.value as StudioLocale);
        }}
      >
        <option value="en">US</option>

        <option value="pt-BR">PT</option>
      </select>
    </label>
  );
}