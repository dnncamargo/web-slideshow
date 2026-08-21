"use client";

import { useEffect, useRef, useState } from "react";

import type { KeyboardEvent as ReactKeyboardEvent } from "react";

import { Button } from "@powershow/ui";

import { useStudioI18n } from "../i18n/studio-i18n-context";
import type { PresentationSummary } from "../persistence/presentation-persistence";

import styles from "./presentation-library.module.css";

interface DeletePresentationDialogProps {
  summary: PresentationSummary | null;
  deleting: boolean;
  error: string | null;
  onCancel: () => void;
  onConfirm: () => void;
}

/**
 * Local danger confirmation dialog for permanently deleting an archived,
 * never-published presentation from Archived.
 *
 * The user must type the presentation's DISPLAY NAME exactly (case-sensitive,
 * untrimmed) to enable the destructive action. Only the private draft is
 * deleted; published presentations never reach this dialog because the tool
 * already disables their Delete control.
 *
 * This is intentionally a Library-local surface, not a reusable modal
 * framework.
 */
export function DeletePresentationDialog({
  summary,
  deleting,
  error,
  onCancel,
  onConfirm,
}: DeletePresentationDialogProps) {
  const { t } = useStudioI18n();
  const [value, setValue] = useState("");
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  if (!summary) {
    return null;
  }

  const displayTitle =
    summary.title.trim().length > 0 ? summary.title : t("library.untitled");
  const confirmed = value === displayTitle;

  const handleKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Escape") {
      event.preventDefault();
      if (!deleting) onCancel();
    }
  };

  return (
    <div className={styles.deleteDialogBackdrop}>
      <div
        className={styles.deleteDialog}
        role="dialog"
        aria-modal="true"
        aria-labelledby="powershow-delete-dialog-title"
        onKeyDown={handleKeyDown}
      >
        <h2
          id="powershow-delete-dialog-title"
          className={styles.deleteDialogTitle}
        >
          {t("library.deleteDialogTitle")}
        </h2>

        <p className={styles.deleteDialogText}>
          {t("library.deleteDialogWarning")}
        </p>

        <p className={styles.deleteDialogText}>
          {t("library.deleteDialogTypeName", { title: displayTitle })}
        </p>

        <label
          className={styles.deleteDialogLabel}
          htmlFor="powershow-delete-confirm-input"
        >
          {t("library.deleteDialogLabel")}
        </label>

        <input
          id="powershow-delete-confirm-input"
          ref={inputRef}
          className={styles.deleteDialogInput}
          type="text"
          value={value}
          disabled={deleting}
          onChange={(event) => setValue(event.target.value)}
        />

        {error ? (
          <p className={styles.deleteDialogError} role="alert">
            {error}
          </p>
        ) : null}

        <div className={styles.deleteDialogActions}>
          <Button size="compact" disabled={deleting} onClick={onCancel}>
            {t("library.cancel")}
          </Button>
          <Button
            variant="danger"
            size="compact"
            disabled={deleting || !confirmed}
            onClick={onConfirm}
          >
            {deleting ? t("library.deleting") : t("library.deletePermanently")}
          </Button>
        </div>
      </div>
    </div>
  );
}
