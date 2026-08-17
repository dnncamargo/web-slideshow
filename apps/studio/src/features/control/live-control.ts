import type {
  LiveControlState,
  LivePlayerState,
} from "../live/live-state";

export const COALESCE_DELAY_MS = 75;

export type LiveControlStatus =
  | { kind: "awaiting-player" }
  | { kind: "syncing" }
  | { kind: "synced"; latencyMs?: number };

export interface LiveControlView {
  enabled: boolean;
  confirmedPageId: string | null;
  confirmedPageIndex: number;
  status: LiveControlStatus;
}

export interface LiveControlOptions {
  activationRevision: number;
  currentVersionId: string;
  resolvePageId(pageIndex: number): string | null;
  resolvePageIndex(pageId: string): number | null;
  writeControlState(pageIndex: number): Promise<LiveControlState>;
  now(): number;
  schedule(callback: () => void, delayMs: number): () => void;
  onViewChange(view: LiveControlView): void;
  onCommandError(): void;
}

interface PersistedDesiredState {
  pageId: string;
  revision: number;
}

interface ActualPlayerState {
  pageId: string;
  pageIndex: number;
  appliedControlRevision: number;
}

interface PendingCommand {
  targetPageId: string;
  targetPageIndex: number | null;
  revision: number | null;
  startedAt: number;
}

function samePageId(a: string | null, b: string | null): boolean {
  return a !== null && b !== null && a === b;
}

/**
 * Drives the live projection contract for the Studio Control surface.
 *
 * `controlState` is the persisted desired target. `playerState` is the actual
 * applied target. The class keeps one local draft target in flight at a time,
 * preserves the existing coalescing window, and only marks a write as
 * converged when Player publishes the same revision and pageId.
 */
export class LiveControl {
  private persistedDesired: PersistedDesiredState | null = null;
  private draftTargetPageId: string | null = null;
  private draftTargetPageIndex: number | null = null;
  private draftDirty = false;
  private actual: ActualPlayerState | null = null;
  private hasPlayerBaseline = false;
  private latencyMs: number | undefined;
  private pending: PendingCommand | null = null;
  private trailingCancel: (() => void) | null = null;
  private lastConfirmedPlayerRevision: number | null = null;
  private earlyConfirmedPlayerState: LivePlayerState | null = null;
  private destroyed = false;

  constructor(private readonly options: LiveControlOptions) {
    this.notify();
  }

  previous(): void {
    const baseIndex = this.getNavigationBaseIndex();

    if (baseIndex === null) {
      return;
    }

    this.requestTarget(Math.max(0, baseIndex - 1));
  }

  next(): void {
    const baseIndex = this.getNavigationBaseIndex();

    if (baseIndex === null) {
      return;
    }

    this.requestTarget(baseIndex + 1);
  }

  handleControlState(state: LiveControlState): void {
    if (this.destroyed) {
      return;
    }

    if (state.activationRevision !== this.options.activationRevision) {
      return;
    }

    if (state.currentVersionId !== this.options.currentVersionId) {
      return;
    }

    if (
      this.persistedDesired !== null &&
      state.revision < this.persistedDesired.revision
    ) {
      return;
    }

    const nextDesired = {
      pageId: state.pageId,
      revision: state.revision,
    };

    const changed = !this.persistedDesired
      ? true
      : this.persistedDesired.pageId !== nextDesired.pageId ||
        this.persistedDesired.revision !== nextDesired.revision;

    this.persistedDesired = nextDesired;

    if (!this.draftDirty && this.pending === null) {
      this.draftTargetPageId = state.pageId;
      this.draftTargetPageIndex = this.options.resolvePageIndex(state.pageId);
    }

    if (changed) {
      this.latencyMs = undefined;
    }

    this.notify();
  }

  handlePlayerState(state: LivePlayerState): void {
    if (this.destroyed) {
      return;
    }

    if (state.activationRevision !== this.options.activationRevision) {
      return;
    }

    if (state.currentVersionId !== this.options.currentVersionId) {
      return;
    }

    if (
      this.lastConfirmedPlayerRevision !== null &&
      state.appliedControlRevision <= this.lastConfirmedPlayerRevision
    ) {
      return;
    }

    this.hasPlayerBaseline = true;
    this.actual = {
      pageId: state.pageId,
      pageIndex: state.pageIndex,
      appliedControlRevision: state.appliedControlRevision,
    };

    if (this.persistedDesired === null) {
      this.persistedDesired = {
        pageId: state.pageId,
        revision: 0,
      };
      this.draftTargetPageId = state.pageId;
      this.draftTargetPageIndex = state.pageIndex;
      this.draftDirty = false;
      this.lastConfirmedPlayerRevision = 0;
      this.latencyMs = undefined;
      this.cancelTrailing();
      this.notify();
      return;
    }

    if (
      this.pending !== null &&
      this.pending.revision === null &&
      this.pending.targetPageId === state.pageId &&
      this.pending.targetPageIndex === state.pageIndex
    ) {
      this.earlyConfirmedPlayerState = state;
      this.notify();
      return;
    }

    if (
      this.pending !== null &&
      this.pending.revision !== null &&
      this.pending.revision === state.appliedControlRevision &&
      this.pending.targetPageId === state.pageId
    ) {
      this.confirmPending(state);
      return;
    }

    const isPersistedExact =
      this.pending === null &&
      this.draftDirty === false &&
      this.persistedDesired.pageId === state.pageId &&
      this.persistedDesired.revision === state.appliedControlRevision;

    if (isPersistedExact) {
      this.lastConfirmedPlayerRevision = state.appliedControlRevision;
      this.latencyMs = undefined;
      this.notify();
      return;
    }

    this.notify();
  }

  destroy(): void {
    this.destroyed = true;
    this.cancelTrailing();
    this.pending = null;
    this.earlyConfirmedPlayerState = null;
  }

  private requestTarget(index: number): void {
    if (!this.hasPlayerBaseline) {
      return;
    }

    const pageId = this.options.resolvePageId(index);

    if (pageId === null) {
      return;
    }

    this.draftTargetPageId = pageId;
    this.draftTargetPageIndex = index;
    this.draftDirty = !samePageId(this.persistedDesired?.pageId ?? null, pageId);

    if (this.pending !== null) {
      this.latencyMs = undefined;
      this.notify();
      return;
    }

    if (!this.draftDirty) {
      this.cancelTrailing();
      this.notify();
      return;
    }

    this.latencyMs = undefined;
    this.scheduleTrailing();
  }

  private getNavigationBaseIndex(): number | null {
    const draftIndex =
      this.draftTargetPageIndex ??
      (this.draftTargetPageId !== null
        ? this.options.resolvePageIndex(this.draftTargetPageId)
        : null);

    if (draftIndex !== null) {
      return draftIndex;
    }

    if (this.persistedDesired !== null) {
      return this.options.resolvePageIndex(this.persistedDesired.pageId);
    }

    return this.actual?.pageIndex ?? null;
  }

  private scheduleTrailing(): void {
    this.cancelTrailing();
    this.trailingCancel = this.options.schedule(() => {
      this.trailingCancel = null;
      void this.flush();
    }, COALESCE_DELAY_MS);
  }

  private cancelTrailing(): void {
    if (this.trailingCancel) {
      this.trailingCancel();
      this.trailingCancel = null;
    }
  }

  private async flush(): Promise<void> {
    if (this.destroyed || this.pending !== null) {
      return;
    }

    if (!this.draftDirty || this.draftTargetPageId === null) {
      return;
    }

    const targetPageId = this.draftTargetPageId;
    const targetPageIndex = this.draftTargetPageIndex;

    if (samePageId(this.persistedDesired?.pageId ?? null, targetPageId)) {
      this.draftDirty = false;
      return;
    }

    this.pending = {
      targetPageId,
      targetPageIndex,
      revision: null,
      startedAt: this.options.now(),
    };

    try {
      const writePromise = this.options.writeControlState(
        targetPageIndex ?? this.actual?.pageIndex ?? 0,
      );

      this.notify();

      const committed = await writePromise;

      if (this.destroyed) {
        return;
      }

      if (this.pending?.targetPageId !== targetPageId) {
        return;
      }

      this.pending = {
        ...this.pending,
        revision: committed.revision,
      };

      this.persistedDesired = {
        pageId: committed.pageId,
        revision: committed.revision,
      };

      this.draftDirty = !samePageId(this.draftTargetPageId, committed.pageId);
      this.latencyMs = undefined;

      const earlyConfirmed = this.earlyConfirmedPlayerState;

      if (
        earlyConfirmed !== null &&
        earlyConfirmed.appliedControlRevision === committed.revision &&
        earlyConfirmed.pageId === committed.pageId
      ) {
        this.confirmPending(earlyConfirmed);
      }
    } catch {
      if (this.destroyed) {
        return;
      }

      if (this.pending?.targetPageId === targetPageId) {
        this.pending = null;
        this.earlyConfirmedPlayerState = null;
        this.draftDirty = false;
        this.draftTargetPageId = this.persistedDesired?.pageId ?? this.actual?.pageId ?? null;
        this.draftTargetPageIndex = this.persistedDesired
          ? this.options.resolvePageIndex(this.persistedDesired.pageId)
          : this.actual?.pageIndex ?? null;
        this.latencyMs = undefined;
        this.options.onCommandError();
        this.notify();
      }
    }
  }

  private confirmPending(state: LivePlayerState): void {
    if (
      this.pending === null ||
      this.pending.revision !== state.appliedControlRevision ||
      this.pending.targetPageId !== state.pageId
    ) {
      return;
    }

    this.lastConfirmedPlayerRevision = state.appliedControlRevision;
    this.latencyMs = Math.max(0, this.options.now() - this.pending.startedAt);
    this.actual = {
      pageId: state.pageId,
      pageIndex: state.pageIndex,
      appliedControlRevision: state.appliedControlRevision,
    };
    this.pending = null;
    this.earlyConfirmedPlayerState = null;

    this.notify();

    if (this.draftDirty) {
      this.scheduleTrailing();
    }
  }

  private notify(): void {
    if (this.destroyed) {
      return;
    }

    this.options.onViewChange({
      enabled: this.hasPlayerBaseline,
      confirmedPageId: this.actual?.pageId ?? null,
      confirmedPageIndex: this.actual?.pageIndex ?? 0,
      status: this.computeStatus(),
    });
  }

  private computeStatus(): LiveControlStatus {
    if (!this.hasPlayerBaseline) {
      return { kind: "awaiting-player" };
    }

    if (this.pending !== null) {
      return { kind: "syncing" };
    }

    if (
      this.persistedDesired !== null &&
      this.actual !== null &&
      this.actual.pageId === this.persistedDesired.pageId &&
      this.actual.appliedControlRevision === this.persistedDesired.revision
    ) {
      if (this.latencyMs !== undefined) {
        return { kind: "synced", latencyMs: this.latencyMs };
      }

      return { kind: "synced" };
    }

    return { kind: "syncing" };
  }
}
