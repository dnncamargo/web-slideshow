import { describe, expect, it } from "vitest";

import type { PresentationSummary } from "../src/features/persistence/presentation-persistence";
import type { PresentationFolder } from "../src/features/persistence/presentation-folder";
import {
  filterPresentationsByDestination,
  isFolderDestination,
  isPresentationDestination,
  isCustomLibraryDestination,
  isSameLibraryDestination,
  isSummaryVisibleInDestination,
  resolveFolderName,
  resolvePresentationToolbarState,
} from "../src/features/library/presentation-library-logic";

function summary(
  overrides: Partial<PresentationSummary> & { id: string },
): PresentationSummary {
  return {
    title: `Title ${overrides.id}`,
    updatedAt: "ts",
    archived: false,
    archivedAt: null,
    folderId: null,
    publicationState: "draft",
    draftRevision: 1,
    publication: undefined,
    ...overrides,
  };
}

function folder(id: string, name: string): PresentationFolder {
  return { id, name, createdAt: null, updatedAt: null };
}

describe("library destination model", () => {
  it("distinguishes folder, presentation, and Custom Library destinations", () => {
    expect(isFolderDestination({ kind: "folder", folderId: "f1" })).toBe(true);
    expect(isFolderDestination("all")).toBe(false);

    expect(isPresentationDestination("all")).toBe(true);
    expect(isPresentationDestination("archived")).toBe(true);
    expect(isPresentationDestination({ kind: "folder", folderId: "f1" })).toBe(true);
    expect(isPresentationDestination("styles")).toBe(false);

    expect(isCustomLibraryDestination("styles")).toBe(true);
    expect(isCustomLibraryDestination("palettes")).toBe(true);
    expect(isCustomLibraryDestination("fonts")).toBe(true);
    expect(isCustomLibraryDestination("all")).toBe(false);
  });

  it("compares destinations by identity, not by name or reference", () => {
    expect(isSameLibraryDestination("all", "all")).toBe(true);
    expect(isSameLibraryDestination("all", "archived")).toBe(false);

    expect(
      isSameLibraryDestination(
        { kind: "folder", folderId: "f1" },
        { kind: "folder", folderId: "f1" },
      ),
    ).toBe(true);
    expect(
      isSameLibraryDestination(
        { kind: "folder", folderId: "f1" },
        { kind: "folder", folderId: "f2" },
      ),
    ).toBe(false);
    expect(isSameLibraryDestination({ kind: "folder", folderId: "f1" }, "all")).toBe(false);
  });
});

describe("presentation filtering", () => {
  const activeRoot = summary({ id: "root" });
  const activeFolderA = summary({ id: "a", folderId: "folder-a" });
  const activeFolderB = summary({ id: "b", folderId: "folder-b" });
  const archivedInFolderA = summary({
    id: "arch-a",
    folderId: "folder-a",
    archived: true,
    archivedAt: "archived-ts",
  });

  it("All shows every non-archived presentation regardless of folderId", () => {
    const visible = filterPresentationsByDestination(
      [activeRoot, activeFolderA, activeFolderB, archivedInFolderA],
      "all",
    );

    expect(visible.map((item) => item.id)).toEqual(["root", "a", "b"]);
  });

  it("Archived shows only archived presentations", () => {
    const visible = filterPresentationsByDestination(
      [activeRoot, archivedInFolderA],
      "archived",
    );

    expect(visible.map((item) => item.id)).toEqual(["arch-a"]);
  });

  it("Folder shows only non-archived presentations with the matching folderId", () => {
    const visible = filterPresentationsByDestination(
      [activeFolderA, activeFolderB, archivedInFolderA],
      { kind: "folder", folderId: "folder-a" },
    );

    expect(visible.map((item) => item.id)).toEqual(["a"]);
  });

  it("isSummaryVisibleInDestination mirrors the filter semantics", () => {
    expect(
      isSummaryVisibleInDestination(activeFolderA, { kind: "folder", folderId: "folder-a" }),
    ).toBe(true);
    expect(
      isSummaryVisibleInDestination(activeFolderA, { kind: "folder", folderId: "folder-b" }),
    ).toBe(false);
    expect(isSummaryVisibleInDestination(activeFolderA, "all")).toBe(true);
    expect(isSummaryVisibleInDestination(activeFolderA, "archived")).toBe(false);
    expect(isSummaryVisibleInDestination(activeFolderA, "styles")).toBe(false);
  });

  it("resolveFolderName resolves by id and returns undefined when missing", () => {
    const folders = [folder("folder-a", "Alpha")];

    expect(resolveFolderName(folders, "folder-a")).toBe("Alpha");
    expect(resolveFolderName(folders, "missing")).toBeUndefined();
  });
});

describe("archived toolbar resolution", () => {
  const archivedSummary = summary({
    id: "arch",
    archived: true,
    archivedAt: "archived-ts",
  });

  it("resolves an archived selection to Restore and Delete", () => {
    expect(resolvePresentationToolbarState(archivedSummary, { kind: "none" })).toEqual({
      mode: "archived",
      actions: ["restore", "delete"],
      transferAction: "export",
      canPresent: false,
    });
  });

  it("does not offer Present, Edit, Archive, Control, or End for archived", () => {
    const state = resolvePresentationToolbarState(archivedSummary, { kind: "none" });

    expect(state.actions).not.toContain("present");
    expect(state.actions).not.toContain("edit");
    expect(state.actions).not.toContain("archive");
    expect(state.actions).not.toContain("control");
    expect(state.actions).not.toContain("end");
    expect(state.canPresent).toBe(false);
  });
});
