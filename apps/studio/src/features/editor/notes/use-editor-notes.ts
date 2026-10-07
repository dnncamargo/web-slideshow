"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
} from "react";

import { resolveLogicalSlideSize } from "@web-slideshow/renderer";

import type { PresentationNotesRepository } from "@/features/persistence/presentation-notes-repository";
import type { Presentation } from "@web-slideshow/document-schema";
import type {
  PointedNote,
  SlideNotes,
} from "../../persistence/presentation-notes";

import {
  createInitialEditorNotesState,
  editorNotesReducer,
  type EditorNotesStatus,
} from "../editor-notes-state";
import {
  appendPointedNote,
  getPointedNoteIds,
  getSlideNotes,
  removePointedNote,
  updatePointedNotePosition,
  updatePointedNoteText,
  updateSlideNoteText,
} from "../../persistence/presentation-notes";
import { createUniqueId } from "../preset-structure";
import {
  createNotesAutosave,
  type NotesAutosaveController,
} from "./notes-autosave";

export const NOTES_AUTOSAVE_DELAY_MS = 500;

export interface UseEditorNotesOptions {
  presentationId: string;
  notesRepository?: PresentationNotesRepository;
  selectedSlideId: string;
  aspectRatio: Presentation["aspectRatio"];
  enabled: boolean;
  autosaveDelayMs?: number;
}

export interface UseEditorNotesResult {
  slideNotes: SlideNotes;
  note: string;
  status: EditorNotesStatus;
  isSaving: boolean;
  hasSaveError: boolean;
  hasCurrentSaveError: boolean;
  hasPending: boolean;
  onChange: (note: string) => void;
  onAddPointedNote: () => void;
  onPointedNoteChange: (pointedNoteId: string, text: string) => void;
  onPointedNoteMove: (pointedNoteId: string, x: number, y: number) => void;
  onRemovePointedNote: (pointedNoteId: string) => void;
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
  aspectRatio,
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

  const persistSlideNotes = useCallback(
    (targetPresentationId: string, slideId: string, slideNotes: SlideNotes) => {
      const repository = notesRepositoryRef.current;

      if (!repository) {
        return;
      }

      saveQueueRef.current = saveQueueRef.current.then(async () => {
        if (mountedRef.current) {
          dispatch({
            type: "note-save-start",
            slideId,
            slideNotes,
          });
        }

        try {
          await repository.setSlideNotes(
            targetPresentationId,
            slideId,
            slideNotes,
          );

          if (mountedRef.current) {
            dispatch({
              type: "note-save-success",
              slideId,
              slideNotes,
            });
          }
        } catch (error) {
          console.error("Failed to save slide note", error);

          if (mountedRef.current) {
            dispatch({
              type: "note-save-error",
              slideId,
              slideNotes,
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
        persistSlideNotes(save.presentationId, save.slideId, save.slideNotes);
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
  }, [persistSlideNotes, autosaveDelayMs]);

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
    () => getSlideNotes(state.notes, selectedSlideId),
    [state.notes, selectedSlideId],
  );

  const commitSlideNotes = useCallback(
    (nextSlideNotes: SlideNotes) => {
      if (!selectedSlideId || state.status !== "ready") {
        return;
      }

      dispatch({
        type: "slide-notes-edit",
        slideId: selectedSlideId,
        slideNotes: nextSlideNotes,
      });
      autosaveRef.current?.schedule(
        presentationId,
        selectedSlideId,
        nextSlideNotes,
      );
      setHasPending(autosaveRef.current?.hasPending() ?? false);
    },
    [presentationId, selectedSlideId, state.status],
  );

  const onChange = useCallback(
    (value: string) => {
      if (!selectedSlideId || state.status !== "ready") {
        return;
      }

      const currentSlideNotes = getSlideNotes(state.notes, selectedSlideId);

      if (value === currentSlideNotes.text) {
        return;
      }

      const nextNotes = updateSlideNoteText(
        state.notes,
        selectedSlideId,
        value,
      );
      commitSlideNotes(getSlideNotes(nextNotes, selectedSlideId));
    },
    [commitSlideNotes, selectedSlideId, state.notes, state.status],
  );

  const onAddPointedNote = useCallback(() => {
    if (!selectedSlideId || state.status !== "ready") {
      return;
    }

    const logicalSize = resolveLogicalSlideSize(aspectRatio);
    const pointedNote: PointedNote = {
      id: createUniqueId("pointed-note", getPointedNoteIds(state.notes)),
      text: "",
      x: logicalSize.logicalWidth / 2,
      y: logicalSize.logicalHeight / 2,
    };

    const nextNotes = appendPointedNote(
      state.notes,
      selectedSlideId,
      pointedNote,
    );
    commitSlideNotes(getSlideNotes(nextNotes, selectedSlideId));
  }, [
    aspectRatio,
    commitSlideNotes,
    selectedSlideId,
    state.notes,
    state.status,
  ]);

  const onPointedNoteChange = useCallback(
    (pointedNoteId: string, text: string) => {
      if (!selectedSlideId || state.status !== "ready") {
        return;
      }

      const nextNotes = updatePointedNoteText(
        state.notes,
        selectedSlideId,
        pointedNoteId,
        text,
      );
      commitSlideNotes(getSlideNotes(nextNotes, selectedSlideId));
    },
    [commitSlideNotes, selectedSlideId, state.notes, state.status],
  );

  const onPointedNoteMove = useCallback(
    (pointedNoteId: string, x: number, y: number) => {
      if (!selectedSlideId || state.status !== "ready") {
        return;
      }

      const nextNotes = updatePointedNotePosition(
        state.notes,
        selectedSlideId,
        pointedNoteId,
        x,
        y,
      );
      commitSlideNotes(getSlideNotes(nextNotes, selectedSlideId));
    },
    [commitSlideNotes, selectedSlideId, state.notes, state.status],
  );

  const onRemovePointedNote = useCallback(
    (pointedNoteId: string) => {
      if (!selectedSlideId || state.status !== "ready") {
        return;
      }

      const nextNotes = removePointedNote(
        state.notes,
        selectedSlideId,
        pointedNoteId,
      );
      commitSlideNotes(getSlideNotes(nextNotes, selectedSlideId));
    },
    [commitSlideNotes, selectedSlideId, state.notes, state.status],
  );

  return {
    slideNotes: note,
    note: note.text,
    status: state.status,
    isSaving: state.isSaving,
    hasSaveError: state.failedSlideIds.length > 0,
    hasCurrentSaveError: state.failedSlideIds.includes(selectedSlideId),
    hasPending,
    onChange,
    onAddPointedNote,
    onPointedNoteChange,
    onPointedNoteMove,
    onRemovePointedNote,
    flush,
  };
}
