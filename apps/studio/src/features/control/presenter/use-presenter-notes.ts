"use client";

import { useEffect, useRef, useState } from "react";

import type { Presentation } from "@powershow/document-schema";

import { getDefaultPresentationNotesRepository } from "@/features/persistence/presentation-notes-repository-instance";
import {
  createEmptyNotes,
  type PresentationNotes,
} from "@/features/persistence/presentation-notes";

export type PresenterNotesState =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "error" }
  | { kind: "ready"; notes: PresentationNotes };

interface NotesResult {
  presentationId: string;
  notes: PresentationNotes;
  error: boolean;
}

/**
 * Loads the private Notes for the published Presentation currently shown.
 *
 * Notes come only from PresentationNotesRepository, keyed by the canonical
 * Presentation id (never the publicationId). This hook is read-only: it never
 * writes, never autosaves, and never uses the Editor notes lifecycle.
 *
 * The exposed state is derived from the current Presentation id and the
 * identity of the last resolved result, so a stale async result for a previous
 * presentation can never replace a newer one.
 */
export function usePresenterNotes(
  presentation: Presentation | null,
): PresenterNotesState {
  const [result, setResult] = useState<NotesResult | null>(null);
  const requestRef = useRef<string | null>(null);

  useEffect(() => {
    if (presentation === null) {
      requestRef.current = null;
      return;
    }

    const presentationId = presentation.id;
    requestRef.current = presentationId;

    getDefaultPresentationNotesRepository()
      .getNotes(presentationId)
      .then((notes) => {
        if (requestRef.current !== presentationId) {
          return;
        }
        setResult({ presentationId, notes, error: false });
      })
      .catch(() => {
        if (requestRef.current !== presentationId) {
          return;
        }
        setResult({
          presentationId,
          notes: createEmptyNotes(),
          error: true,
        });
      });
  }, [presentation]);

  if (presentation === null) {
    return { kind: "idle" };
  }

  if (result === null || result.presentationId !== presentation.id) {
    return { kind: "loading" };
  }

  if (result.error) {
    return { kind: "error" };
  }

  return { kind: "ready", notes: result.notes };
}
