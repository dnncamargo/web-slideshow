import type { SlideAck, SlideCommand } from "./control-commands";

export const COALESCE_DELAY_MS = 75;

export type LiveControlStatus =
  | { kind: "awaiting-player" }
  | { kind: "syncing" }
  | { kind: "synced"; latencyMs?: number };

export interface LiveControlView {
  enabled: boolean;
  confirmedIndex: number;
  status: LiveControlStatus;
}

export interface LiveControlOptions {
  activationRevision: number;
  currentVersionId: string;
  writeCommand(slideIndex: number): Promise<SlideCommand>;
  now(): number;
  schedule(callback: () => void, delayMs: number): () => void;
  onViewChange(view: LiveControlView): void;
  onCommandError(): void;
}

interface PendingCommand {
  target: number;
  revision: number | null;
  startedAt: number;
}

/**
 * Drives the live slide protocol for the Studio Control surface.
 *
 * Confirmed index only ever comes from a matching Player ACK. The desired index
 * derives from the confirmed index and coalesces user input. At most one
 * unacknowledged command is in flight at a time.
 */
export class LiveControl {
  private confirmedIndex = 0;
  private desiredIndex = 0;
  private hasBaseline = false;
  private latencyMs: number | undefined;
  private pending: PendingCommand | null = null;
  private trailingCancel: (() => void) | null = null;
  private lastAcceptedAckRevision: number | null = null;
  private earlyAck: SlideAck | null = null;
  private destroyed = false;

  constructor(private readonly options: LiveControlOptions) {
    this.notify();
  }

  previous(): void {
    this.requestTarget(Math.max(0, this.desiredIndex - 1));
  }

  next(): void {
    this.requestTarget(this.desiredIndex + 1);
  }

  private applyPendingAck(ack: SlideAck): void {
    if (this.pending === null || this.pending.revision !== ack.revision) {
      return;
    }

    this.lastAcceptedAckRevision = ack.revision;
    this.latencyMs = Math.max(0, this.options.now() - this.pending.startedAt);

    this.confirmedIndex = ack.slideIndex;

    if (ack.slideIndex !== this.pending.target) {
      this.desiredIndex = ack.slideIndex;
    }

    this.pending = null;
    this.earlyAck = null;

    this.notify();

    if (this.desiredIndex !== this.confirmedIndex) {
      this.scheduleTrailing();
    }
  }

  handleAck(ack: SlideAck): void {
    if (this.destroyed) {
      return;
    }
    if (ack.activationRevision !== this.options.activationRevision) {
      return;
    }
    if (ack.currentVersionId !== this.options.currentVersionId) {
      return;
    }

    if (
      this.lastAcceptedAckRevision !== null &&
      ack.revision < this.lastAcceptedAckRevision
    ) {
      return;
    }

    // Control recém-aberto / recarregado:
    // qualquer ACK atual válido estabelece o estado confirmado.
    if (this.pending === null) {
      this.hasBaseline = true;
      this.lastAcceptedAckRevision = ack.revision;
      this.confirmedIndex = ack.slideIndex;
      this.desiredIndex = ack.slideIndex;
      this.latencyMs = undefined;
      this.cancelTrailing();
      this.notify();
      return;
    }

    // Comando já foi iniciado, mas o writer ainda não devolveu revision.
    if (this.pending.revision === null) {
      if (this.earlyAck === null || ack.revision >= this.earlyAck.revision) {
        this.earlyAck = ack;
      }

      return;
    }

    if (ack.revision !== this.pending.revision) {
      return;
    }

    this.applyPendingAck(ack);
  }

  destroy(): void {
    this.destroyed = true;
    this.cancelTrailing();
    this.pending = null;
    this.earlyAck = null;
  }

  private requestTarget(index: number): void {
    if (!this.hasBaseline) {
      return;
    }

    this.desiredIndex = index;

    if (this.pending !== null) {
      this.notify();
      return;
    }

    this.scheduleTrailing();
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

    if (this.desiredIndex === this.confirmedIndex) {
      return;
    }

    const target = this.desiredIndex;

    this.pending = {
      target,
      revision: null,
      startedAt: this.options.now(),
    };

    try {
      const writePromise = this.options.writeCommand(target);

      this.notify();

      const committed = await writePromise;

      if (this.destroyed) {
        return;
      }

      if (this.pending?.target !== target) {
        return;
      }

      this.pending = {
        ...this.pending,
        revision: committed.revision,
      };

      const earlyAck = this.earlyAck;

      if (earlyAck !== null && earlyAck.revision === committed.revision) {
        this.applyPendingAck(earlyAck);
      }
    } catch {
      if (this.destroyed) {
        return;
      }

      if (this.pending?.target === target) {
        this.pending = null;
        this.earlyAck = null;
        this.desiredIndex = this.confirmedIndex;
        this.options.onCommandError();
        this.notify();
      }
    }
  }

  private notify(): void {
    if (this.destroyed) {
      return;
    }
    this.options.onViewChange({
      enabled: this.hasBaseline,
      confirmedIndex: this.confirmedIndex,
      status: this.computeStatus(),
    });
  }

  private computeStatus(): LiveControlStatus {
    if (!this.hasBaseline) {
      return { kind: "awaiting-player" };
    }

    if (this.pending !== null) {
      return { kind: "syncing" };
    }

    if (this.latencyMs !== undefined) {
      return { kind: "synced", latencyMs: this.latencyMs };
    }

    return { kind: "synced" };
  }
}
