"use client";

import { useEffect, useId, useRef } from "react";
import type { KeyboardEvent as ReactKeyboardEvent, ReactNode } from "react";

import { Button } from "@powershow/ui";

import styles from "./danger-confirm-dialog.module.css";

interface DangerConfirmDialogProps {
  title: ReactNode;
  message: ReactNode;
  confirmLabel: ReactNode;
  cancelLabel: ReactNode;
  busy?: boolean;
  busyConfirmLabel?: ReactNode;
  error?: ReactNode;
  onCancel: () => void;
  onConfirm: () => void;
}

export function DangerConfirmDialog({
  title,
  message,
  confirmLabel,
  cancelLabel,
  busy = false,
  busyConfirmLabel,
  error,
  onCancel,
  onConfirm,
}: DangerConfirmDialogProps) {
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const titleId = useId();
  const messageId = useId();

  useEffect(() => {
    dialogRef.current?.focus();
  }, []);

  const handleKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Escape" && !busy) {
      event.preventDefault();
      onCancel();
    }
  };

  return (
    <div className={styles.backdrop} data-studio-danger-confirm-dialog>
      <div
        ref={dialogRef}
        className={styles.dialog}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={messageId}
        tabIndex={-1}
        onKeyDown={handleKeyDown}
      >
        <h2 id={titleId} className={styles.title}>{title}</h2>
        <p id={messageId} className={styles.message}>{message}</p>

        {error ? <p className={styles.error} role="alert">{error}</p> : null}

        <div className={styles.actions}>
          <Button size="compact" disabled={busy} onClick={onCancel}>
            {cancelLabel}
          </Button>
          <Button variant="danger" size="compact" disabled={busy} onClick={onConfirm}>
            {busy && busyConfirmLabel !== undefined ? busyConfirmLabel : confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
