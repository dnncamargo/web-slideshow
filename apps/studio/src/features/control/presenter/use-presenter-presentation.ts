"use client";

import { useEffect, useState } from "react";

import { getDefaultPublishedPresentationReader } from "../../persistence/published-presentation-reader-instance";
import type { PublishedPresentationPointer } from "../../persistence/published-presentation-reader";

import type { LiveState } from "../live-current";
import {
  PresenterVersionLoader,
  canUsePointerObservation,
  projectPresenterVersions,
  type LoadedPresenterVersions,
  type PendingPublishedVersion,
  type PresenterVersionIdentity,
} from "./presenter-version-state";

export type PresenterPresentationState =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "error" }
  | {
      kind: "ready";
      presentation: LoadedPresenterVersions["previewPresentation"];
      livePresentation: LoadedPresenterVersions["livePresentation"];
      displayIndex: number | null;
      pendingVersion: PendingPublishedVersion | null;
    };

/**
 * Resolve the pageId for an outgoing Live navigation target.
 *
 * A queued navigation is scoped to `live/current.currentVersionId`, which is
 * always the immutable live presentation. It must never be resolved against the
 * newer staged preview (`presentation`), even when the Control UI is already
 * previewing it.
 */
export function resolveLivePageId(
  state: PresenterPresentationState | null,
  pageIndex: number,
): string | null {
  if (state?.kind !== "ready") {
    return null;
  }

  return state.livePresentation.slides[pageIndex]?.id ?? null;
}

interface PointerResult {
  publicationId: string;
  observedForLiveVersionId: string;
  pointer: PublishedPresentationPointer | null;
}

interface PresentationResult {
  identity: PresenterVersionIdentity;
  versions: LoadedPresenterVersions | null;
  error: boolean;
}

function sameIdentity(
  a: PresenterVersionIdentity,
  b: PresenterVersionIdentity,
): boolean {
  return (
    a.publicationId === b.publicationId &&
    a.liveVersionId === b.liveVersionId &&
    a.previewVersionId === b.previewVersionId
  );
}

/**
 * Resolves both persisted identities needed by Control: the version in
 * live/current and the newest version in the public publication pointer.
 * Pointer updates survive reload and converge across Control clients because
 * no pending state is kept in local storage or cross-tab messaging.
 */
export function usePresenterPresentation(
  liveState: LiveState,
  confirmedPageIndex: number | null,
): PresenterPresentationState {
  const reader = getDefaultPublishedPresentationReader();
  const [loader] = useState(() => new PresenterVersionLoader(reader));

  const [pointerResult, setPointerResult] = useState<PointerResult | null>(null);
  const [result, setResult] = useState<PresentationResult | null>(null);

  const publicationId =
    liveState.kind === "active" ? liveState.live.publicationId : null;
  const liveVersionId =
    liveState.kind === "active" ? liveState.live.currentVersionId : null;

  useEffect(() => {
    if (publicationId === null || liveVersionId === null) return;

    let active = true;
    const unsubscribe = reader.subscribePointer(
      publicationId,
      (pointer) => {
        if (active) {
          setPointerResult({
            publicationId,
            observedForLiveVersionId: liveVersionId,
            pointer,
          });
        }
      },
      () => {
        // Keep the last valid pointer on a listener error. With no prior value,
        // Control safely falls back to the version in live/current.
      },
    );

    return () => {
      active = false;
      unsubscribe();
    };
  }, [liveVersionId, publicationId, reader]);

  const pointer =
    publicationId !== null &&
    liveVersionId !== null &&
    pointerResult?.publicationId === publicationId &&
    canUsePointerObservation(
      pointerResult.observedForLiveVersionId,
      liveVersionId,
      pointerResult.pointer?.currentVersionId ?? null,
    )
      ? pointerResult.pointer
      : null;
  const previewVersionId =
    liveVersionId === null
      ? null
      : (pointer?.currentVersionId ?? liveVersionId);

  useEffect(() => {
    if (
      publicationId === null ||
      liveVersionId === null ||
      previewVersionId === null
    ) {
      loader.cancel();
      return;
    }

    const identity: PresenterVersionIdentity = {
      publicationId,
      liveVersionId,
      previewVersionId,
    };
    let active = true;

    void loader
      .load(identity)
      .then((versions) => {
        if (active && versions !== null) {
          setResult({ identity, versions, error: false });
        }
      })
      .catch(() => {
        if (active) {
          setResult({ identity, versions: null, error: true });
        }
      });

    return () => {
      active = false;
      loader.cancel();
    };
  }, [loader, liveVersionId, previewVersionId, publicationId]);

  if (liveState.kind !== "active") {
    return { kind: "idle" };
  }

  const identity: PresenterVersionIdentity = {
    publicationId: liveState.live.publicationId,
    liveVersionId: liveState.live.currentVersionId,
    previewVersionId: previewVersionId ?? liveState.live.currentVersionId,
  };

  if (result === null || !sameIdentity(result.identity, identity)) {
    return { kind: "loading" };
  }

  if (result.error || result.versions === null) {
    return { kind: "error" };
  }

  return {
    kind: "ready",
    livePresentation: result.versions.livePresentation,
    ...projectPresenterVersions(result.versions, confirmedPageIndex),
  };
}
