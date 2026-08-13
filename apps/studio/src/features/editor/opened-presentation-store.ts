import type { Presentation } from "@powershow/document-schema";
import { PresentationSchema } from "@powershow/document-schema";

const STORAGE_KEY = "powershow-opened-presentation";

function hasSessionStorage(): boolean {
  return typeof window !== "undefined" && typeof window.sessionStorage !== "undefined";
}

export function storeOpenedPresentation(presentation: Presentation): void {
  if (!hasSessionStorage()) {
    return;
  }

  window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(presentation));
}

/**
 * Read the handoff Presentation, validating it against the canonical schema.
 *
 * The item is retained for the browser session so a refresh does not lose the
 * currently opened Presentation. Round 3 replaces this temporary handoff with
 * repository-backed loading. Browser guards are defensive only; callers must
 * still invoke this from the client after mount.
 */
export function readOpenedPresentation(): Presentation | null {
  if (!hasSessionStorage()) {
    return null;
  }

  const raw = window.sessionStorage.getItem(STORAGE_KEY);

  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as unknown;
    const result = PresentationSchema.safeParse(parsed);

    return result.success ? result.data : null;
  } catch {
    return null;
  }
}

export function clearOpenedPresentation(): void {
  if (!hasSessionStorage()) {
    return;
  }

  window.sessionStorage.removeItem(STORAGE_KEY);
}