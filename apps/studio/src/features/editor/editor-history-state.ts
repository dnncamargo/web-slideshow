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
  readonly transaction?: HistoryTransaction;
}

export interface HistoryTransaction {
  readonly key: string;
  readonly baseline: Presentation;
  readonly action: HistoryActionMeta;
}

export function createHistoryState(present: Presentation): EditorHistoryState {
  return { past: [], present, future: [] };
}

export function beginHistoryTransaction(
  state: EditorHistoryState,
  key: string,
  action: HistoryActionMeta,
): EditorHistoryState {
  if (state.transaction?.key === key) return state;
  const finalized = state.transaction === undefined
    ? state
    : commitHistoryTransaction(state);
  return { ...finalized, transaction: { key, baseline: finalized.present, action } };
}

export function updateHistoryTransaction(
  state: EditorHistoryState,
  key: string,
  nextPresentation: Presentation,
): EditorHistoryState {
  if (state.transaction?.key !== key || nextPresentation === state.present) {
    return state;
  }
  return { ...state, present: nextPresentation };
}

export function commitHistoryTransaction(
  state: EditorHistoryState,
  key?: string,
): EditorHistoryState {
  const transaction = state.transaction;
  if (transaction === undefined || (key !== undefined && transaction.key !== key)) {
    return state;
  }
  const { transaction: _transaction, ...cleared } = state;
  if (state.present === transaction.baseline) return cleared;
  return commitHistoryFrom(cleared, transaction.baseline, state.present, transaction.action);
}

export function cancelHistoryTransaction(
  state: EditorHistoryState,
  key?: string,
): EditorHistoryState {
  const transaction = state.transaction;
  if (transaction === undefined || (key !== undefined && transaction.key !== key)) {
    return state;
  }
  const { transaction: _transaction, ...withoutTransaction } = state;
  return { ...withoutTransaction, present: transaction.baseline };
}

/** Applies the temporary CP2 boundary for authoring surfaces not yet tracked. */
export function applyUntrackedHistoryUpdate(
  state: EditorHistoryState,
  nextPresentation: Presentation,
): EditorHistoryState {
  return nextPresentation === state.present ? state : resetHistory(nextPresentation);
}

function commitHistoryFrom(
  state: EditorHistoryState,
  before: Presentation,
  after: Presentation,
  action: HistoryActionMeta,
): EditorHistoryState {
  const nextPast = [...state.past, { before, after, action }];
  return {
    past: nextPast.length > EDITOR_HISTORY_LIMIT
      ? nextPast.slice(nextPast.length - EDITOR_HISTORY_LIMIT)
      : nextPast,
    present: after,
    future: [],
  };
}

export function commitHistory(
  state: EditorHistoryState,
  nextPresentation: Presentation,
  action: HistoryActionMeta,
): EditorHistoryState {
  if (nextPresentation === state.present) {
    return state;
  }

  return commitHistoryFrom(state, state.present, nextPresentation, action);
}

export function undoHistory(state: EditorHistoryState): EditorHistoryState {
  return undoSteps(commitHistoryTransaction(state), 1);
}

export function redoHistory(state: EditorHistoryState): EditorHistoryState {
  return redoSteps(commitHistoryTransaction(state), 1);
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
