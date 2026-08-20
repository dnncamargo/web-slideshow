import type { PresentationSummary } from "../persistence/presentation-persistence";
import type { LiveState } from "../control/live-current";

export type LibraryStatus = "loading" | "ready" | "error";

export type LibraryDestination =
  | "all"
  | "archived"
  | "styles"
  | "palettes"
  | "fonts";

export type PresentationToolbarAction =
  | "present"
  | "control"
  | "end"
  | "edit"
  | "archive";

export type PresentationToolbarTransferAction = "import" | "export";

export interface PresentationToolbarState {
  mode: "none" | "inactive" | "live";
  actions: readonly PresentationToolbarAction[];
  transferAction: PresentationToolbarTransferAction;
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

export function publicationStatusTone(
  summary: PresentationSummary,
): "success" | "warning" | "neutral" {
  if (summary.publicationState === "published") {
    return "success";
  }

  if (summary.publicationState === "unpublished-changes") {
    return "warning";
  }

  return "neutral";
}

/**
 * Stable management toolbar model.
 *
 * GLOBAL (always present regardless of selection):
 * - New presentation      always available
 * - Transfer slot         Import (no selection) or Export (selected)
 * - New folder            always visible, disabled for now
 *
 * CONTEXTUAL (additional, only when a presentation is selected):
 * - inactive: Present, Edit, Archive
 * - live:     Control, End, Edit
 */
export function resolvePresentationToolbarState(
  selected: PresentationSummary | null,
  liveState: LiveState,
): PresentationToolbarState {
  if (!selected) {
    return {
      mode: "none",
      actions: [],
      transferAction: "import",
      canPresent: false,
    };
  }

  if (isLivePresentation(selected, liveState)) {
    return {
      mode: "live",
      actions: ["control", "end", "edit"],
      transferAction: "export",
      canPresent: false,
    };
  }

  return {
    mode: "inactive",
    actions: ["present", "edit", "archive"],
    transferAction: "export",
    canPresent: selected.publication !== undefined,
  };
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
