/**
 * Pure, framework-independent autosave scheduler for editor notes.
 *
 * Debouncing is independent per presentation + slide. Repeated edits to the
 * same slide coalesce, while edits to different slides remain independently
 * pending and are all persisted.
 *
 * Presentation identity is captured together with slideId and note at schedule
 * time, so a delayed save can never migrate to another presentation.
 */

export interface PendingNotesSave {
  presentationId: string;
  slideId: string;
  note: string;
}

export interface NotesAutosaveOptions {
  delayMs: number;
  onSave: (save: PendingNotesSave) => void;
  setTimeoutFn?: (handler: () => void, delayMs: number) => number;
  clearTimeoutFn?: (handle: number) => void;
}

export interface NotesAutosaveController {
  schedule(
    presentationId: string,
    slideId: string,
    note: string,
  ): void;
  hasPending(): boolean;
  flush(): void;
  dispose(): void;
}

interface PendingEntry {
  save: PendingNotesSave;
  timer: number;
}

export function createNotesAutosave(
  options: NotesAutosaveOptions,
): NotesAutosaveController {
  const scheduleTimer =
    options.setTimeoutFn ??
    ((handler, delayMs) => window.setTimeout(handler, delayMs));

  const cancelTimer =
    options.clearTimeoutFn ??
    ((handle) => {
      window.clearTimeout(handle);
    });

  const pendingByTarget = new Map<string, PendingEntry>();

  function getTargetKey(
    presentationId: string,
    slideId: string,
  ): string {
    return JSON.stringify([presentationId, slideId]);
  }

  function fire(targetKey: string) {
    const entry = pendingByTarget.get(targetKey);

    if (!entry) {
      return;
    }

    cancelTimer(entry.timer);
    pendingByTarget.delete(targetKey);
    options.onSave(entry.save);
  }

  return {
    schedule(
      presentationId: string,
      slideId: string,
      note: string,
    ) {
      const targetKey = getTargetKey(
        presentationId,
        slideId,
      );

      const previous = pendingByTarget.get(targetKey);

      if (previous) {
        cancelTimer(previous.timer);
      }

      const save: PendingNotesSave = {
        presentationId,
        slideId,
        note,
      };

      const timer = scheduleTimer(() => {
        fire(targetKey);
      }, options.delayMs);

      pendingByTarget.set(targetKey, {
        save,
        timer,
      });
    },

    hasPending() {
      return pendingByTarget.size > 0;
    },

    flush() {
      const entries = Array.from(
        pendingByTarget.values(),
      );

      pendingByTarget.clear();

      for (const entry of entries) {
        cancelTimer(entry.timer);
        options.onSave(entry.save);
      }
    },

    dispose() {
      for (const entry of pendingByTarget.values()) {
        cancelTimer(entry.timer);
      }

      pendingByTarget.clear();
    },
  };
}
