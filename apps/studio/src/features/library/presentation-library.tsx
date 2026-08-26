"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import type {
  ChangeEvent as ReactChangeEvent,
  KeyboardEvent as ReactKeyboardEvent,
  MouseEvent as ReactMouseEvent,
} from "react";

import { useRouter } from "next/navigation";

import {
  Button,
  Topbar,
  TopbarActions,
  TopbarLocale,
} from "@powershow/ui";

import { useStudioI18n } from "../i18n/studio-i18n-context";
import type { StudioTranslate } from "../i18n/studio-i18n";
import { LocaleSelector } from "../i18n/locale-selector";
import { STUDIO_ROUTES, buildStudioEditorHref } from "../app/studio-routes";
import { ProductSurfaceBrand } from "../app/product-surface-brand";
import { useStudioAuth } from "../auth/studio-auth-provider";
import {
  createBlankPresentation,
  createDefaultPresentationId,
  getDefaultPresentationRepository,
} from "../persistence/presentation-repository-instance";
import { getDefaultPresentationFolderRepository } from "../persistence/presentation-folder-repository-instance";
import { getDefaultCustomLibraryRepository } from "../persistence/custom-library-repository-instance";
import { getDefaultCustomLibraryPaletteRepository } from "../persistence/custom-library-palette-repository-instance";
import type { PresentationRepository } from "../persistence/presentation-repository";
import type { PresentationFolderRepository } from "../persistence/presentation-folder-repository";
import type { PresentationFolder } from "../persistence/presentation-folder";
import type { PresentationSummary } from "../persistence/presentation-persistence";
import type {
  CustomLibraryItemRecord,
  CustomLibraryRepository,
} from "../custom-library/custom-library-repository";
import type {
  CustomLibraryPaletteRecord,
  CustomLibraryPaletteRepository,
} from "../custom-library/custom-library-palette-repository";
import {
  subscribeLiveCurrent,
  activateLivePresentation,
  endLivePresentation,
  type LiveState,
} from "../control/live-current";

import {
  filterPresentationsByDestination,
  isFolderDestination,
  isPresentationDestination,
  isCustomLibraryDestination,
  isSummaryVisibleInDestination,
  resolveFolderName,
  type LibraryDestination,
} from "./presentation-library-logic";
import { PresentationList } from "./presentation-list";
import { PresentationDetails } from "./presentation-details";
import { PresentationToolbar } from "./presentation-toolbar";
import { StudioSidebar } from "./studio-sidebar";
import { DeletePresentationDialog } from "./delete-presentation-dialog";
import { CustomLibraryBrowser } from "../custom-library/custom-library-browser";
import { CustomLibraryDetails } from "../custom-library/custom-library-details";
import { CustomLibraryDeleteDialog } from "../custom-library/custom-library-delete-dialog";
import { CustomLibraryPaletteBrowser } from "../custom-library/custom-library-palette-browser";
import { CustomLibraryPaletteDetails } from "../custom-library/custom-library-palette-details";
import { CustomLibraryPaletteDeleteDialog } from "../custom-library/custom-library-palette-delete-dialog";
import styles from "./presentation-library.module.css";
import {
  buildPresentationExportFilename,
  parsePresentationImport,
  prepareImportedPresentation,
  serializePresentationForExport,
} from "./presentation-transfer";
import { PresentationImportError } from "./presentation-transfer";

interface PresentationLibraryProps {
  repository?: PresentationRepository;
  folderRepository?: PresentationFolderRepository;
  customLibraryRepository?: CustomLibraryRepository;
  customLibraryPaletteRepository?: CustomLibraryPaletteRepository;
}

type LibraryStatus = "loading" | "ready" | "error";
type FolderStatus = "loading" | "ready" | "error";

const SELECTION_INTERACTIVE_SELECTOR =
  "button, a, input, select, textarea, [role='button'], [data-presentation-row], [data-custom-library-row], [data-custom-library-palette-row]";

function destinationTitle(
  destination: LibraryDestination,
  t: StudioTranslate,
  folders: readonly PresentationFolder[],
): string {
  if (isFolderDestination(destination)) {
    return resolveFolderName(folders, destination.folderId) ?? t("library.folderFallback");
  }

  switch (destination) {
    case "all":
      return t("library.all");
    case "archived":
      return t("library.archived");
    case "styles":
      return t("library.styles");
    case "palettes":
      return t("library.palettes");
    case "fonts":
      return t("library.fonts");
  }
}

function destinationSectionTitle(
  destination: LibraryDestination,
  t: StudioTranslate,
): string {
  if (isFolderDestination(destination)) {
    return t("library.folders");
  }

  if (isCustomLibraryDestination(destination)) {
    return t("library.customLibrary");
  }

  return t("library.presentations");
}

export function PresentationLibrary({
  repository = getDefaultPresentationRepository(),
  folderRepository = getDefaultPresentationFolderRepository(),
  customLibraryRepository = getDefaultCustomLibraryRepository(),
  customLibraryPaletteRepository = getDefaultCustomLibraryPaletteRepository(),
}: PresentationLibraryProps) {
  const { t } = useStudioI18n();
  const router = useRouter();
  const { user, signOut } = useStudioAuth();

  const [destination, setDestination] = useState<LibraryDestination>("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [status, setStatus] = useState<LibraryStatus>("loading");
  const [summaries, setSummaries] = useState<PresentationSummary[]>([]);
  const [customLibraryStatus, setCustomLibraryStatus] = useState<"idle" | LibraryStatus>("idle");
  const [customLibraryItems, setCustomLibraryItems] = useState<CustomLibraryItemRecord[]>([]);
  const [customLibraryPaletteStatus, setCustomLibraryPaletteStatus] = useState<"idle" | LibraryStatus>("idle");
  const [customLibraryPalettes, setCustomLibraryPalettes] = useState<CustomLibraryPaletteRecord[]>([]);

  const [folders, setFolders] = useState<PresentationFolder[]>([]);
  const [folderStatus, setFolderStatus] = useState<FolderStatus>("loading");

  const [creating, setCreating] = useState(false);
  const [openingId, setOpeningId] = useState<string | null>(null);
  const [archivingId, setArchivingId] = useState<string | null>(null);
  const [restoringId, setRestoringId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [transferBusy, setTransferBusy] = useState(false);
  const [movingId, setMovingId] = useState<string | null>(null);

  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [selectedCustomLibraryItemId, setSelectedCustomLibraryItemId] = useState<string | null>(null);
  const [customLibraryDeleteTargetId, setCustomLibraryDeleteTargetId] = useState<string | null>(null);
  const [deletingCustomLibraryItemId, setDeletingCustomLibraryItemId] = useState<string | null>(null);
  const [customLibraryError, setCustomLibraryError] = useState<string | null>(null);
  const [selectedCustomLibraryPaletteId, setSelectedCustomLibraryPaletteId] = useState<string | null>(null);
  const [customLibraryPaletteDeleteTargetId, setCustomLibraryPaletteDeleteTargetId] = useState<string | null>(null);
  const [deletingCustomLibraryPaletteId, setDeletingCustomLibraryPaletteId] = useState<string | null>(null);
  const [customLibraryPaletteError, setCustomLibraryPaletteError] = useState<string | null>(null);

  const [newFolderOpen, setNewFolderOpen] = useState(false);
  const [creatingFolder, setCreatingFolder] = useState(false);
  const [folderError, setFolderError] = useState<string | null>(null);

  const [actionError, setActionError] = useState<string | null>(null);
  const [signingOut, setSigningOut] = useState(false);
  const [liveState, setLiveState] = useState<LiveState>({ kind: "loading" });

  const mountedRef = useRef(true);
  const customLibraryLoadRef = useRef(0);
  const customLibraryPaletteLoadRef = useRef(0);
  const customLibraryDeleteRef = useRef(false);
  const customLibraryPaletteDeleteRef = useRef(false);
  const importInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    mountedRef.current = true;

    return () => {
      mountedRef.current = false;
    };
  }, []);

  const loadPresentations = useCallback(async () => {
    setStatus("loading");

    try {
      const items = await repository.listPresentations({ includeArchived: true });

      if (!mountedRef.current) return;

      setSummaries(items);
      setStatus("ready");
    } catch (error) {
      console.error("Library: could not load presentations", error);

      if (mountedRef.current) {
        setStatus("error");
      }
    }
  }, [repository]);

  const loadFolders = useCallback(async () => {
    setFolderStatus("loading");

    try {
      const items = await folderRepository.listFolders();

      if (!mountedRef.current) return;

      setFolders(items);
      setFolderStatus("ready");
    } catch (error) {
      console.error("Library: could not load folders", error);

      if (mountedRef.current) {
        setFolderStatus("error");
      }
    }
  }, [folderRepository]);

  useEffect(() => {
    queueMicrotask(() => void loadPresentations());
  }, [loadPresentations]);

  useEffect(() => {
    queueMicrotask(() => void loadFolders());
  }, [loadFolders]);

  const loadCustomLibraryItems = useCallback(async () => {
    const request = customLibraryLoadRef.current + 1;
    customLibraryLoadRef.current = request;
    setCustomLibraryStatus("loading");
    setCustomLibraryError(null);

    try {
      const items = await customLibraryRepository.listItems();
      if (!mountedRef.current || customLibraryLoadRef.current !== request) return;
      setCustomLibraryItems(items);
      setCustomLibraryStatus("ready");
    } catch (error) {
      console.error("Library: could not load Custom Library", error);
      if (!mountedRef.current || customLibraryLoadRef.current !== request) return;
      setCustomLibraryStatus("error");
      setCustomLibraryError(t("customLibrary.browser.loadFailed"));
    }
  }, [customLibraryRepository, t]);

  useEffect(() => {
    if (destination !== "styles") return;
    void loadCustomLibraryItems();
  }, [destination, loadCustomLibraryItems]);

  const loadCustomLibraryPalettes = useCallback(async () => {
    const request = customLibraryPaletteLoadRef.current + 1;
    customLibraryPaletteLoadRef.current = request;
    setCustomLibraryPaletteStatus("loading");
    setCustomLibraryPaletteError(null);

    try {
      const palettes = await customLibraryPaletteRepository.listPalettes();
      if (!mountedRef.current || customLibraryPaletteLoadRef.current !== request) return;
      setCustomLibraryPalettes(palettes);
      setCustomLibraryPaletteStatus("ready");
    } catch (error) {
      console.error("Library: could not load Custom Library palettes", error);
      if (!mountedRef.current || customLibraryPaletteLoadRef.current !== request) return;
      setCustomLibraryPaletteStatus("error");
      setCustomLibraryPaletteError(t("customLibrary.paletteBrowser.loadFailed"));
    }
  }, [customLibraryPaletteRepository, t]);

  useEffect(() => {
    if (destination !== "palettes") return;
    void loadCustomLibraryPalettes();
  }, [destination, loadCustomLibraryPalettes]);

  useEffect(() => {
    const unsubscribe = subscribeLiveCurrent(setLiveState);
    return () => unsubscribe?.();
  }, []);

  const handleSignOut = useCallback(() => {
    if (signingOut) return;

    setSigningOut(true);
    signOut()
      .catch((cause) => console.error("Library: sign out failed", cause))
      .finally(() => {
        if (mountedRef.current) setSigningOut(false);
      });
  }, [signingOut, signOut]);

  const handleDestinationChange = useCallback((next: LibraryDestination) => {
    setDestination(next);
    setSelectedId(null);
    setSelectedCustomLibraryItemId(null);
    setCustomLibraryDeleteTargetId(null);
    setSelectedCustomLibraryPaletteId(null);
    setCustomLibraryPaletteDeleteTargetId(null);
  }, []);

  const handleToggleSelection = useCallback((id: string) => {
    setSelectedId((current) => (current === id ? null : id));
  }, []);

  const handleToggleCustomLibrarySelection = useCallback((id: string) => {
    setSelectedCustomLibraryItemId((current) => (current === id ? null : id));
  }, []);

  const handleToggleCustomLibraryPaletteSelection = useCallback((id: string) => {
    setSelectedCustomLibraryPaletteId((current) => (current === id ? null : id));
  }, []);

  const handleWorkspaceKeyDown = useCallback(
    (event: ReactKeyboardEvent<HTMLElement>) => {
      if (event.key === "Escape") {
        setSelectedId(null);
        setSelectedCustomLibraryItemId(null);
        setSelectedCustomLibraryPaletteId(null);
      }
    },
    [],
  );

  const handleBrowserBackgroundClick = useCallback(
    (event: ReactMouseEvent<HTMLElement>) => {
      const target = event.target;

      if (!(target instanceof Element)) {
        return;
      }

      // Clicks that originate inside a presentation row deselect/select via
      // the row toggle handler; interactive controls never clear selection.
      // Everything else inside the browser pane is empty visual space and
      // behaves Explorer-like: it clears the current selection.
      if (target.closest(SELECTION_INTERACTIVE_SELECTOR)) {
        return;
      }

      setSelectedId(null);
      setSelectedCustomLibraryItemId(null);
      setSelectedCustomLibraryPaletteId(null);
    },
    [],
  );

  const handleNew = useCallback(async () => {
    if (creating) return;

    setCreating(true);
    setActionError(null);

    try {
      const presentation = createBlankPresentation();

      if (isFolderDestination(destination)) {
        await repository.createPresentation(presentation, {
          folderId: destination.folderId,
        });
      } else {
        await repository.createPresentation(presentation);
      }

      if (mountedRef.current) router.push(buildStudioEditorHref(presentation.id));
    } catch (error) {
      console.error("Library: could not create presentation", error);
      if (mountedRef.current) setActionError(t("library.couldNotCreate"));
    } finally {
      if (mountedRef.current) setCreating(false);
    }
  }, [creating, repository, router, t, destination]);

  const handleOpen = useCallback(
    (id: string) => {
      if (openingId !== null) return;
      setOpeningId(id);
      router.push(buildStudioEditorHref(id));
    },
    [openingId, router],
  );

  const selected = summaries.find((summary) => summary.id === selectedId) ?? null;
  const selectedCustomLibraryItem =
    customLibraryItems.find((record) => record.id === selectedCustomLibraryItemId) ?? null;
  const selectedCustomLibraryPalette =
    customLibraryPalettes.find((record) => record.id === selectedCustomLibraryPaletteId) ?? null;

  const handleRequestCustomLibraryDelete = useCallback(() => {
    if (!selectedCustomLibraryItem) return;
    setCustomLibraryError(null);
    setCustomLibraryDeleteTargetId(selectedCustomLibraryItem.id);
  }, [selectedCustomLibraryItem]);

  const handleConfirmCustomLibraryDelete = useCallback(async () => {
    if (customLibraryDeleteRef.current || customLibraryDeleteTargetId === null) return;
    const target = customLibraryItems.find((record) => record.id === customLibraryDeleteTargetId);
    if (!target) return;

    customLibraryDeleteRef.current = true;
    setDeletingCustomLibraryItemId(target.id);
    setCustomLibraryError(null);

    try {
      await customLibraryRepository.deleteItem(target.id);
      if (!mountedRef.current) return;
      setCustomLibraryItems((items) => items.filter((record) => record.id !== target.id));
      setSelectedCustomLibraryItemId((current) => current === target.id ? null : current);
      setCustomLibraryDeleteTargetId(null);
    } catch (error) {
      console.error("Library: could not delete Custom Library item", error);
      if (mountedRef.current) setCustomLibraryError(t("customLibrary.deleteFailed"));
    } finally {
      customLibraryDeleteRef.current = false;
      if (mountedRef.current) setDeletingCustomLibraryItemId(null);
    }
  }, [customLibraryDeleteTargetId, customLibraryItems, customLibraryRepository, t]);

  const handleCancelCustomLibraryDelete = useCallback(() => {
    if (customLibraryDeleteRef.current) return;
    setCustomLibraryDeleteTargetId(null);
    setCustomLibraryError(null);
  }, []);

  const handleRequestCustomLibraryPaletteDelete = useCallback(() => {
    if (!selectedCustomLibraryPalette) return;
    setCustomLibraryPaletteError(null);
    setCustomLibraryPaletteDeleteTargetId(selectedCustomLibraryPalette.id);
  }, [selectedCustomLibraryPalette]);

  const handleConfirmCustomLibraryPaletteDelete = useCallback(async () => {
    if (customLibraryPaletteDeleteRef.current || customLibraryPaletteDeleteTargetId === null) return;
    const target = customLibraryPalettes.find((record) => record.id === customLibraryPaletteDeleteTargetId);
    if (!target) return;

    customLibraryPaletteDeleteRef.current = true;
    setDeletingCustomLibraryPaletteId(target.id);
    setCustomLibraryPaletteError(null);

    try {
      await customLibraryPaletteRepository.deletePalette(target.id);
      if (!mountedRef.current) return;
      setCustomLibraryPalettes((palettes) => palettes.filter((record) => record.id !== target.id));
      setSelectedCustomLibraryPaletteId((current) => current === target.id ? null : current);
      setCustomLibraryPaletteDeleteTargetId(null);
    } catch (error) {
      console.error("Library: could not delete Custom Library palette", error);
      if (mountedRef.current) setCustomLibraryPaletteError(t("customLibrary.paletteDelete.failed"));
    } finally {
      customLibraryPaletteDeleteRef.current = false;
      if (mountedRef.current) setDeletingCustomLibraryPaletteId(null);
    }
  }, [customLibraryPaletteDeleteTargetId, customLibraryPalettes, customLibraryPaletteRepository, t]);

  const handleCancelCustomLibraryPaletteDelete = useCallback(() => {
    if (customLibraryPaletteDeleteRef.current) return;
    setCustomLibraryPaletteDeleteTargetId(null);
    setCustomLibraryPaletteError(null);
  }, []);

  const handleExport = useCallback(async () => {
    if (!selected || transferBusy) return;

    setTransferBusy(true);
    setActionError(null);
    try {
      const presentation = await repository.getPresentation(selected.id);
      if (!presentation) {
        throw new Error("Presentation not found.");
      }

      const blob = new Blob([serializePresentationForExport(presentation)], {
        type: "application/json;charset=utf-8",
      });
      const url = URL.createObjectURL(blob);
      try {
        const anchor = document.createElement("a");
        anchor.href = url;
        anchor.download = buildPresentationExportFilename(presentation.title);
        anchor.click();
      } finally {
        URL.revokeObjectURL(url);
      }
    } catch (error) {
      console.error("Library: could not export presentation", error);
      if (mountedRef.current) setActionError(t("library.couldNotExport"));
    } finally {
      if (mountedRef.current) setTransferBusy(false);
    }
  }, [repository, selected, t, transferBusy]);

  const handleImport = useCallback(() => {
    if (transferBusy) return;
    importInputRef.current?.click();
  }, [transferBusy]);

  const handleImportFile = useCallback(
    async (event: ReactChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      event.target.value = "";
      if (!file || transferBusy) return;

      setTransferBusy(true);
      setActionError(null);
      try {
        const source = parsePresentationImport(await file.text());
        let newId: string | undefined;
        for (let attempt = 0; attempt < 3; attempt += 1) {
          const candidate = createDefaultPresentationId();
          if ((await repository.getPresentation(candidate)) === null) {
            newId = candidate;
            break;
          }
        }
        if (!newId) throw new Error("Could not allocate a presentation id.");

        const imported = prepareImportedPresentation(source, newId);
        if (isFolderDestination(destination)) {
          await repository.createPresentation(imported, {
            folderId: destination.folderId,
          });
        } else {
          await repository.createPresentation(imported);
        }

        if (mountedRef.current) router.push(buildStudioEditorHref(imported.id));
      } catch (error) {
        console.error("Library: could not import presentation", error);
        if (mountedRef.current) {
          const message =
            error instanceof PresentationImportError
              ? error.kind === "malformed-json"
                ? t("library.importMalformed")
                : t("library.importInvalidPresentation")
              : t("library.couldNotImport");
          setActionError(message);
        }
      } finally {
        if (mountedRef.current) setTransferBusy(false);
      }
    },
    [destination, repository, router, t, transferBusy],
  );

  const handleArchive = useCallback(
    async (id: string) => {
      if (archivingId !== null) return;

      setArchivingId(id);
      const previous = summaries;

      try {
        await repository.archivePresentation(id);
        if (!mountedRef.current) return;

        const items = await repository.listPresentations({ includeArchived: true });
        if (mountedRef.current) {
          setSummaries(items);
          setSelectedId(null);
        }
      } catch (error) {
        console.error("Library: could not archive presentation", error);
        if (mountedRef.current) {
          setActionError(t("library.couldNotArchive"));
          setSummaries(previous);
        }
      } finally {
        if (mountedRef.current) setArchivingId(null);
      }
    },
    [archivingId, repository, summaries, t],
  );

  const handleRestore = useCallback(
    async (id: string) => {
      if (restoringId !== null) return;

      setRestoringId(id);
      setActionError(null);
      const previous = summaries;

      try {
        await repository.restorePresentation(id);
        if (!mountedRef.current) return;

        const items = await repository.listPresentations({ includeArchived: true });
        if (mountedRef.current) {
          setSummaries(items);
          setSelectedId(null);
        }
      } catch (error) {
        console.error("Library: could not restore presentation", error);
        if (mountedRef.current) {
          setActionError(t("library.couldNotRestore"));
          setSummaries(previous);
        }
      } finally {
        if (mountedRef.current) setRestoringId(null);
      }
    },
    [restoringId, repository, summaries, t],
  );

  const handleRequestDelete = useCallback((summary: PresentationSummary) => {
    if (!summary.archived || summary.publication !== undefined) {
      return;
    }

    setDeleteTargetId(summary.id);
    setDeleteError(null);
  }, []);

  const handleCancelDelete = useCallback(() => {
    if (deletingId !== null) return;

    setDeleteTargetId(null);
    setDeleteError(null);
  }, [deletingId]);

  const handleConfirmDelete = useCallback(async () => {
    if (deleteTargetId === null || deletingId !== null) return;

    const id = deleteTargetId;
    setDeletingId(id);
    const previous = summaries;

    try {
      await repository.deleteArchivedPresentation(id);
      if (!mountedRef.current) return;

      const items = await repository.listPresentations({ includeArchived: true });
      if (!mountedRef.current) return;

      setSummaries(items);
      setSelectedId(null);
      setDeleteTargetId(null);
      setDeleteError(null);
    } catch (error) {
      console.error("Library: could not delete presentation", error);
      if (mountedRef.current) {
        setDeleteError(t("library.deleteFailed"));
        setSummaries(previous);
      }
    } finally {
      if (mountedRef.current) setDeletingId(null);
    }
  }, [deleteTargetId, deletingId, repository, summaries, t]);

  const handleMoveFolder = useCallback(
    async (id: string, folderId: string | null) => {
      if (movingId !== null) return;

      setMovingId(id);
      setActionError(null);
      const previous = summaries;

      try {
        await repository.movePresentationToFolder(id, folderId);
        if (!mountedRef.current) return;

        const items = await repository.listPresentations({ includeArchived: true });
        if (!mountedRef.current) return;

        setSummaries(items);

        const updated = items.find((summary) => summary.id === id);
        if (!updated || !isSummaryVisibleInDestination(updated, destination)) {
          setSelectedId(null);
        }
      } catch (error) {
        console.error("Library: could not move presentation", error);
        if (mountedRef.current) {
          setActionError(t("library.couldNotMoveFolder"));
          setSummaries(previous);
        }
      } finally {
        if (mountedRef.current) setMovingId(null);
      }
    },
    [movingId, repository, summaries, destination, t],
  );

  const handlePresent = useCallback(
    async (summary: PresentationSummary) => {
      if (!summary.publication) return;

      try {
        await activateLivePresentation(
          summary.publication.publicationId,
          summary.publication.currentVersionId,
        );
        router.push(STUDIO_ROUTES.control);
      } catch (error) {
        console.error("Library: present failed", error);
        if (mountedRef.current) setActionError(t("library.couldNotActivate"));
      }
    },
    [router, t],
  );

  const handleEnd = useCallback(async () => {
    try {
      await endLivePresentation();
    } catch (error) {
      console.error("Library: end failed", error);
      if (mountedRef.current) setActionError(t("library.couldNotEnd"));
    }
  }, [t]);

  const handleOpenNewFolder = useCallback(() => {
    setNewFolderOpen(true);
    setFolderError(null);
  }, []);

  const handleCancelNewFolder = useCallback(() => {
    setNewFolderOpen(false);
    setFolderError(null);
  }, []);

  const handleCreateFolder = useCallback(
    async (name: string) => {
      if (creatingFolder) return;

      setCreatingFolder(true);
      setFolderError(null);

      try {
        const folderId = await folderRepository.createFolder(name);
        if (!mountedRef.current) return;

        // Reload the folder list so the new folder appears in the sidebar,
        // then navigate by the stable id returned from createFolder (never by
        // name). A reload failure must not block navigation.
        try {
          const items = await folderRepository.listFolders();
          if (mountedRef.current) {
            setFolders(items);
            setFolderStatus("ready");
          }
        } catch (error) {
          console.error("Library: could not reload folders after create", error);
          if (mountedRef.current) setFolderStatus("error");
        }

        if (!mountedRef.current) return;

        setNewFolderOpen(false);
        setFolderError(null);
        setDestination({ kind: "folder", folderId });
        setSelectedId(null);
      } catch (error) {
        console.error("Library: could not create folder", error);
        if (mountedRef.current) setFolderError(t("library.folderCreateFailed"));
      } finally {
        if (mountedRef.current) setCreatingFolder(false);
      }
    },
    [creatingFolder, folderRepository, t],
  );

  const deleteTarget =
    summaries.find((summary) => summary.id === deleteTargetId) ?? null;
  const presentationDestination = isPresentationDestination(destination);
  const stylesDestination = destination === "styles";
  const palettesDestination = destination === "palettes";
  const visibleSummaries = useMemo(
    () => filterPresentationsByDestination(summaries, destination),
    [summaries, destination],
  );

  const emptyMessage =
    destination === "archived"
      ? t("library.archivedEmpty")
      : isFolderDestination(destination)
        ? t("library.folderEmpty")
        : t("library.empty");

  return (
    <div className={styles.library}>
      <Topbar className={styles.libraryTopbar}>
        <ProductSurfaceBrand surface="studio" />

        <TopbarActions>
          {user?.displayName ?? user?.email ? (
            <span className={styles.headerUser}>
              {user?.displayName ?? user?.email}
            </span>
          ) : null}

          <Button
            variant="secondary"
            size="compact"
            disabled={signingOut}
            onClick={handleSignOut}
          >
            {signingOut ? t("auth.signingOut") : t("auth.signOut")}
          </Button>
        </TopbarActions>

        <TopbarLocale>
          <LocaleSelector />
        </TopbarLocale>
      </Topbar>

      {actionError ? (
        <p className={styles.errorText} role="alert">
          {actionError}
        </p>
      ) : null}

      <div className={styles.workspace} onKeyDown={handleWorkspaceKeyDown}>
        <input
          ref={importInputRef}
          type="file"
          accept=".json,.powershow.json,application/json"
          hidden
          onChange={(event) => void handleImportFile(event)}
          aria-label={t("library.import")}
        />
        <StudioSidebar
          destination={destination}
          onDestinationChange={handleDestinationChange}
          folders={folders}
          folderStatus={folderStatus}
          newFolderOpen={newFolderOpen}
          creatingFolder={creatingFolder}
          folderError={folderError}
          onCancelNewFolder={handleCancelNewFolder}
          onCreateFolder={(name) => void handleCreateFolder(name)}
          onRetryFolders={() => void loadFolders()}
        />

        <main className={styles.main}>
          <div className={styles.workspaceHeading}>
            <div>
              <p className={styles.eyebrow}>
                {destinationSectionTitle(destination, t)}
              </p>
              <h1>{destinationTitle(destination, t, folders)}</h1>
            </div>
            {presentationDestination ? (
              <PresentationToolbar
                selected={selected}
                liveState={liveState}
                creating={creating}
                openingId={openingId}
                archivingId={archivingId}
                restoringId={restoringId}
                deletingId={deletingId}
                transferBusy={transferBusy}
                newFolderDisabled={newFolderOpen || creatingFolder}
                onNew={() => void handleNew()}
                onNewFolder={handleOpenNewFolder}
                onEdit={handleOpen}
                onPresent={(summary) => void handlePresent(summary)}
                onControl={() => router.push(STUDIO_ROUTES.control)}
                onEnd={() => void handleEnd()}
                onArchive={(id) => void handleArchive(id)}
                onRestore={(id) => void handleRestore(id)}
                onDelete={handleRequestDelete}
                onImport={handleImport}
                onExport={() => void handleExport()}
              />
            ) : null}
          </div>

          <div className={styles.workspaceBody}>
            <section
              className={styles.browserPane}
              aria-live="polite"
              onClick={handleBrowserBackgroundClick}
            >
              {presentationDestination ? (
                <>
                  {status === "loading" ? (
                    <p className={styles.stateBlock}>{t("library.loading")}</p>
                  ) : null}

                  {status === "error" ? (
                    <div className={styles.stateBlock}>
                      <p>{t("library.couldNotLoad")}</p>
                      <Button size="compact" onClick={() => void loadPresentations()}>
                        {t("library.retry")}
                      </Button>
                    </div>
                  ) : null}

                  {status === "ready" && visibleSummaries.length === 0 ? (
                    <p className={styles.stateBlock}>{emptyMessage}</p>
                  ) : null}

                  {status === "ready" && visibleSummaries.length > 0 ? (
                    <PresentationList
                      summaries={visibleSummaries}
                      selectedId={selectedId}
                      liveState={liveState}
                      openingId={openingId}
                      onSelect={handleToggleSelection}
                    />
                  ) : null}
                </>
              ) : stylesDestination ? (
                <>
                  {customLibraryStatus === "loading" ? (
                    <p className={styles.stateBlock}>{t("customLibrary.browser.loading")}</p>
                  ) : null}
                  {customLibraryStatus === "error" ? (
                    <div className={styles.stateBlock}>
                      <p>{customLibraryError ?? t("customLibrary.browser.loadFailed")}</p>
                      <Button size="compact" onClick={() => void loadCustomLibraryItems()}>
                        {t("customLibrary.browser.retry")}
                      </Button>
                    </div>
                  ) : null}
                  {customLibraryStatus === "ready" && customLibraryItems.length === 0 ? (
                    <div className={styles.stateBlock}>
                      <p>{t("customLibrary.browser.empty")}</p>
                      <p>{t("customLibrary.browser.emptyHint")}</p>
                    </div>
                  ) : null}
                  {customLibraryStatus === "ready" && customLibraryItems.length > 0 ? (
                    <CustomLibraryBrowser
                      items={customLibraryItems}
                      selectedId={selectedCustomLibraryItemId}
                      onSelect={handleToggleCustomLibrarySelection}
                    />
                  ) : null}
                </>
              ) : palettesDestination ? (
                <>
                  {customLibraryPaletteStatus === "loading" ? (
                    <p className={styles.stateBlock}>{t("customLibrary.paletteBrowser.loading")}</p>
                  ) : null}
                  {customLibraryPaletteStatus === "error" ? (
                    <div className={styles.stateBlock}>
                      <p>{customLibraryPaletteError ?? t("customLibrary.paletteBrowser.loadFailed")}</p>
                      <Button size="compact" onClick={() => void loadCustomLibraryPalettes()}>
                        {t("customLibrary.paletteBrowser.retry")}
                      </Button>
                    </div>
                  ) : null}
                  {customLibraryPaletteStatus === "ready" && customLibraryPalettes.length === 0 ? (
                    <div className={styles.stateBlock}>
                      <p>{t("customLibrary.paletteBrowser.empty")}</p>
                      <p>{t("customLibrary.paletteBrowser.emptyHint")}</p>
                    </div>
                  ) : null}
                  {customLibraryPaletteStatus === "ready" && customLibraryPalettes.length > 0 ? (
                    <CustomLibraryPaletteBrowser
                      records={customLibraryPalettes}
                      selectedId={selectedCustomLibraryPaletteId}
                      onSelect={handleToggleCustomLibraryPaletteSelection}
                    />
                  ) : null}
                </>
              ) : (
                <div className={styles.placeholder}>
                  <p className={styles.placeholderTitle}>
                    {destinationTitle(destination, t, folders)}
                  </p>
                  {isCustomLibraryDestination(destination) ? (
                    <p>{t(`library.destination.${destination}`)}</p>
                  ) : null}
                </div>
              )}
            </section>

            {stylesDestination ? (
              <CustomLibraryDetails
                record={selectedCustomLibraryItem}
                onDelete={handleRequestCustomLibraryDelete}
              />
            ) : palettesDestination ? (
              <CustomLibraryPaletteDetails
                record={selectedCustomLibraryPalette}
                onDelete={handleRequestCustomLibraryPaletteDelete}
              />
            ) : (
              <PresentationDetails
                summary={presentationDestination ? selected : null}
                liveState={liveState}
                folders={folders}
                movingId={movingId}
                onMoveFolder={(folderId) => {
                  if (selected) void handleMoveFolder(selected.id, folderId);
                }}
              />
            )}
          </div>
        </main>
      </div>

      {deleteTargetId !== null ? (
        <DeletePresentationDialog
          key={deleteTargetId}
          summary={deleteTarget}
          deleting={deletingId !== null}
          error={deleteError}
          onCancel={handleCancelDelete}
          onConfirm={() => void handleConfirmDelete()}
        />
      ) : null}

      {customLibraryDeleteTargetId !== null ? (
        <CustomLibraryDeleteDialog
          record={customLibraryItems.find((record) => record.id === customLibraryDeleteTargetId) ?? null}
          deleting={deletingCustomLibraryItemId !== null}
          error={customLibraryError}
          onCancel={handleCancelCustomLibraryDelete}
          onConfirm={() => void handleConfirmCustomLibraryDelete()}
        />
      ) : null}

      {customLibraryPaletteDeleteTargetId !== null ? (
        <CustomLibraryPaletteDeleteDialog
          record={customLibraryPalettes.find((record) => record.id === customLibraryPaletteDeleteTargetId) ?? null}
          deleting={deletingCustomLibraryPaletteId !== null}
          error={customLibraryPaletteError}
          onCancel={handleCancelCustomLibraryPaletteDelete}
          onConfirm={() => void handleConfirmCustomLibraryPaletteDelete()}
        />
      ) : null}
    </div>
  );
}
