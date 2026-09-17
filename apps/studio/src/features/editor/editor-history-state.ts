import type { Presentation } from "@powershow/document-schema";

export const EDITOR_HISTORY_LIMIT = 30;

export interface HistoryActionMeta {
  readonly kind: string;
  readonly labelKey: string;
  readonly labelParams?: Readonly<Record<string, string | number>>;
}

export interface HistoryEntry {
  readonly before: Presentation;
  readonly after: Presentation;
  readonly action: HistoryActionMeta;
}

export interface EditorHistoryState {
  readonly past: readonly HistoryEntry[];
  readonly present: Presentation;
  /** The first entry is the next transition available to redo. */
  readonly future: readonly HistoryEntry[];
}

export function createHistoryState(present: Presentation): EditorHistoryState {
  return { past: [], present, future: [] };
}

export function commitHistory(
  state: EditorHistoryState,
  nextPresentation: Presentation,
  action: HistoryActionMeta,
): EditorHistoryState {
  if (nextPresentation === state.present) {
    return state;
  }

  const nextEntry: HistoryEntry = {
    before: state.present,
    after: nextPresentation,
    action,
  };
  const nextPast = [...state.past, nextEntry];

  return {
    past:
      nextPast.length > EDITOR_HISTORY_LIMIT
        ? nextPast.slice(nextPast.length - EDITOR_HISTORY_LIMIT)
        : nextPast,
    present: nextPresentation,
    future: [],
  };
}

export function undoHistory(state: EditorHistoryState): EditorHistoryState {
  return undoSteps(state, 1);
}

export function redoHistory(state: EditorHistoryState): EditorHistoryState {
  return redoSteps(state, 1);
}

export function undoSteps(
  state: EditorHistoryState,
  count: number,
): EditorHistoryState {
  const steps = Math.min(Math.max(0, count), state.past.length);
  if (steps === 0) {
    return state;
  }

  const nextPast = state.past.slice(0, state.past.length - steps);
  const undone = state.past.slice(state.past.length - steps);
  const oldestUndone = undone[0];

  if (oldestUndone === undefined) {
    return state;
  }

  return {
    past: nextPast,
    present: oldestUndone.before,
    future: [...undone, ...state.future],
  };
}

export function redoSteps(
  state: EditorHistoryState,
  count: number,
): EditorHistoryState {
  const steps = Math.min(Math.max(0, count), state.future.length);
  if (steps === 0) {
    return state;
  }

  const redone = state.future.slice(0, steps);
  const nextFuture = state.future.slice(steps);
  const latestRedone = redone[redone.length - 1];

  if (latestRedone === undefined) {
    return state;
  }

  return {
    past: [...state.past, ...redone],
    present: latestRedone.after,
    future: nextFuture,
  };
}

export function resetHistory(
  newPresentation: Presentation,
): EditorHistoryState {
  return createHistoryState(newPresentation);
}
