"use client";

import type { ClipboardSessionState } from "./clipboard-session";
import styles from "./editor-workspace.module.css";

export function ClipboardPanel({
  session,
  clearLabel,
  emptyLabel,
  pinnedLabel,
  onClear,
}: {
  session: ClipboardSessionState;
  clearLabel: string;
  emptyLabel: string;
  pinnedLabel: string;
  onClear: () => void;
}) {
  const disposableEntries = session.entries.filter((entry) => !entry.pinned);
  const pinnedEntries = session.entries.filter((entry) => entry.pinned);

  return (
    <div className={styles.clipboardPanel}>
      <section className={styles.clipboardDisposableSection} aria-label={emptyLabel}>
        {disposableEntries.length === 0 ? (
          <p className={styles.clipboardEmptyState}>{emptyLabel}</p>
        ) : (
          disposableEntries.map((entry) => (
            <div key={entry.id} className={styles.clipboardEntry}>
              {entry.element.type}
            </div>
          ))
        )}
        <button
          className={styles.clipboardClearButton}
          type="button"
          disabled={disposableEntries.length === 0}
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
              <div key={entry.id} className={styles.clipboardEntry}>
                {entry.element.type}
              </div>
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
