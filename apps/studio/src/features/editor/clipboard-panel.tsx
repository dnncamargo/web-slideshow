"use client";

import type { PresentationElement, Presentation } from "@web-slideshow/document-schema";

import {
  ELEMENT_TYPE_MESSAGE_KEYS,
  type StudioMessageKey,
  type StudioTranslate,
} from "@/features/i18n/studio-i18n";

import { ClipboardPreview } from "./clipboard-preview";
import {
  canPinClipboardEntry,
  type ClipboardSessionState,
  type PendingClipboardCut,
} from "./clipboard-session";
import type { HistoryActionMeta } from "./editor-history-state";
import styles from "./editor-workspace.module.css";

const HISTORY_LABEL_KEYS = [
  "history.color.change",
  "history.element.add",
  "history.element.delete",
  "history.element.duplicate",
  "history.element.move",
  "history.element.paste",
  "history.element.setting",
  "history.length.change",
  "history.length.reset",
  "history.number.change",
  "history.number.reset",
  "history.presentation.rename",
  "history.slide.add",
  "history.slide.delete",
  "history.slide.duplicate",
  "history.slide.move",
  "history.slide.rename",
  "history.text.color",
  "history.text.edit",
] as const satisfies readonly StudioMessageKey[];

type HistoryLabelKey = (typeof HISTORY_LABEL_KEYS)[number];

function isHistoryLabelKey(value: string): value is HistoryLabelKey {
  return (HISTORY_LABEL_KEYS as readonly string[]).includes(value);
}

function humanizeHistoryToken(value: string): string {
  const readable = value
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[._-]+/g, " ")
    .trim()
    .toLowerCase();

  return readable.length === 0
    ? "History action"
    : readable.charAt(0).toUpperCase() + readable.slice(1);
}

function resolveHistoryValue(
  name: string,
  value: string | number,
  translate: StudioTranslate,
): string | number {
  if (name === "setting") {
    return humanizeHistoryToken(String(value));
  }

  if (name === "elementType" && typeof value === "string") {
    const key = Object.prototype.hasOwnProperty.call(
      ELEMENT_TYPE_MESSAGE_KEYS,
      value,
    )
      ? ELEMENT_TYPE_MESSAGE_KEYS[value as keyof typeof ELEMENT_TYPE_MESSAGE_KEYS]
      : undefined;

    return key === undefined ? humanizeHistoryToken(value) : translate(key);
  }

  return value;
}

export function resolveHistoryActionLabel(
  action: HistoryActionMeta,
  translate: StudioTranslate,
): string {
  if (!isHistoryLabelKey(action.labelKey)) {
    return humanizeHistoryToken(action.kind);
  }

  const values: Record<string, string | number> = {};
  for (const [name, value] of Object.entries(action.labelParams ?? {})) {
    values[name] = resolveHistoryValue(name, value, translate);
  }

  return translate(action.labelKey, values);
}

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
  typeLabel: (element: PresentationElement) => string;
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
  typeLabel: (element: PresentationElement) => string;
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
            <span>{typeLabel({ id: pendingCut.sourceElementId, type: pendingCut.elementType } as PresentationElement)}</span>
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

export function HistoryPanel({
  pastActions,
  futureActions,
  emptyLabel,
  appliedLabel,
  redoLabel,
  translate,
}: {
  pastActions: readonly HistoryActionMeta[];
  futureActions: readonly HistoryActionMeta[];
  emptyLabel: string;
  appliedLabel: string;
  redoLabel: string;
  translate: StudioTranslate;
}) {
  if (pastActions.length === 0 && futureActions.length === 0) {
    return <p className={styles.historyEmptyState}>{emptyLabel}</p>;
  }

  return (
    <div className={styles.historyPanel}>
      {pastActions.length > 0 ? (
        <section className={styles.historySection} aria-label={appliedLabel}>
          <div className={styles.clipboardSectionLabel}>{appliedLabel}</div>
          <ol className={styles.historyEntries}>
            {pastActions
              .slice()
              .reverse()
              .map((action, index) => (
                <li className={styles.historyEntry} key={`past-${index}`}>
                  {resolveHistoryActionLabel(action, translate)}
                </li>
              ))}
          </ol>
        </section>
      ) : null}

      {futureActions.length > 0 ? (
        <section className={styles.historySection} aria-label={redoLabel}>
          <div className={styles.clipboardSectionLabel}>{redoLabel}</div>
          <ol className={styles.historyEntries}>
            {futureActions.map((action, index) => (
              <li className={styles.historyEntry} key={`future-${index}`}>
                {resolveHistoryActionLabel(action, translate)}
              </li>
            ))}
          </ol>
        </section>
      ) : null}
    </div>
  );
}
