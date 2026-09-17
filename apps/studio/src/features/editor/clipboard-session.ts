import type { PowerShowElement } from "@powershow/document-schema";

export const MAX_DISPOSABLE_CLIPBOARD_ENTRIES = 15;
export const MAX_PINNED_CLIPBOARD_ENTRIES = 5;

export interface ClipboardEntry {
  id: string;
  element: PowerShowElement;
  pinned: boolean;
}

export interface ClipboardSessionState {
  entries: readonly ClipboardEntry[];
  selectedEntryId: string | null;
}

export const EMPTY_CLIPBOARD_SESSION: ClipboardSessionState = {
  entries: [],
  selectedEntryId: null,
};

let clipboardEntrySequence = 0;

export function createClipboardEntry(
  element: PowerShowElement,
): ClipboardEntry {
  clipboardEntrySequence += 1;
  return {
    id: "clipboard-entry-" + Date.now() + "-" + clipboardEntrySequence,
    element: structuredClone(element),
    pinned: false,
  };
}

function orderEntries(entries: readonly ClipboardEntry[]): ClipboardEntry[] {
  return [
    ...entries.filter((entry) => entry.pinned),
    ...entries.filter((entry) => !entry.pinned),
  ];
}

export function countPinnedClipboardEntries(entries: readonly ClipboardEntry[]): number {
  return entries.filter((entry) => entry.pinned).length;
}

export function canPinClipboardEntry(
  entries: readonly ClipboardEntry[],
  entryId: string,
): boolean {
  const entry = entries.find((candidate) => candidate.id === entryId);
  return Boolean(
    entry &&
      (entry.pinned ||
        countPinnedClipboardEntries(entries) < MAX_PINNED_CLIPBOARD_ENTRIES),
  );
}

export function addClipboardEntry(
  state: ClipboardSessionState,
  entry: ClipboardEntry,
): ClipboardSessionState {
  if (
    entry.pinned &&
    countPinnedClipboardEntries(state.entries) >= MAX_PINNED_CLIPBOARD_ENTRIES
  ) {
    return state;
  }

  const entries = [entry, ...state.entries];
  const pinned = entries
    .filter((candidate) => candidate.pinned)
    .slice(0, MAX_PINNED_CLIPBOARD_ENTRIES);
  const disposable = entries
    .filter((candidate) => !candidate.pinned)
    .slice(0, MAX_DISPOSABLE_CLIPBOARD_ENTRIES);

  return {
    entries: orderEntries([...pinned, ...disposable]),
    selectedEntryId: state.selectedEntryId,
  };
}

export function pinClipboardEntry(
  state: ClipboardSessionState,
  entryId: string,
): ClipboardSessionState {
  if (!canPinClipboardEntry(state.entries, entryId)) return state;

  const entry = state.entries.find((candidate) => candidate.id === entryId);
  if (!entry) return state;

  const entries = state.entries.filter((candidate) => candidate.id !== entryId);
  return { ...state, entries: orderEntries([{ ...entry, pinned: true }, ...entries]) };
}

export function unpinClipboardEntry(
  state: ClipboardSessionState,
  entryId: string,
): ClipboardSessionState {
  const entry = state.entries.find((candidate) => candidate.id === entryId);
  if (!entry?.pinned) return state;

  const remaining = state.entries.filter((candidate) => candidate.id !== entryId);
  return {
    ...state,
    entries: orderEntries([{ ...entry, pinned: false }, ...remaining]),
  };
}

export function removeClipboardEntry(
  state: ClipboardSessionState,
  entryId: string,
): ClipboardSessionState {
  return {
    entries: state.entries.filter((entry) => entry.id !== entryId),
    selectedEntryId:
      state.selectedEntryId === entryId ? null : state.selectedEntryId,
  };
}

export function clearDisposableClipboardEntries(
  state: ClipboardSessionState,
): ClipboardSessionState {
  const entries = state.entries.filter((entry) => entry.pinned);
  return {
    entries,
    selectedEntryId:
      state.selectedEntryId &&
      entries.some((entry) => entry.id === state.selectedEntryId)
        ? state.selectedEntryId
        : null,
  };
}
