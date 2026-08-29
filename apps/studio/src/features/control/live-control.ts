import type { LiveControlState, LivePlayerState } from "../live/live-state";

export const COALESCE_DELAY_MS = 75;

export type LiveControlStatus =
  | { kind: "awaiting-player" }
  | { kind: "syncing" }
  | { kind: "player-changed" }
  | { kind: "synced"; latencyMs?: number };

export interface LiveControlView {
  enabled: boolean;
  desiredPageId: string | null;
  desiredPageIndex: number | null;
  actualPageId: string | null;
  actualPageIndex: number | null;
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
  appliedControlRevision: number;
}

/** A controlState write whose RTDB transaction has not resolved yet. */
interface InFlightWrite {
  targetPageId: string;
  startedAt: number;
}

/** Latency probe for the current persisted desired revision until confirmed. */
interface ConfirmationWindow {
  revision: number;
  pageId: string;
  startedAt: number;
}

function samePageId(a: string | null, b: string | null): boolean {
  return a !== null && b !== null && a === b;
}

/**
 * Drives the live projection contract for the Studio Control surface.
 *
 * `controlState` is the persisted desired target. `playerState` is the actual
 * applied target. `pageId` is the canonical identity throughout; `pageIndex`
 * is always derived through `resolvePageIndex(pageId)` and never trusted from
 * a reported `playerState.pageIndex`. Control stays fully navigable while
 * Syncing: a committed write becomes `persistedDesired` as soon as its RTDB
 * transaction resolves, without waiting for Player confirmation. Navigation
 * always proceeds from the latest local draft desired, then the latest
 * persisted desired, then the actual Player page. At most one write Promise is
 * in flight at a time; a newer dirty draft is flushed after the coalescing
 * window once the current write resolves.
 */
export class LiveControl {
  private persistedDesired: PersistedDesiredState | null = null;
  private draftTargetPageId: string | null = null;
  private draftDirty = false;
  private actual: ActualPlayerState | null = null;
  private hasPlayerBaseline = false;
  private latencyMs: number | undefined;
  private writeInFlight: InFlightWrite | null = null;
  private confirmationWindow: ConfirmationWindow | null = null;
  private trailingCancel: (() => void) | null = null;
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

  goTo(index: number): void {
    this.requestTarget(index);
  }

  /**
   * Create a new desired generation targeting the Player's actual page. Used
   * by the player-changed "Follow Player" action. Does not silently mutate the
   * existing desired state; it writes a fresh controlState revision.
   *
   * The target index is resolved from the canonical `actual.pageId`. A
   * mismatched reported `playerState.pageIndex` is never used, and an
   * unresolvable pageId fails closed without writing.
   */
  followPlayer(): void {
    if (!this.hasPlayerBaseline || this.actual === null) {
      return;
    }

    const index = this.options.resolvePageIndex(this.actual.pageId);

    if (index === null) {
      return;
    }

    this.requestTarget(index);
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

    if (!this.draftDirty && this.writeInFlight === null) {
      this.draftTargetPageId = state.pageId;
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

    this.hasPlayerBaseline = true;
    this.actual = {
      pageId: state.pageId,
      appliedControlRevision: state.appliedControlRevision,
    };

    if (this.persistedDesired === null) {
      this.persistedDesired = {
        pageId: state.pageId,
        revision: 0,
      };
      this.draftTargetPageId = state.pageId;
      this.draftDirty = false;
      this.latencyMs = undefined;
      this.cancelTrailing();
      this.notify();
      return;
    }

    // A Player confirmation of the in-flight write's target before the writer
    // resolves is retained so latency can be measured once the revision is
    // known.
    if (
      this.writeInFlight !== null &&
      this.writeInFlight.targetPageId === state.pageId
    ) {
      this.earlyConfirmedPlayerState = state;
      this.notify();
      return;
    }

    // Confirmation of the current persisted desired revision/page.
    if (
      this.confirmationWindow !== null &&
      this.confirmationWindow.revision === state.appliedControlRevision &&
      this.confirmationWindow.pageId === state.pageId
    ) {
      this.latencyMs = Math.max(
        0,
        this.options.now() - this.confirmationWindow.startedAt,
      );
      this.confirmationWindow = null;
      this.notify();
      return;
    }

    this.notify();
  }

  destroy(): void {
    this.destroyed = true;
    this.cancelTrailing();
    this.writeInFlight = null;
    this.confirmationWindow = null;
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
    this.draftDirty = !samePageId(
      this.persistedDesired?.pageId ?? null,
      pageId,
    );

    if (!this.draftDirty) {
      this.cancelTrailing();
      this.notify();
      return;
    }

    this.latencyMs = undefined;

    if (this.writeInFlight !== null) {
      // A newer draft is retained; it will be flushed once the current write
      // resolves, without waiting for Player confirmation.
      this.notify();
      return;
    }

    this.scheduleTrailing();
    this.notify();
  }

  private getNavigationBaseIndex(): number | null {
    if (this.draftTargetPageId !== null) {
      const index = this.options.resolvePageIndex(this.draftTargetPageId);

      if (index !== null) {
        return index;
      }
    }

    if (this.persistedDesired !== null) {
      const index = this.options.resolvePageIndex(this.persistedDesired.pageId);

      if (index !== null) {
        return index;
      }
    }

    if (this.actual !== null) {
      return this.options.resolvePageIndex(this.actual.pageId);
    }

    return null;
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
    if (this.destroyed || this.writeInFlight !== null) {
      return;
    }

    if (!this.draftDirty || this.draftTargetPageId === null) {
      return;
    }

    const targetPageId = this.draftTargetPageId;

    if (samePageId(this.persistedDesired?.pageId ?? null, targetPageId)) {
      this.draftDirty = false;
      return;
    }

    const targetIndex = this.options.resolvePageIndex(targetPageId);

    if (targetIndex === null) {
      // The canonical target page cannot be mapped; fail closed without
      // writing from any reported pageIndex.
      return;
    }

    const startedAt = this.options.now();
    this.writeInFlight = {
      targetPageId,
      startedAt,
    };

    this.notify();

    try {
      const committed = await this.options.writeControlState(targetIndex);

      if (this.destroyed) {
        return;
      }

      if (this.writeInFlight?.targetPageId !== targetPageId) {
        return;
      }

      this.writeInFlight = null;
      this.persistedDesired = {
        pageId: committed.pageId,
        revision: committed.revision,
      };
      this.draftDirty = !samePageId(this.draftTargetPageId, committed.pageId);
      this.confirmationWindow = {
        revision: committed.revision,
        pageId: committed.pageId,
        startedAt,
      };
      this.latencyMs = undefined;

      const earlyConfirmed = this.earlyConfirmedPlayerState;

      if (
        earlyConfirmed !== null &&
        earlyConfirmed.appliedControlRevision === committed.revision &&
        earlyConfirmed.pageId === committed.pageId
      ) {
        this.latencyMs = Math.max(0, this.options.now() - startedAt);
        this.confirmationWindow = null;
      }

      this.earlyConfirmedPlayerState = null;
      this.notify();

      if (this.draftDirty) {
        this.scheduleTrailing();
      }
    } catch {
      if (this.destroyed) {
        return;
      }

      if (this.writeInFlight?.targetPageId === targetPageId) {
        this.writeInFlight = null;
        this.earlyConfirmedPlayerState = null;
        this.draftDirty = false;
        this.draftTargetPageId =
          this.persistedDesired?.pageId ?? this.actual?.pageId ?? null;
        this.latencyMs = undefined;
        this.options.onCommandError();
        this.notify();
      }
    }
  }

  private computeDesiredPageId(): string | null {
    if (this.draftTargetPageId !== null) {
      return this.draftTargetPageId;
    }

    return this.persistedDesired?.pageId ?? null;
  }

  private computeDesiredPageIndex(): number | null {
    const pageId = this.computeDesiredPageId();

    if (pageId === null) {
      return null;
    }

    return this.options.resolvePageIndex(pageId);
  }

  private computeActualPageIndex(): number | null {
    if (this.actual === null) {
      return null;
    }

    return this.options.resolvePageIndex(this.actual.pageId);
  }

  private notify(): void {
    if (this.destroyed) {
      return;
    }

    this.options.onViewChange({
      enabled: this.hasPlayerBaseline,
      desiredPageId: this.computeDesiredPageId(),
      desiredPageIndex: this.computeDesiredPageIndex(),
      actualPageId: this.actual?.pageId ?? null,
      actualPageIndex: this.computeActualPageIndex(),
      status: this.computeStatus(),
    });
  }

  private computeStatus(): LiveControlStatus {
    if (!this.hasPlayerBaseline) {
      return { kind: "awaiting-player" };
    }

    const hasNewerDesired =
      this.draftDirty ||
      this.writeInFlight !== null ||
      (this.persistedDesired !== null &&
        this.actual !== null &&
        this.actual.appliedControlRevision < this.persistedDesired.revision);

    if (hasNewerDesired) {
      return { kind: "syncing" };
    }

    if (this.persistedDesired === null || this.actual === null) {
      return { kind: "syncing" };
    }

    const revisionMatch =
      this.actual.appliedControlRevision === this.persistedDesired.revision;

    if (revisionMatch && this.actual.pageId === this.persistedDesired.pageId) {
      if (this.latencyMs !== undefined) {
        return { kind: "synced", latencyMs: this.latencyMs };
      }

      return { kind: "synced" };
    }

    if (revisionMatch) {
      // Player applied the latest Control generation but its visual page
      // changed independently afterwards.
      return { kind: "player-changed" };
    }

    return { kind: "syncing" };
  }
}
