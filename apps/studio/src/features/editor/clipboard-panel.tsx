"use client";

import type { PowerShowElement, Presentation } from "@powershow/document-schema";

import { ClipboardPreview } from "./clipboard-preview";
import {
  canPinClipboardEntry,
  type ClipboardSessionState,
  type PendingClipboardCut,
} from "./clipboard-session";
import styles from "./editor-workspace.module.css";

function SnapshotCard({
  entry,
  session,
  presentation,
  onSelect,
  onPaste,
  onPin,
  onRemove,
  typeLabel,
  pinLabel,
  unpinLabel,
  removeLabel,
}: {
  entry: ClipboardSessionState["entries"][number];
  session: ClipboardSessionState;
  presentation: Presentation;
  onSelect: (entryId: string) => void;
  onPaste: (entryId: string) => void;
  onPin: (entryId: string) => void;
  onRemove: (entryId: string) => void;
  typeLabel: (element: PowerShowElement) => string;
  pinLabel: string;
  unpinLabel: string;
  removeLabel: string;
}) {
  const label = typeLabel(entry.element);

  return (
    <article
      className={entry.id === session.selectedEntryId ? styles.clipboardEntrySelected : styles.clipboardEntry}
      aria-label={label}
      onClick={() => onSelect(entry.id)}
      onDoubleClick={() => onPaste(entry.id)}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onSelect(entry.id);
        }
      }}
      tabIndex={0}
    >
      <ClipboardPreview element={entry.element} presentation={presentation} />
      <div className={styles.clipboardEntryFooter}>
        <span>{label}</span>
        <span className={styles.clipboardEntryActions}>
          <button
            className={styles.clipboardEntryAction}
            type="button"
            aria-label={entry.pinned ? `${unpinLabel} ${label}` : `${pinLabel} ${label}`}
            disabled={!entry.pinned && !canPinClipboardEntry(session.entries, entry.id)}
            onClick={(event) => {
              event.stopPropagation();
              onPin(entry.id);
            }}
          >
            {entry.pinned ? "★" : "☆"}
          </button>
          <button
            className={styles.clipboardEntryAction}
            type="button"
            aria-label={`${removeLabel} ${label}`}
            onClick={(event) => {
              event.stopPropagation();
              onRemove(entry.id);
            }}
          >
            ×
          </button>
        </span>
      </div>
    </article>
  );
}

export function ClipboardPanel({
  session,
  pendingCut,
  pendingCutLabel,
  presentation,
  clearLabel,
  emptyLabel,
  pinnedLabel,
  onClear,
  onSelect,
  onPaste,
  onCancelPendingCut,
  onPin,
  onRemove,
  typeLabel,
  pinLabel,
  unpinLabel,
  removeLabel,
}: {
  session: ClipboardSessionState;
  pendingCut: PendingClipboardCut | null;
  pendingCutLabel: string;
  presentation: Presentation;
  clearLabel: string;
  emptyLabel: string;
  pinnedLabel: string;
  onClear: () => void;
  onSelect: (entryId: string) => void;
  onPaste: (entryId: string) => void;
  onCancelPendingCut: () => void;
  onPin: (entryId: string) => void;
  onRemove: (entryId: string) => void;
  typeLabel: (element: PowerShowElement) => string;
  pinLabel: string;
  unpinLabel: string;
  removeLabel: string;
}) {
  const disposableEntries = session.entries.filter((entry) => !entry.pinned);
  const pinnedEntries = session.entries.filter((entry) => entry.pinned);

  return (
    <div className={styles.clipboardPanel}>
      {pendingCut ? (
        <section className={styles.clipboardPendingCutSection} aria-label={pendingCutLabel}>
          <div className={styles.clipboardSectionLabel}>{pendingCutLabel}</div>
          <div className={styles.clipboardPendingCut}>
            <span>{typeLabel({ id: pendingCut.sourceElementId, type: pendingCut.elementType } as PowerShowElement)}</span>
            <button
              className={styles.clipboardPendingCutCancel}
              type="button"
              aria-label={pendingCutLabel + " — " + removeLabel}
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
            <SnapshotCard
              key={entry.id}
              entry={entry}
              session={session}
              presentation={presentation}
              onSelect={onSelect}
              onPaste={onPaste}
              onPin={onPin}
              onRemove={onRemove}
              typeLabel={typeLabel}
              pinLabel={pinLabel}
              unpinLabel={unpinLabel}
              removeLabel={removeLabel}
            />
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
              <SnapshotCard
                key={entry.id}
                entry={entry}
                session={session}
                presentation={presentation}
                onSelect={onSelect}
                onPaste={onPaste}
                onPin={onPin}
                onRemove={onRemove}
                typeLabel={typeLabel}
                pinLabel={pinLabel}
                unpinLabel={unpinLabel}
                removeLabel={removeLabel}
              />
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
