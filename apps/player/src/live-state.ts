import { onValue, ref, set, type Database } from "firebase/database";

import type { Presentation } from "@powershow/document-schema";

import type { PlayerController } from "./player";

/**
 * Minimal Live projection-state protocol primitives for the Player.
 *
 * The parsers and path constants are the shared wire contract. The helper at
 * the end of the module drives the active Control -> Player projection state
 * using `live/controlState` and `live/playerState`.
 */

export interface LiveControlState {
  activationRevision: number;
  currentVersionId: string;
  revision: number;
  pageId: string;
}

export interface LivePlayerState {
  activationRevision: number;
  currentVersionId: string;
  appliedControlRevision: number;
  pageId: string;
  pageIndex: number;
}

export const CONTROL_STATE_PATH = "live/controlState";

export const PLAYER_STATE_PATH = "live/playerState";

function isNonNegativeInteger(value: unknown): boolean {
  return (
    typeof value === "number" &&
    Number.isFinite(value) &&
    Number.isInteger(value) &&
    value >= 0
  );
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim() !== "";
}

function parsePositiveInteger(value: unknown): number | null {
  return isNonNegativeInteger(value) && (value as number) >= 1
    ? (value as number)
    : null;
}

/**
 * Parse and validate `live/controlState`. Rejects malformed values and any
 * unexpected extra key. Returned strings are trimmed.
 */
export function parseLiveControlState(value: unknown): LiveControlState | null {
  if (typeof value !== "object" || value === null) return null;
  const record = value as Record<string, unknown>;
  if (Object.keys(record).length !== 4) return null;

  if (!isNonNegativeInteger(record.activationRevision)) return null;
  if (!isNonEmptyString(record.currentVersionId)) return null;

  const revision = parsePositiveInteger(record.revision);
  if (revision === null) return null;

  if (!isNonEmptyString(record.pageId)) return null;

  return {
    activationRevision: record.activationRevision as number,
    currentVersionId: (record.currentVersionId as string).trim(),
    revision,
    pageId: (record.pageId as string).trim(),
  };
}

/**
 * Parse and validate `live/playerState`. Rejects malformed values and any
 * unexpected extra key. Returned strings are trimmed.
 */
export function parseLivePlayerState(value: unknown): LivePlayerState | null {
  if (typeof value !== "object" || value === null) return null;
  const record = value as Record<string, unknown>;
  if (Object.keys(record).length !== 5) return null;

  if (!isNonNegativeInteger(record.activationRevision)) return null;
  if (!isNonEmptyString(record.currentVersionId)) return null;
  if (!isNonNegativeInteger(record.appliedControlRevision)) return null;
  if (!isNonEmptyString(record.pageId)) return null;
  if (!isNonNegativeInteger(record.pageIndex)) return null;

  return {
    activationRevision: record.activationRevision as number,
    currentVersionId: (record.currentVersionId as string).trim(),
    appliedControlRevision: record.appliedControlRevision as number,
    pageId: (record.pageId as string).trim(),
    pageIndex: record.pageIndex as number,
  };
}

interface PendingAppliedControlState {
  revision: number;
}

function getCurrentPage(
  presentation: Presentation,
  controller: PlayerController,
): { pageId: string; pageIndex: number } | null {
  const pageIndex = controller.getCurrentIndex();
  const pageId = presentation.slides[pageIndex]?.id ?? null;

  if (pageId === null) {
    return null;
  }

  return { pageId, pageIndex };
}

/**
 * Subscribes to `live/controlState`, publishes the Player baseline state, and
 * emits `live/playerState` only after the current slide has been rendered.
 */
export function subscribeLiveProjectionState(
  database: Database,
  activationRevision: number,
  currentVersionId: string,
  presentation: Presentation,
  controller: PlayerController,
  logsEnabled = false,
): () => void {
  let pendingFrame: number | null = null;
  let tornDown = false;
  let lastAppliedControlRevision = 0;
  let pendingAppliedControlState: PendingAppliedControlState | null = null;

  function publishPlayerState(appliedControlRevision: number): void {
    const current = getCurrentPage(presentation, controller);

    if (current === null) {
      console.error(
        "[PowerShow][live-state] could not resolve a pageId for the current page",
      );
      return;
    }

    void set(ref(database, PLAYER_STATE_PATH), {
      activationRevision,
      currentVersionId,
      appliedControlRevision,
      pageId: current.pageId,
      pageIndex: current.pageIndex,
    }).catch((error: unknown) => {
      console.error("[PowerShow][live-state] player state write failed", error);
    });
  }

  function schedulePublish(): void {
    if (pendingFrame !== null) {
      return;
    }

    pendingFrame = requestAnimationFrame(() => {
      pendingFrame = null;

      if (tornDown) {
        return;
      }

      if (pendingAppliedControlState === null) {
        return;
      }

      publishPlayerState(pendingAppliedControlState.revision);
    });
  }

  if (logsEnabled) {
    console.log("[PowerShow][live-state] subscribing", {
      controlPath: CONTROL_STATE_PATH,
      playerPath: PLAYER_STATE_PATH,
      activationRevision,
      currentVersionId,
    });
  }

  publishPlayerState(0);

  const unsubscribe = onValue(
    ref(database, CONTROL_STATE_PATH),
    (snapshot) => {
      const controlState = parseLiveControlState(snapshot.val());

      if (controlState === null) {
        return;
      }

      if (controlState.activationRevision !== activationRevision) {
        return;
      }

      if (controlState.currentVersionId !== currentVersionId) {
        return;
      }

      if (controlState.revision < lastAppliedControlRevision) {
        return;
      }

      const pageIndex = presentation.slides.findIndex(
        (slide) => slide.id === controlState.pageId,
      );

      if (pageIndex < 0) {
        console.warn(
          "[PowerShow][live-state] ignoring control state for unknown pageId",
          controlState.pageId,
        );
        return;
      }

      if (controlState.revision > lastAppliedControlRevision) {
        if (controller.getCurrentIndex() !== pageIndex) {
          controller.goTo(pageIndex);
        }

        lastAppliedControlRevision = controlState.revision;
      }

      pendingAppliedControlState = {
        revision: controlState.revision,
      };
      schedulePublish();
    },
    (error: Error) => {
      console.error("[PowerShow][live-state] subscription error", error);
    },
  );

  return () => {
    tornDown = true;

    if (pendingFrame !== null) {
      cancelAnimationFrame(pendingFrame);
      pendingFrame = null;
    }

    pendingAppliedControlState = null;
    unsubscribe();
  };
}
