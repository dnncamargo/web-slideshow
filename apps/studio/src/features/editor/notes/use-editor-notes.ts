"use client";

import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";

import type { PresentationNotesRepository } from "@/features/persistence/presentation-notes-repository";

import {
  createInitialEditorNotesState,
  editorNotesReducer,
  getNoteForSlide,
  type EditorNotesStatus,
} from "../editor-notes-state";
import {
  createNotesAutosave,
  type NotesAutosaveController,
} from "./notes-autosave";

export const NOTES_AUTOSAVE_DELAY_MS = 500;

export interface UseEditorNotesOptions {
  presentationId: string;
  notesRepository?: PresentationNotesRepository;
  selectedSlideId: string;
  enabled: boolean;
  autosaveDelayMs?: number;
}

export interface UseEditorNotesResult {
  note: string;
  status: EditorNotesStatus;
  isSaving: boolean;
  hasSaveError: boolean;
  hasCurrentSaveError: boolean;
  hasPending: boolean;
  onChange: (note: string) => void;
  flush: () => void;
}

/**
 * Editor hook that owns private notes state and its autosave lifecycle.
 *
 * Notes are held in a reducer fully separate from the canonical Presentation,
 * so edits never mark the Presentation dirty and never touch publish state.
 * Loading and saving are non-fatal: failures degrade to empty notes / an error
 * flag without breaking canonical editing.
 */
export function useEditorNotes({
  presentationId,
  notesRepository,
  selectedSlideId,
  enabled,
  autosaveDelayMs = NOTES_AUTOSAVE_DELAY_MS,
}: UseEditorNotesOptions): UseEditorNotesResult {
  const [state, dispatch] = useReducer(
    editorNotesReducer,
    undefined,
    createInitialEditorNotesState,
  );
  const [hasPending, setHasPending] = useState(false);

  const mountedRef = useRef(true);
  const presentationIdRef = useRef(presentationId);
  const notesRepositoryRef = useRef(notesRepository);
  const autosaveRef = useRef<NotesAutosaveController | null>(null);
  const saveQueueRef = useRef<Promise<void>>(Promise.resolve());

  const persistNote = useCallback(
    (targetPresentationId: string, slideId: string, note: string) => {
      const repository = notesRepositoryRef.current;

      if (!repository) {
        return;
      }

      saveQueueRef.current = saveQueueRef.current.then(async () => {
        if (mountedRef.current) {
          dispatch({
            type: "note-save-start",
            slideId,
            note,
          });
        }

        try {
          await repository.setSlideNote(targetPresentationId, slideId, note);

          if (mountedRef.current) {
            dispatch({
              type: "note-save-success",
              slideId,
              note,
            });
          }
        } catch (error) {
          console.error("Failed to save slide note", error);

          if (mountedRef.current) {
            dispatch({
              type: "note-save-error",
              slideId,
              note,
            });
          }
        }
      });
    },
    [],
  );

  const flush = useCallback(() => {
    autosaveRef.current?.flush();
    setHasPending(false);
  }, []);

  useEffect(() => {
    mountedRef.current = true;

    const autosave = createNotesAutosave({
      delayMs: autosaveDelayMs,
      onSave: (save) => {
        setHasPending(autosave.hasPending());
        persistNote(save.presentationId, save.slideId, save.note);
      },
    });
    autosaveRef.current = autosave;

    return () => {
      autosave.flush();
      setHasPending(false);
      mountedRef.current = false;
      autosave.dispose();
      autosaveRef.current = null;
    };
  }, [persistNote, autosaveDelayMs]);

  useEffect(() => {
    presentationIdRef.current = presentationId;
  }, [presentationId]);

  useEffect(() => {
    notesRepositoryRef.current = notesRepository;
  }, [notesRepository]);

  useEffect(() => {
    const repository = notesRepositoryRef.current;

    if (!repository) {
      return;
    }

    let cancelled = false;

    dispatch({ type: "notes-load-start" });

    repository
      .getNotes(presentationIdRef.current)
      .then((notes) => {
        if (!cancelled) {
          dispatch({ type: "notes-load-success", notes });
        }
      })
      .catch((error: unknown) => {
        console.error(
          `Failed to load notes for "${presentationIdRef.current}"`,
          error,
        );

        if (!cancelled) {
          dispatch({ type: "notes-load-error" });
        }
      });

    return () => {
      cancelled = true;
    };
  }, [presentationId, notesRepository]);

  useEffect(() => {
    if (!enabled) {
      flush();
    }
  }, [enabled, flush]);

  const note = useMemo(
    () => getNoteForSlide(state.notes, selectedSlideId),
    [state.notes, selectedSlideId],
  );

  function onChange(value: string) {
    if (!selectedSlideId) {
      return;
    }

    if (value === getNoteForSlide(state.notes, selectedSlideId)) {
      return;
    }

    dispatch({ type: "note-edit", slideId: selectedSlideId, note: value });
    autosaveRef.current?.schedule(presentationId, selectedSlideId, value);
    setHasPending(autosaveRef.current?.hasPending() ?? false);
  }

  return {
    note,
    status: state.status,
    isSaving: state.isSaving,
    hasSaveError: state.failedSlideIds.length > 0,
    hasCurrentSaveError: state.failedSlideIds.includes(selectedSlideId),
    hasPending,
    onChange,
    flush,
  };
}
