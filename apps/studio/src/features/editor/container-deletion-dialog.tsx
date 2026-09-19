"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";

import { Button } from "@web-slideshow/ui";

import styles from "./container-deletion-dialog.module.css";

export function ContainerDeletionDialog({
  title,
  message,
  cancelLabel,
  deleteAllLabel,
  preserveChildrenLabel,
  onCancel,
  onDeleteAll,
  onPreserveChildren,
}: {
  title: ReactNode;
  message: ReactNode;
  cancelLabel: ReactNode;
  deleteAllLabel: ReactNode;
  preserveChildrenLabel: ReactNode;
  onCancel: () => void;
  onDeleteAll: () => void;
  onPreserveChildren: () => void;
}) {
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const titleId = useId();
  const messageId = useId();

  useEffect(() => {
    dialogRef.current?.focus();
  }, []);

  return (
    <div className={styles.backdrop}>
      <div
        ref={dialogRef}
        className={styles.dialog}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={messageId}
        tabIndex={-1}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            event.preventDefault();
            onCancel();
          }
        }}
      >
        <h2 id={titleId} className={styles.title}>{title}</h2>
        <p id={messageId} className={styles.message}>{message}</p>
        <div className={styles.actions}>
          <Button size="compact" onClick={onCancel}>{cancelLabel}</Button>
          <Button variant="danger" size="compact" onClick={onDeleteAll}>{deleteAllLabel}</Button>
          <Button size="compact" onClick={onPreserveChildren}>{preserveChildrenLabel}</Button>
        </div>
      </div>
    </div>
  );
}
