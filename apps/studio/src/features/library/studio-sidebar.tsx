"use client";

import { useEffect, useRef, useState } from "react";

import type { KeyboardEvent as ReactKeyboardEvent } from "react";

import { Button } from "@powershow/ui";

import { useStudioI18n } from "../i18n/studio-i18n-context";
import type { PresentationFolder } from "../persistence/presentation-folder";

import {
  isSameLibraryDestination,
  type FolderLibraryDestination,
  type LibraryDestination,
} from "./presentation-library-logic";
import styles from "./presentation-library.module.css";

type FolderStatus = "loading" | "ready" | "error";

interface StudioSidebarProps {
  destination: LibraryDestination;
  onDestinationChange: (destination: LibraryDestination) => void;
  folders: readonly PresentationFolder[];
  folderStatus: FolderStatus;
  newFolderOpen: boolean;
  creatingFolder: boolean;
  folderError: string | null;
  onCancelNewFolder: () => void;
  onCreateFolder: (name: string) => void;
  onRetryFolders: () => void;
}

function folderDestination(folderId: string): FolderLibraryDestination {
  return { kind: "folder", folderId };
}

interface InlineFolderEditorProps {
  creating: boolean;
  error: string | null;
  placeholder: string;
  createLabel: string;
  cancelLabel: string;
  onCreate: (name: string) => void;
  onCancel: () => void;
}

/**
 * Compact inline folder-name input rendered inside the Folders sidebar area.
 * It owns its own draft value so a failed create preserves what the user
 * typed, and it closes only through the parent on success, cancel, or Escape.
 */
function InlineFolderEditor({
  creating,
  error,
  placeholder,
  createLabel,
  cancelLabel,
  onCreate,
  onCancel,
}: InlineFolderEditorProps) {
  const [value, setValue] = useState("");
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const submit = () => {
    if (creating) return;
    onCreate(value);
  };

  return (
    <form
      className={styles.inlineFolderEditor}
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
    >
      <input
        ref={inputRef}
        className={styles.inlineFolderInput}
        type="text"
        value={value}
        placeholder={placeholder}
        aria-label={placeholder}
        disabled={creating}
        onChange={(event) => setValue(event.target.value)}
        onKeyDown={(event: ReactKeyboardEvent<HTMLInputElement>) => {
          if (event.key === "Escape") {
            event.preventDefault();
            onCancel();
          }
        }}
      />

      {error ? (
        <p className={styles.inlineFolderError} role="alert">
          {error}
        </p>
      ) : null}

      <span className={styles.inlineFolderActions}>
        <Button
          type="submit"
          variant="primary"
          size="compact"
          disabled={creating}
        >
          {createLabel}
        </Button>
        <Button type="button" size="compact" disabled={creating} onClick={onCancel}>
          {cancelLabel}
        </Button>
      </span>
    </form>
  );
}

/**
 * Studio fixed sidebar information architecture:
 *
 * - Presentations: All, Archived (fixed navigation)
 * - Folders: Explorer-like organization for presentations. Each folder is a
 *   real navigation destination keyed by its stable folderId; the display
 *   name is never used as identity.
 * - Resources: Custom Library, Styles, Palettes, Fonts (fixed navigation)
 */
export function StudioSidebar({
  destination,
  onDestinationChange,
  folders,
  folderStatus,
  newFolderOpen,
  creatingFolder,
  folderError,
  onCancelNewFolder,
  onCreateFolder,
  onRetryFolders,
}: StudioSidebarProps) {
  const { t } = useStudioI18n();

  const item = (value: LibraryDestination, label: string) => {
    const active = isSameLibraryDestination(destination, value);

    return (
      <button
        type="button"
        className={styles.sidebarItem}
        data-active={active}
        aria-current={active ? "page" : undefined}
        onClick={() => onDestinationChange(value)}
      >
        {label}
      </button>
    );
  };

  return (
    <aside className={styles.sidebar}>
      <nav className={styles.sidebarNav} aria-label={t("library.navigation")}>
        <section className={styles.sidebarSection}>
          <h2>{t("library.presentations")}</h2>
          {item("all", t("library.all"))}
          {item("archived", t("library.archived"))}
        </section>

        <section
          className={`${styles.sidebarSection} ${styles.sidebarFoldersSection}`}
        >
          <h2>{t("library.folders")}</h2>

          {newFolderOpen ? (
            <InlineFolderEditor
              creating={creatingFolder}
              error={folderError}
              placeholder={t("library.folderNamePlaceholder")}
              createLabel={t("library.folderCreate")}
              cancelLabel={t("library.cancel")}
              onCreate={onCreateFolder}
              onCancel={onCancelNewFolder}
            />
          ) : null}

          <div className={styles.sidebarFolderList}>
            {folderStatus === "loading" ? (
              <p className={styles.sidebarEmptyState}>{t("library.foldersLoading")}</p>
            ) : null}

            {folderStatus === "error" ? (
              <div className={styles.sidebarFoldersError}>
                <p className={styles.sidebarEmptyState}>
                  {t("library.foldersCouldNotLoad")}
                </p>
                <Button size="compact" onClick={onRetryFolders}>
                  {t("library.retry")}
                </Button>
              </div>
            ) : null}

            {folderStatus === "ready" && folders.length === 0 ? (
              <p className={styles.sidebarEmptyState}>{t("library.foldersEmpty")}</p>
            ) : null}

            {folderStatus === "ready"
              ? folders.map((folder) => (
                  <button
                    key={folder.id}
                    type="button"
                    className={styles.sidebarItem}
                    data-active={isSameLibraryDestination(
                      destination,
                      folderDestination(folder.id),
                    )}
                    aria-current={
                      isSameLibraryDestination(
                        destination,
                        folderDestination(folder.id),
                      )
                        ? "page"
                        : undefined
                    }
                    title={folder.name}
                    onClick={() => onDestinationChange(folderDestination(folder.id))}
                  >
                    <span className={styles.sidebarFolderName}>{folder.name}</span>
                  </button>
                ))
              : null}
          </div>
        </section>

        <section className={styles.sidebarSection}>
          <h2>{t("library.resources")}</h2>
          {item("customLibrary", t("library.customLibrary"))}
          {item("styles", t("library.styles"))}
          {item("palettes", t("library.palettes"))}
          {item("fonts", t("library.fonts"))}
        </section>
      </nav>
    </aside>
  );
}
