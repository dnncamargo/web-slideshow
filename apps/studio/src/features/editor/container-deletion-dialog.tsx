"use client";

import { useId, type ReactNode } from "react";

import { Button } from "@web-slideshow/ui";

import styles from "./container-deletion-dialog.module.css";

export function ContainerDeletionDialog({
  title,
  message,
  cancelLabel,
  deleteAllLabel,
  preserveChildrenLabel,
  deleteAllDisabled = false,
  notice,
  onCancel,
  onDeleteAll,
  onPreserveChildren,
}: {
  title: ReactNode;
  message: ReactNode;
  cancelLabel: ReactNode;
  deleteAllLabel: ReactNode;
  preserveChildrenLabel: ReactNode;
  deleteAllDisabled?: boolean;
  notice?: ReactNode;
  onCancel: () => void;
  onDeleteAll: () => void;
  onPreserveChildren: () => void;
}) {
  const titleId = useId();
  const messageId = useId();

  return (
    <div className={styles.backdrop}>
      <div
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
        {notice ? <p className={styles.message} role="alert">{notice}</p> : null}
        <div className={styles.actions}>
          <Button size="compact" onClick={onCancel}>{cancelLabel}</Button>
          <Button
            variant="danger"
            size="compact"
            disabled={deleteAllDisabled}
            autoFocus={!deleteAllDisabled}
            onClick={onDeleteAll}
          >
            {deleteAllLabel}
          </Button>
          <Button size="compact" autoFocus={deleteAllDisabled} onClick={onPreserveChildren}>
            {preserveChildrenLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
