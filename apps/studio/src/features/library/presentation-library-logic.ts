import type { PresentationSummary } from "../persistence/presentation-persistence";
import type { PresentationFolder } from "../persistence/presentation-folder";
import type { LiveState } from "../control/live-current";

export type LibraryStatus = "loading" | "ready" | "error";

export type StaticLibraryDestination =
  | "all"
  | "archived"
  | "styles"
  | "palettes"
  | "fonts";

export interface FolderLibraryDestination {
  readonly kind: "folder";
  readonly folderId: string;
}

export type LibraryDestination =
  | StaticLibraryDestination
  | FolderLibraryDestination;

export type PresentationLibraryDestination =
  | "all"
  | "archived"
  | FolderLibraryDestination;

export type ResourceLibraryDestination = "styles" | "palettes" | "fonts";

export type PresentationToolbarAction =
  | "present"
  | "control"
  | "end"
  | "edit"
  | "archive"
  | "restore"
  | "delete";

export type PresentationToolbarTransferAction = "import" | "export";

export type PresentationToolbarMode = "none" | "inactive" | "live" | "archived";

export interface PresentationToolbarState {
  mode: PresentationToolbarMode;
  actions: readonly PresentationToolbarAction[];
  transferAction: PresentationToolbarTransferAction;
  canPresent: boolean;
}

export function isFolderDestination(
  destination: LibraryDestination,
): destination is FolderLibraryDestination {
  return typeof destination === "object" && destination.kind === "folder";
}

export function isResourceDestination(
  destination: LibraryDestination,
): destination is ResourceLibraryDestination {
  return (
    destination === "styles" ||
    destination === "palettes" ||
    destination === "fonts"
  );
}

export function isPresentationDestination(
  destination: LibraryDestination,
): destination is PresentationLibraryDestination {
  return (
    destination === "all" ||
    destination === "archived" ||
    isFolderDestination(destination)
  );
}

export function isSameLibraryDestination(
  a: LibraryDestination,
  b: LibraryDestination,
): boolean {
  if (a === b) {
    return true;
  }

  if (isFolderDestination(a) && isFolderDestination(b)) {
    return a.folderId === b.folderId;
  }

  return false;
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
 * Whether a single summary is visible inside a Library destination. This is
 * the local view rule applied after a single includeArchived collection load;
 * no Firestore queries are made for filtering.
 */
export function isSummaryVisibleInDestination(
  summary: PresentationSummary,
  destination: LibraryDestination,
): boolean {
  if (destination === "all") {
    return !summary.archived;
  }

  if (destination === "archived") {
    return summary.archived;
  }

  if (isFolderDestination(destination)) {
    return !summary.archived && summary.folderId === destination.folderId;
  }

  return false;
}

/**
 * Filter a single snapshot of presentations into the correct visible set for
 * a Library destination. No Firestore queries are made for filtering.
 */
export function filterPresentationsByDestination(
  summaries: readonly PresentationSummary[],
  destination: LibraryDestination,
): PresentationSummary[] {
  return summaries.filter((summary) =>
    isSummaryVisibleInDestination(summary, destination),
  );
}

/**
 * Resolve a visible folder name from the loaded folder list. Returns the
 * folder name when found, or undefined when the folder is not in the loaded
 * list (e.g. it was deleted after the presentation was moved into it).
 */
export function resolveFolderName(
  folders: readonly PresentationFolder[],
  folderId: string,
): string | undefined {
  return folders.find((folder) => folder.id === folderId)?.name;
}

/**
 * Stable management toolbar model.
 *
 * GLOBAL (always present regardless of selection):
 * - New presentation      always available
 * - Transfer slot         Import (no selection) or Export (selected)
 * - New folder            always visible, enabled
 *
 * CONTEXTUAL (additional, only when a presentation is selected):
 * - inactive: Present, Edit, Archive
 * - live:     Control, End, Edit
 * - archived: Restore, Delete (Delete is separately gated on publication by
 *   the toolbar: published archived items keep the visible control disabled)
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

  if (selected.archived) {
    return {
      mode: "archived",
      actions: ["restore", "delete"],
      transferAction: "export",
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
