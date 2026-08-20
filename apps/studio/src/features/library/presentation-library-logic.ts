import type { PresentationSummary } from "../persistence/presentation-persistence";
import type { LiveState } from "../control/live-current";

export type LibraryStatus = "loading" | "ready" | "error";

export type LibraryDestination =
  | "all"
  | "folders"
  | "archived"
  | "styles"
  | "palettes";

export type PresentationToolbarAction =
  | "new"
  | "new-folder"
  | "present"
  | "control"
  | "end"
  | "edit"
  | "archive";

export interface PresentationToolbarState {
  mode: "none" | "inactive" | "live";
  actions: readonly PresentationToolbarAction[];
  canPresent: boolean;
}

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

export function isLivePresentation(
  summary: PresentationSummary,
  liveState: LiveState,
): boolean {
  return (
    liveState.kind === "active" &&
    liveState.live.publicationId === summary.publication?.publicationId
  );
}

export function resolvePresentationToolbarState(
  selected: PresentationSummary | null,
  liveState: LiveState,
): PresentationToolbarState {
  if (!selected) {
    return {
      mode: "none",
      actions: ["new", "new-folder"],
      canPresent: false,
    };
  }

  if (isLivePresentation(selected, liveState)) {
    return {
      mode: "live",
      actions: ["control", "end", "edit"],
      canPresent: false,
    };
  }

  return {
    mode: "inactive",
    actions: ["present", "edit", "archive"],
    canPresent: selected.publication !== undefined,
  };
}

export function selectSinglePresentation(
  _previousId: string | null,
  nextId: string,
): string {
  return nextId;
}

export function clearPresentationSelectionOnDestinationChange(): null {
  return null;
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
