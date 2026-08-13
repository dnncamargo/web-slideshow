import type { Presentation } from "@powershow/document-schema";

const STORAGE_KEY = "powershow-opened-presentation";

export function storeOpenedPresentation(presentation: Presentation): void {
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(presentation));
}

export function readOpenedPresentation(): Presentation | null {
  const raw = sessionStorage.getItem(STORAGE_KEY);

  if (!raw) {
    return null;
  }

  sessionStorage.removeItem(STORAGE_KEY);

  try {
    return JSON.parse(raw) as Presentation;
  } catch {
    return null;
  }
}
