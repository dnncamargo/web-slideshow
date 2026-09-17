"use client";

import type { ClipboardSessionState, PendingClipboardCut } from "./clipboard-session";
import styles from "./editor-workspace.module.css";

export function ClipboardPanel({
  session,
  pendingCut,
  pendingCutLabel,
  clearLabel,
  emptyLabel,
  pinnedLabel,
  onClear,
  onSelect,
  onPaste,
  onCancelPendingCut,
}: {
  session: ClipboardSessionState;
  pendingCut: PendingClipboardCut | null;
  pendingCutLabel: string;
  clearLabel: string;
  emptyLabel: string;
  pinnedLabel: string;
  onClear: () => void;
  onSelect: (entryId: string) => void;
  onPaste: (entryId: string) => void;
  onCancelPendingCut: () => void;
}) {
  const disposableEntries = session.entries.filter((entry) => !entry.pinned);
  const pinnedEntries = session.entries.filter((entry) => entry.pinned);

  return (
    <div className={styles.clipboardPanel}>
      {pendingCut ? (
        <section className={styles.clipboardPendingCutSection} aria-label={pendingCutLabel}>
          <div className={styles.clipboardSectionLabel}>{pendingCutLabel}</div>
          <div className={styles.clipboardPendingCut}>
            <span>{pendingCut.elementType}</span>
            <button
              className={styles.clipboardPendingCutCancel}
              type="button"
              aria-label={pendingCutLabel + " ×"}
              onClick={onCancelPendingCut}
            >
              ×
            </button>
          </div>
        </section>
      ) : null}
      <section className={styles.clipboardDisposableSection} aria-label={emptyLabel}>
        {disposableEntries.length === 0 ? (
          <p className={styles.clipboardEmptyState}>{emptyLabel}</p>
        ) : (
          disposableEntries.map((entry) => (
            <button
              key={entry.id}
              className={
                entry.id === session.selectedEntryId
                  ? styles.clipboardEntrySelected
                  : styles.clipboardEntry
              }
              type="button"
              aria-pressed={entry.id === session.selectedEntryId}
              onClick={() => onSelect(entry.id)}
              onDoubleClick={() => onPaste(entry.id)}
            >
              {entry.element.type}
            </button>
          ))
        )}
        <button
          className={styles.clipboardClearButton}
          type="button"
          disabled={disposableEntries.length === 0 && pendingCut === null}
          onClick={onClear}
        >
          {clearLabel}
        </button>
      </section>

      {pinnedEntries.length > 0 ? (
        <section className={styles.clipboardPinnedSection} aria-label={pinnedLabel}>
          <div className={styles.clipboardSectionLabel}>{pinnedLabel}</div>
          <div className={styles.clipboardPinnedEntries}>
            {pinnedEntries.map((entry) => (
              <button
                key={entry.id}
                className={
                  entry.id === session.selectedEntryId
                    ? styles.clipboardEntrySelected
                    : styles.clipboardEntry
                }
                type="button"
                aria-pressed={entry.id === session.selectedEntryId}
                onClick={() => onSelect(entry.id)}
                onDoubleClick={() => onPaste(entry.id)}
              >
                {entry.element.type}
              </button>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}

export function HistoryPanel({ emptyLabel }: { emptyLabel: string }) {
  return <p className={styles.historyEmptyState}>{emptyLabel}</p>;
}
