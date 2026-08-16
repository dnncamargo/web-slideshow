"use client";

import { useEffect, useRef, useState } from "react";

import type { Presentation } from "@powershow/document-schema";

import { getDefaultPublishedPresentationReader } from "@/features/persistence/published-presentation-reader-instance";

import type { LiveState } from "../live-current";

export type PresenterPresentationState =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "error" }
  | { kind: "ready"; presentation: Presentation };

interface PresentationResult {
  publicationId: string;
  currentVersionId: string;
  presentation: Presentation | null;
  error: boolean;
}

function sameVersion(
  a: { publicationId: string; currentVersionId: string },
  b: { publicationId: string; currentVersionId: string },
): boolean {
  return (
    a.publicationId === b.publicationId &&
    a.currentVersionId === b.currentVersionId
  );
}

/**
 * Resolves the immutable published Presentation currently active in Live.
 *
 * Reads exactly the active version (live publicationId + currentVersionId)
 * through the PublishedPresentationReader. It never loads a private draft,
 * never subscribes to Firestore, never caches versions, and never writes.
 *
 * The exposed state is derived from the current LiveState and the identity of
 * the most recently resolved result, so a stale async result can never replace
 * a newer active version and no synchronous state reset is needed inside the
 * effect body.
 */
export function usePresenterPresentation(
  liveState: LiveState,
): PresenterPresentationState {
  const [result, setResult] = useState<PresentationResult | null>(null);
  const requestRef = useRef<{
    publicationId: string;
    currentVersionId: string;
  } | null>(null);

  useEffect(() => {
    if (liveState.kind !== "active") {
      requestRef.current = null;
      return;
    }

    const identity = {
      publicationId: liveState.live.publicationId,
      currentVersionId: liveState.live.currentVersionId,
    };
    requestRef.current = identity;

    getDefaultPublishedPresentationReader()
      .getVersion(identity.publicationId, identity.currentVersionId)
      .then((presentation) => {
        const request = requestRef.current;
        if (request === null || !sameVersion(request, identity)) {
          return;
        }
        setResult({ ...identity, presentation, error: false });
      })
      .catch(() => {
        const request = requestRef.current;
        if (request === null || !sameVersion(request, identity)) {
          return;
        }
        setResult({ ...identity, presentation: null, error: true });
      });
  }, [liveState]);

  if (liveState.kind !== "active") {
    return { kind: "idle" };
  }

  const identity = {
    publicationId: liveState.live.publicationId,
    currentVersionId: liveState.live.currentVersionId,
  };

  if (result === null || !sameVersion(result, identity)) {
    return { kind: "loading" };
  }

  if (result.error || result.presentation === null) {
    return { kind: "error" };
  }

  return { kind: "ready", presentation: result.presentation };
}
