"use client";

import { useEffect, useState } from "react";
import { onValue, ref } from "firebase/database";

import type { Presentation, Slide } from "@powershow/document-schema";

import type { LiveCurrent } from "../control/live-current";
import { subscribeLiveCurrent } from "../control/live-current";
import { getRealtimeDatabaseOrNull } from "../control/realtime-db";
import {
  buildPlayerStatePath,
  parseLivePlayerState,
  type LivePlayerState,
} from "../live/live-state";
import { getDefaultPublishedPresentationReader } from "../persistence/published-presentation-reader-instance";

/**
 * Watch is a read-only projection consumer. It follows ONLY the actual
 * applied state owned by Player (the `live/playerState` stream). It never
 * subscribes to the Control-owned desired state stream, never writes to the
 * Realtime Database, and never uses the public publication pointer.
 *
 * A playerState is usable only when it matches the active `live/current`
 * identity: `activationRevision === live.revision` and
 * `currentVersionId === live.currentVersionId`. Anything else is stale and is
 * never rendered as current truth.
 */
export type WatchViewState =
  | { kind: "no-live" }
  | { kind: "waiting-player" }
  | { kind: "loading-version" }
  | { kind: "version-error" }
  | { kind: "ready"; presentation: Presentation; slide: Slide };

interface VersionLoad {
  /** Identity the stored presentation/state belongs to. */
  identityKey: string | null;
  pending: boolean;
  error: boolean;
  presentation: Presentation | null;
}

const EMPTY_VERSION_LOAD: VersionLoad = {
  identityKey: null,
  pending: false,
  error: false,
  presentation: null,
};

/**
 * A playerState is usable only when it matches the active `live/current`
 * identity. Revalidated during every render, so retained state from a previous
 * identity can never be presented under the current one, even transiently
 * before the identity-keyed effects clear it.
 */
function matchesLiveIdentity(
  playerState: LivePlayerState,
  live: LiveCurrent,
): boolean {
  return (
    playerState.activationRevision === live.revision &&
    playerState.currentVersionId === live.currentVersionId
  );
}

/**
 * Resolve the slide actually applied by Player: `pageId` is canonical.
 * `pageIndex` is intentionally never used as authority. When the pageId is
 * missing from the immutable version, Watch stays on the waiting state instead
 * of falling back to another slide.
 */
function resolveAppliedSlide(
  presentation: Presentation,
  playerState: LivePlayerState,
): Slide | null {
  return (
    presentation.slides.find((slide) => slide.id === playerState.pageId) ?? null
  );
}

export function useWatchSession(): WatchViewState {
  const [liveKind, setLiveKind] = useState<
    "loading" | "none" | "active" | "error"
  >("loading");
  const [liveCurrent, setLiveCurrent] = useState<LiveCurrent | null>(null);

  useEffect(() => {
    const unsubscribe = subscribeLiveCurrent((nextState) => {
      setLiveKind(nextState.kind);
      setLiveCurrent(nextState.kind === "active" ? nextState.live : null);
    });

    return () => unsubscribe?.();
  }, []);

  const activeLive = liveKind === "active" ? liveCurrent : null;
  const identityKey = activeLive
    ? `${activeLive.publicationId}:${activeLive.currentVersionId}:${activeLive.revision}`
    : null;

  const [player, setPlayer] = useState<LivePlayerState | null>(null);
  const [version, setVersion] = useState<VersionLoad>(EMPTY_VERSION_LOAD);

  // ----------------------------------------------------------
  // `live/playerState` subscription, scoped to the current Live identity.
  // A snapshot that no longer matches the active identity is treated as stale
  // and never presented.
  // ----------------------------------------------------------

  useEffect(() => {
    setPlayer(null);

    if (activeLive === null) {
      return;
    }

    const db = getRealtimeDatabaseOrNull();
    if (db === null) {
      return;
    }

    return onValue(ref(db, buildPlayerStatePath()), (snapshot) => {
      const parsed = parseLivePlayerState(snapshot.val());

      setPlayer(
        parsed !== null &&
          parsed.activationRevision === activeLive.revision &&
          parsed.currentVersionId === activeLive.currentVersionId
          ? parsed
          : null,
      );
    });
  }, [identityKey]);

  // ----------------------------------------------------------
  // Immutable version loading for the exact `live/current` identity.
  //
  // The load is scoped to the effect run that started it: when the identity
  // changes (for example V1 -> V2), the previous run is cancelled, so a late
  // V1 result can never replace the V2 state.
  // ----------------------------------------------------------

  useEffect(() => {
    if (activeLive === null) {
      setVersion(EMPTY_VERSION_LOAD);
      return;
    }

    let activeLoad = true;
    setVersion({
      identityKey,
      pending: true,
      error: false,
      presentation: null,
    });

    const reader = getDefaultPublishedPresentationReader();

    void reader
      .getVersion(activeLive.publicationId, activeLive.currentVersionId)
      .then((loaded) => {
        if (!activeLoad) {
          return;
        }

        if (loaded === null) {
          setVersion({
            identityKey,
            pending: false,
            error: true,
            presentation: null,
          });
          return;
        }

        setVersion({
          identityKey,
          pending: false,
          error: false,
          presentation: loaded,
        });
      })
      .catch(() => {
        if (!activeLoad) {
          return;
        }

        setVersion({
          identityKey,
          pending: false,
          error: true,
          presentation: null,
        });
      });

    return () => {
      activeLoad = false;
    };
  }, [identityKey]);

  if (liveKind !== "active") {
    return { kind: "no-live" };
  }

  // Derivation-time identity revalidation: a playerState or version state
  // retained from a previous identity is never usable under the current one.
  // This closes the transient window on an active V1 -> active V2 transition
  // before the identity-keyed effects run, and guarantees a V2 playerState can
  // never resolve against a still-retained V1 presentation.
  const usablePlayer =
    activeLive !== null &&
    player !== null &&
    matchesLiveIdentity(player, activeLive)
      ? player
      : null;
  const usableVersion = version.identityKey === identityKey ? version : null;

  if (usablePlayer === null) {
    return { kind: "waiting-player" };
  }

  if (usableVersion === null || usableVersion.pending) {
    return { kind: "loading-version" };
  }

  if (usableVersion.error || usableVersion.presentation === null) {
    return { kind: "version-error" };
  }

  const slide = resolveAppliedSlide(usableVersion.presentation, usablePlayer);

  if (slide === null) {
    return { kind: "waiting-player" };
  }

  return {
    kind: "ready",
    presentation: usableVersion.presentation,
    slide,
  };
}
