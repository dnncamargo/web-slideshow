import type { PresentationSummary } from "../persistence/presentation-persistence";

export type LibraryStatus = "loading" | "ready" | "error";

export function resolveLibraryStatus(
  loading: boolean,
  failed: boolean,
  hasLoadedOnce: boolean,
): LibraryStatus {
  if (failed) {
    return "error";
  }

  if (loading && !hasLoadedOnce) {
    return "loading";
  }

  return "ready";
}

export function isEmptyLibrary(
  summaries: readonly PresentationSummary[],
): boolean {
  return summaries.length === 0;
}

export function isNewBlocked(creating: boolean): boolean {
  return creating;
}

export function isArchiveBlocked(
  archivingId: string | null,
  targetId: string,
): boolean {
  return archivingId !== null && archivingId !== targetId;
}

export function isOpenBlocked(
  openingId: string | null,
  targetId: string,
): boolean {
  return openingId !== null && openingId !== targetId;
}
