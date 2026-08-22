// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const testDependencies = vi.hoisted(() => ({
  push: vi.fn(),
  signOut: vi.fn(async () => {}),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: testDependencies.push }),
}));

vi.mock("../src/features/auth/studio-auth-provider", () => ({
  useStudioAuth: () => ({
    user: { displayName: "Test user", email: "test@example.com" },
    signOut: testDependencies.signOut,
  }),
}));

vi.mock("../src/features/control/live-current", () => ({
  subscribeLiveCurrent: (onState: (state: { kind: string }) => void) => {
    onState({ kind: "none" });
    return () => {};
  },
  activateLivePresentation: vi.fn(async () => {}),
  endLivePresentation: vi.fn(async () => {}),
}));

import { StudioI18nProvider } from "../src/features/i18n/studio-i18n-context";
import { PresentationLibrary } from "../src/features/library/presentation-library";
import { createBlankPresentation } from "../src/features/persistence/presentation-repository-instance";
import type { PresentationRepository } from "../src/features/persistence/presentation-repository";
import type { PresentationRecoveryInspection } from "../src/features/persistence/presentation-repository";
import type { PresentationFolderRepository } from "../src/features/persistence/presentation-folder-repository";
import type { PresentationSummary } from "../src/features/persistence/presentation-persistence";
import type { PresentationFolder } from "../src/features/persistence/presentation-folder";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

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

function firestoreTimestamp(millis: number) {
  return {
    seconds: Math.floor(millis / 1000),
    nanoseconds: (millis % 1000) * 1_000_000,
  };
}

interface Harness {
  repository: PresentationRepository;
  folderRepository: PresentationFolderRepository;
  listPresentations: ReturnType<typeof vi.fn>;
  getPresentation: ReturnType<typeof vi.fn>;
  createPresentation: ReturnType<typeof vi.fn>;
  archivePresentation: ReturnType<typeof vi.fn>;
  restorePresentation: ReturnType<typeof vi.fn>;
  deleteArchivedPresentation: ReturnType<typeof vi.fn>;
  movePresentationToFolder: ReturnType<typeof vi.fn>;
  listFolders: ReturnType<typeof vi.fn>;
  createFolder: ReturnType<typeof vi.fn>;
  getSummaries: () => PresentationSummary[];
  setSummaries: (next: PresentationSummary[]) => void;
  getFolders: () => PresentationFolder[];
  setFolders: (next: PresentationFolder[]) => void;
}

function buildHarness(
  options: { summaries?: PresentationSummary[]; folders?: PresentationFolder[] } = {},
): Harness {
  let summaries = [...(options.summaries ?? [])];
  let folders = [...(options.folders ?? [])];

  const listPresentations = vi.fn(async () => summaries);
  const getPresentation = vi.fn(async () => null);
  const createPresentation = vi.fn(async () => {});
  const archivePresentation = vi.fn(async (id: string) => {
    summaries = summaries.map((item) =>
      item.id === id
        ? { ...item, archived: true, archivedAt: "archived-ts" }
        : item,
    );
  });
  const restorePresentation = vi.fn(async (id: string) => {
    summaries = summaries.map((item) =>
      item.id === id ? { ...item, archived: false, archivedAt: null } : item,
    );
  });
  const deleteArchivedPresentation = vi.fn(async (id: string) => {
    summaries = summaries.filter((item) => item.id !== id);
  });
  const movePresentationToFolder = vi.fn(
    async (id: string, folderId: string | null) => {
      summaries = summaries.map((item) =>
        item.id === id ? { ...item, folderId } : item,
      );
    },
  );

  const repository: PresentationRepository = {
    listPresentations,
    getPresentation,
    createPresentation,
    savePresentation: vi.fn(async () => {}),
    archivePresentation,
    restorePresentation,
    deleteArchivedPresentation,
    movePresentationToFolder,
    publishPresentation: vi.fn(async () => ({
      publicationId: "publication-id",
      versionId: "version-id",
      publishedRevision: 1,
      createdVersion: true,
    })),
    inspectPresentationRecovery: vi.fn(
      async (): Promise<PresentationRecoveryInspection> => ({
        status: "valid",
        issues: [],
      }),
    ),
    repairPresentation: vi.fn(async () => ({
      presentation: createBlankPresentation("fake"),
      repaired: false,
    })),
  };

  const listFolders = vi.fn(async () => folders);
  const createFolder = vi.fn(async () => "folder-created");

  const folderRepository: PresentationFolderRepository = {
    listFolders,
    createFolder,
    renameFolder: vi.fn(async () => {}),
  };

  return {
    repository,
    folderRepository,
    listPresentations,
    getPresentation,
    createPresentation,
    archivePresentation,
    restorePresentation,
    deleteArchivedPresentation,
    movePresentationToFolder,
    listFolders,
    createFolder,
    getSummaries: () => summaries,
    setSummaries: (next) => {
      summaries = next;
    },
    getFolders: () => folders,
    setFolders: (next) => {
      folders = next;
    },
  };
}

describe("presentation library folders workspace", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    testDependencies.push.mockClear();
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    document.body.innerHTML = "";
  });

  async function flushWorkspaceEffects() {
    await act(async () => {
      for (let i = 0; i < 6; i += 1) {
        await Promise.resolve();
      }
    });
  }

  async function renderLibrary(harness: Harness) {
    act(() => {
      root.render(
        <StudioI18nProvider>
          <PresentationLibrary
            repository={harness.repository}
            folderRepository={harness.folderRepository}
          />
        </StudioI18nProvider>,
      );
    });
    await flushWorkspaceEffects();
  }

  function buttonsWithText(text: string): HTMLButtonElement[] {
    return Array.from(container.querySelectorAll<HTMLButtonElement>("button")).filter(
      (button) => button.textContent === text,
    );
  }

  function clickButton(text: string) {
    const button = buttonsWithText(text)[0];
    if (!button) throw new Error(`expected button "${text}"`);
    act(() => button.click());
  }

  function selectRow(title: string) {
    const row = container.querySelector<HTMLButtonElement>(
      `[aria-label="Select presentation ${title}"]`,
    );
    if (!row) throw new Error(`expected presentation row "${title}"`);
    act(() => row.click());
  }

  function setInputValue(input: HTMLInputElement | null, value: string) {
    if (!input) return;
    const setter = Object.getOwnPropertyDescriptor(
      window.HTMLInputElement.prototype,
      "value",
    )?.set;
    setter?.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  }

  async function submitInlineForm() {
    const form = container.querySelector("form");
    if (!form) throw new Error("expected inline folder form");
    act(() => {
      form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    });
    await flushWorkspaceEffects();
  }

  function changeFolderSelect(value: string) {
    const select = container.querySelector<HTMLSelectElement>(
      '[aria-label="Details"] select',
    );
    if (!select) throw new Error("expected folder select");
    const setter = Object.getOwnPropertyDescriptor(
      window.HTMLSelectElement.prototype,
      "value",
    )?.set;
    setter?.call(select, value);
    act(() => {
      select.dispatchEvent(new Event("change", { bubbles: true }));
    });
  }

  it("requests presentations once with includeArchived true", async () => {
    const harness = buildHarness();

    await renderLibrary(harness);

    expect(harness.listPresentations).toHaveBeenCalledTimes(1);
    expect(harness.listPresentations).toHaveBeenCalledWith({
      includeArchived: true,
    });
    expect(harness.getPresentation).not.toHaveBeenCalled();
  });

  it("lists active presentations in All regardless of folderId", async () => {
    const harness = buildHarness({
      summaries: [
        summary({ id: "root" }),
        summary({ id: "in-folder", folderId: "folder-a" }),
        summary({ id: "archived", archived: true, archivedAt: "archived-ts" }),
      ],
      folders: [folder("folder-a", "Alpha")],
    });

    await renderLibrary(harness);

    expect(container.textContent).toContain("Title root");
    expect(container.textContent).toContain("Title in-folder");
    expect(container.textContent).not.toContain("Title archived");
  });

  it("shows only archived presentations in Archived", async () => {
    const harness = buildHarness({
      summaries: [
        summary({ id: "active" }),
        summary({
          id: "archived",
          archived: true,
          archivedAt: "archived-ts",
          folderId: "folder-a",
        }),
      ],
    });

    await renderLibrary(harness);
    clickButton("Archived");

    expect(container.textContent).toContain("Title archived");
    expect(container.textContent).not.toContain("Title active");
  });

  it("shows only matching non-archived presentations in a folder with the folder name as heading", async () => {
    const harness = buildHarness({
      summaries: [
        summary({ id: "a", folderId: "folder-a" }),
        summary({ id: "b", folderId: "folder-b" }),
        summary({ id: "arch-a", folderId: "folder-a", archived: true, archivedAt: "archived-ts" }),
      ],
      folders: [folder("folder-a", "Alpha"), folder("folder-b", "Beta")],
    });

    await renderLibrary(harness);
    clickButton("Alpha");

    const heading = container.querySelector("h1");
    expect(heading?.textContent).toBe("Alpha");
    expect(container.textContent).toContain("Title a");
    expect(container.textContent).not.toContain("Title b");
    expect(container.textContent).not.toContain("Title arch-a");
    expect(harness.getPresentation).not.toHaveBeenCalled();
  });

  it("renders loaded folders as sidebar navigation items without exposing ids", async () => {
    const harness = buildHarness({
      folders: [folder("folder-a", "Math"), folder("folder-b", "Science")],
    });

    await renderLibrary(harness);

    expect(buttonsWithText("Math")).toHaveLength(1);
    expect(buttonsWithText("Science")).toHaveLength(1);
    expect(container.textContent).not.toContain("folder-a");
    expect(container.textContent).not.toContain("folder-b");
  });

  it("selects a folder destination and clears presentation selection", async () => {
    const harness = buildHarness({
      summaries: [summary({ id: "one" })],
      folders: [folder("folder-a", "Alpha")],
    });

    await renderLibrary(harness);
    selectRow("Title one");
    expect(container.querySelector('[data-selected="true"]')).toBeTruthy();

    clickButton("Alpha");

    const alpha = buttonsWithText("Alpha")[0];
    expect(alpha?.getAttribute("data-active")).toBe("true");
    expect(alpha?.getAttribute("aria-current")).toBe("page");
    expect(container.querySelector('[data-selected="true"]')).toBeNull();
  });

  it("keeps presentations rendering when folder loading fails", async () => {
    const harness = buildHarness({ summaries: [summary({ id: "one" })] });
    harness.listFolders.mockRejectedValue(new Error("boom"));
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    await renderLibrary(harness);

    expect(container.textContent).toContain("Title one");
    expect(container.textContent).toContain("Could not load folders.");
    errorSpy.mockRestore();
  });

  it("opens the inline New folder editor from the global management action", async () => {
    const harness = buildHarness();

    await renderLibrary(harness);
    clickButton("New folder");

    expect(container.querySelector('input[type="text"]')).toBeTruthy();
    expect(buttonsWithText("Create folder")).toHaveLength(1);
    expect(buttonsWithText("Cancel")).toHaveLength(1);
  });

  it("submits the inline editor with the typed folder name", async () => {
    const harness = buildHarness();

    await renderLibrary(harness);
    clickButton("New folder");

    const input = container.querySelector<HTMLInputElement>('input[type="text"]');
    if (!input) throw new Error("expected folder name input");
    act(() => setInputValue(input, "Physics"));

    await submitInlineForm();

    expect(harness.createFolder).toHaveBeenCalledWith("Physics");
  });

  it("navigates to the newly created folder by the returned id", async () => {
    const harness = buildHarness();
    harness.createFolder.mockResolvedValue("folder-created");
    harness.listFolders.mockResolvedValue([folder("folder-created", "Physics")]);

    await renderLibrary(harness);
    clickButton("New folder");

    const input = container.querySelector<HTMLInputElement>('input[type="text"]');
    if (!input) throw new Error("expected folder name input");
    act(() => setInputValue(input, "Physics"));

    await submitInlineForm();

    expect(container.querySelector("h1")?.textContent).toBe("Physics");
    expect(buttonsWithText("Physics")[0]?.getAttribute("data-active")).toBe("true");
    expect(harness.createFolder).toHaveBeenCalledWith("Physics");
  });

  it("navigates by the returned folderId instead of rediscovering by name", async () => {
    const harness = buildHarness();
    harness.createFolder.mockResolvedValue("folder-created");

    let listCalls = 0;
    harness.listFolders.mockImplementation(async () => {
      listCalls += 1;
      if (listCalls === 1) {
        return [folder("folder-existing", "Physics")];
      }
      return [folder("folder-existing", "Physics"), folder("folder-created", "Physics")];
    });

    await renderLibrary(harness);
    expect(buttonsWithText("Physics")).toHaveLength(1);

    clickButton("New folder");
    const input = container.querySelector<HTMLInputElement>('input[type="text"]');
    if (!input) throw new Error("expected folder name input");
    act(() => setInputValue(input, "Physics"));

    await submitInlineForm();

    const physicsButtons = buttonsWithText("Physics");
    expect(physicsButtons).toHaveLength(2);
    // The second folder carries the returned id and must be the active one,
    // proving navigation used the returned id rather than a name lookup.
    expect(physicsButtons[1]?.getAttribute("data-active")).toBe("true");
    expect(physicsButtons[0]?.getAttribute("data-active")).toBe("false");
  });

  it("closes the inline editor on Cancel without persisting", async () => {
    const harness = buildHarness();

    await renderLibrary(harness);
    clickButton("New folder");
    expect(container.querySelector('input[type="text"]')).toBeTruthy();

    clickButton("Cancel");

    expect(container.querySelector('input[type="text"]')).toBeNull();
    expect(harness.createFolder).not.toHaveBeenCalled();
  });

  it("closes the inline editor on Escape without persisting", async () => {
    const harness = buildHarness();

    await renderLibrary(harness);
    clickButton("New folder");

    const input = container.querySelector<HTMLInputElement>('input[type="text"]');
    if (!input) throw new Error("expected folder name input");

    act(() => {
      input.dispatchEvent(
        new KeyboardEvent("keydown", { key: "Escape", bubbles: true }),
      );
    });

    expect(container.querySelector('input[type="text"]')).toBeNull();
    expect(harness.createFolder).not.toHaveBeenCalled();
  });

  it("keeps the editor open with an error and preserved value when creation fails", async () => {
    const harness = buildHarness();
    harness.createFolder.mockRejectedValue(new Error("nope"));
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    await renderLibrary(harness);
    clickButton("New folder");

    const input = container.querySelector<HTMLInputElement>('input[type="text"]');
    if (!input) throw new Error("expected folder name input");
    act(() => setInputValue(input, "Physics"));

    await submitInlineForm();

    expect(container.querySelector('input[type="text"]')).toBeTruthy();
    expect(container.textContent).toContain("Could not create folder.");
    expect(
      container.querySelector<HTMLInputElement>('input[type="text"]')?.value,
    ).toBe("Physics");
    errorSpy.mockRestore();
  });

  it("creates a presentation inside the current folder", async () => {
    const harness = buildHarness({ folders: [folder("folder-a", "Alpha")] });

    await renderLibrary(harness);
    clickButton("Alpha");
    clickButton("+ New presentation");
    await flushWorkspaceEffects();

    expect(harness.createPresentation).toHaveBeenCalledTimes(1);
    expect(harness.createPresentation).toHaveBeenCalledWith(
      expect.any(Object),
      { folderId: "folder-a" },
    );
    expect(testDependencies.push).toHaveBeenCalledWith(
      expect.stringContaining("/studio/editor?id="),
    );
  });

  it("creates a presentation without a folderId in All", async () => {
    const harness = buildHarness();

    await renderLibrary(harness);
    clickButton("+ New presentation");
    await flushWorkspaceEffects();

    expect(harness.createPresentation).toHaveBeenCalledTimes(1);
    expect(harness.createPresentation.mock.calls[0]).toHaveLength(1);
  });

  it("creates a presentation without a folderId in Archived", async () => {
    const harness = buildHarness();

    await renderLibrary(harness);
    clickButton("Archived");
    clickButton("+ New presentation");
    await flushWorkspaceEffects();

    expect(harness.createPresentation).toHaveBeenCalledTimes(1);
    expect(harness.createPresentation.mock.calls[0]).toHaveLength(1);
  });

  it("exposes a folder selector in Details for an active selection", async () => {
    const harness = buildHarness({
      summaries: [summary({ id: "one" })],
      folders: [folder("folder-a", "Alpha"), folder("folder-b", "Beta")],
    });

    await renderLibrary(harness);
    selectRow("Title one");

    const select = container.querySelector<HTMLSelectElement>(
      '[aria-label="Details"] select',
    );
    expect(select).toBeTruthy();
    expect(select?.value).toBe("");
    expect(Array.from(select?.options ?? [])[0]?.textContent).toBe("No folder");
    expect(select?.textContent).toContain("Alpha");
    expect(select?.textContent).toContain("Beta");
  });

  it("moves from All while keeping the presentation visible and updating Details", async () => {
    const harness = buildHarness({
      summaries: [summary({ id: "one" })],
      folders: [folder("folder-a", "Alpha"), folder("folder-b", "Beta")],
    });

    await renderLibrary(harness);
    selectRow("Title one");
    changeFolderSelect("folder-a");
    await flushWorkspaceEffects();

    expect(harness.movePresentationToFolder).toHaveBeenCalledWith("one", "folder-a");
    expect(container.textContent).toContain("Title one");
    expect(container.querySelector('[data-selected="true"]')).toBeTruthy();
    expect(
      container.querySelector<HTMLSelectElement>('[aria-label="Details"] select')
        ?.value,
    ).toBe("folder-a");
  });

  it("moves out of the current folder, removing it from that view and clearing selection", async () => {
    const harness = buildHarness({
      summaries: [summary({ id: "one", folderId: "folder-a" })],
      folders: [folder("folder-a", "Alpha"), folder("folder-b", "Beta")],
    });

    await renderLibrary(harness);
    clickButton("Alpha");
    selectRow("Title one");
    changeFolderSelect("folder-b");
    await flushWorkspaceEffects();

    expect(harness.movePresentationToFolder).toHaveBeenCalledWith("one", "folder-b");
    expect(container.textContent).not.toContain("Title one");
    expect(container.querySelector('[data-selected="true"]')).toBeNull();
  });

  it("moves a presentation to No folder with a null folderId", async () => {
    const harness = buildHarness({
      summaries: [summary({ id: "one", folderId: "folder-a" })],
      folders: [folder("folder-a", "Alpha")],
    });

    await renderLibrary(harness);
    clickButton("Alpha");
    selectRow("Title one");
    changeFolderSelect("");
    await flushWorkspaceEffects();

    expect(harness.movePresentationToFolder).toHaveBeenCalledWith("one", null);
  });

  it("shows archived Details read-only without a folder selector", async () => {
    const harness = buildHarness({
      summaries: [
        summary({
          id: "one",
          archived: true,
          archivedAt: firestoreTimestamp(Date.UTC(2026, 0, 15)),
          folderId: "folder-a",
        }),
      ],
      folders: [folder("folder-a", "Alpha")],
    });

    await renderLibrary(harness);
    clickButton("Archived");
    selectRow("Title one");

    const details = container.querySelector<HTMLElement>('[aria-label="Details"]');
    expect(details?.querySelector("select")).toBeNull();
    expect(details?.textContent).toContain("Alpha");
    expect(details?.textContent).toContain("Archived");
    expect(details?.textContent).not.toContain("folder-a");
  });

  it("exposes Restore and Delete but not Present/Edit/Archive/Control/End for archived", async () => {
    const harness = buildHarness({
      summaries: [
        summary({
          id: "one",
          archived: true,
          archivedAt: firestoreTimestamp(Date.UTC(2026, 0, 1)),
        }),
      ],
    });

    await renderLibrary(harness);
    clickButton("Archived");
    selectRow("Title one");

    expect(buttonsWithText("Restore")).toHaveLength(1);
    expect(buttonsWithText("Delete")).toHaveLength(1);
    expect(buttonsWithText("Present")).toHaveLength(0);
    expect(buttonsWithText("Edit")).toHaveLength(0);
    expect(buttonsWithText("Archive")).toHaveLength(0);
    expect(buttonsWithText("Control")).toHaveLength(0);
    expect(buttonsWithText("End")).toHaveLength(0);
  });

  it("Restore calls restorePresentation with the selected id", async () => {
    const harness = buildHarness({
      summaries: [
        summary({ id: "one", archived: true, archivedAt: "archived-ts" }),
      ],
    });

    await renderLibrary(harness);
    clickButton("Archived");
    selectRow("Title one");
    clickButton("Restore");
    await flushWorkspaceEffects();

    expect(harness.restorePresentation).toHaveBeenCalledWith("one");
    expect(harness.getPresentation).not.toHaveBeenCalled();
  });

  it("removes a restored item from Archived after refresh", async () => {
    const harness = buildHarness({
      summaries: [
        summary({ id: "one", archived: true, archivedAt: "archived-ts" }),
        summary({ id: "two", archived: true, archivedAt: "archived-ts" }),
      ],
    });

    await renderLibrary(harness);
    clickButton("Archived");
    selectRow("Title one");
    clickButton("Restore");
    await flushWorkspaceEffects();

    expect(container.textContent).not.toContain("Title one");
    expect(container.textContent).toContain("Title two");
    expect(container.querySelector('[data-selected="true"]')).toBeNull();
  });

  it("preserves the original folderId so a restored item appears in its folder", async () => {
    const harness = buildHarness({
      summaries: [
        summary({
          id: "one",
          archived: true,
          archivedAt: "archived-ts",
          folderId: "folder-a",
        }),
      ],
      folders: [folder("folder-a", "Alpha")],
    });

    await renderLibrary(harness);
    clickButton("Archived");
    selectRow("Title one");
    clickButton("Restore");
    await flushWorkspaceEffects();

    clickButton("Alpha");
    expect(container.textContent).toContain("Title one");
  });

  it("Archive removes an active item from All and makes it eligible for Archived", async () => {
    const harness = buildHarness({
      summaries: [summary({ id: "one" }), summary({ id: "two" })],
    });

    await renderLibrary(harness);
    selectRow("Title one");
    clickButton("Archive");
    await flushWorkspaceEffects();

    expect(harness.archivePresentation).toHaveBeenCalledWith("one");
    expect(container.textContent).not.toContain("Title one");
    expect(container.textContent).toContain("Title two");

    clickButton("Archived");
    expect(container.textContent).toContain("Title one");
    expect(harness.getPresentation).not.toHaveBeenCalled();
  });

  it("opens the confirmation dialog on Delete without deleting", async () => {
    const harness = buildHarness({
      summaries: [summary({ id: "one", archived: true, archivedAt: "archived-ts" })],
    });

    await renderLibrary(harness);
    clickButton("Archived");
    selectRow("Title one");
    clickButton("Delete");

    const dialog = container.querySelector<HTMLElement>('[role="dialog"]');
    expect(dialog).toBeTruthy();
    expect(dialog?.getAttribute("aria-modal")).toBe("true");
    expect(dialog?.querySelector("input")).toBeTruthy();
    expect(harness.deleteArchivedPresentation).not.toHaveBeenCalled();
  });

  it("keeps Delete permanently disabled until the exact display title is typed", async () => {
    const harness = buildHarness({
      summaries: [summary({ id: "one", archived: true, archivedAt: "archived-ts" })],
    });

    await renderLibrary(harness);
    clickButton("Archived");
    selectRow("Title one");
    clickButton("Delete");

    const destructive = () =>
      Array.from(container.querySelectorAll("button")).find(
        (button) => button.textContent === "Delete permanently",
      ) as HTMLButtonElement;
    const input = container.querySelector<HTMLInputElement>(
      '[role="dialog"] input',
    );

    expect(destructive().disabled).toBe(true);

    // Case-sensitive so the wrong casing stays disabled.
    act(() => setInputValue(input, "title one"));
    expect(destructive().disabled).toBe(true);

    act(() => setInputValue(input, "Title one"));
    expect(destructive().disabled).toBe(false);
  });

  it("uses the localized fallback phrase for a blank-title presentation", async () => {
    const harness = buildHarness({
      summaries: [
        summary({ id: "blank", title: "", archived: true, archivedAt: "archived-ts" }),
      ],
    });

    await renderLibrary(harness);
    clickButton("Archived");
    selectRow("Untitled");
    clickButton("Delete");

    const dialogText = container.querySelector('[role="dialog"]')?.textContent ?? "";
    expect(dialogText).toContain("Untitled");

    const destructive = () =>
      Array.from(container.querySelectorAll("button")).find(
        (button) => button.textContent === "Delete permanently",
      ) as HTMLButtonElement;
    const input = container.querySelector<HTMLInputElement>(
      '[role="dialog"] input',
    );

    act(() => setInputValue(input, "Untitled"));
    expect(destructive().disabled).toBe(false);
  });

  it("Cancel closes the dialog without deleting", async () => {
    const harness = buildHarness({
      summaries: [summary({ id: "one", archived: true, archivedAt: "archived-ts" })],
    });

    await renderLibrary(harness);
    clickButton("Archived");
    selectRow("Title one");
    clickButton("Delete");
    clickButton("Cancel");

    expect(container.querySelector('[role="dialog"]')).toBeNull();
    expect(harness.deleteArchivedPresentation).not.toHaveBeenCalled();
  });

  it("Escape closes the dialog without deleting", async () => {
    const harness = buildHarness({
      summaries: [summary({ id: "one", archived: true, archivedAt: "archived-ts" })],
    });

    await renderLibrary(harness);
    clickButton("Archived");
    selectRow("Title one");
    clickButton("Delete");

    const input = container.querySelector<HTMLInputElement>(
      '[role="dialog"] input',
    );
    act(() => {
      input?.dispatchEvent(
        new KeyboardEvent("keydown", { key: "Escape", bubbles: true }),
      );
    });

    expect(container.querySelector('[role="dialog"]')).toBeNull();
    expect(harness.deleteArchivedPresentation).not.toHaveBeenCalled();
  });

  it("confirmed deletion calls deleteArchivedPresentation, reloads, and clears the row", async () => {
    const harness = buildHarness({
      summaries: [summary({ id: "one", archived: true, archivedAt: "archived-ts" })],
    });

    await renderLibrary(harness);
    clickButton("Archived");
    selectRow("Title one");
    clickButton("Delete");

    const input = container.querySelector<HTMLInputElement>(
      '[role="dialog"] input',
    );
    act(() => setInputValue(input, "Title one"));
    clickButton("Delete permanently");
    await flushWorkspaceEffects();

    expect(harness.deleteArchivedPresentation).toHaveBeenCalledWith("one");
    expect(harness.listPresentations).toHaveBeenLastCalledWith({
      includeArchived: true,
    });
    expect(container.querySelector('[role="dialog"]')).toBeNull();
    expect(container.querySelector('[data-selected="true"]')).toBeNull();
    expect(container.textContent).not.toContain("Title one");
  });

  it("keeps the dialog open with a localized error when deletion fails", async () => {
    const harness = buildHarness({
      summaries: [summary({ id: "one", archived: true, archivedAt: "archived-ts" })],
    });
    harness.deleteArchivedPresentation.mockRejectedValue(new Error("nope"));
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    await renderLibrary(harness);
    clickButton("Archived");
    selectRow("Title one");
    clickButton("Delete");

    const input = container.querySelector<HTMLInputElement>(
      '[role="dialog"] input',
    );
    act(() => setInputValue(input, "Title one"));
    clickButton("Delete permanently");
    await flushWorkspaceEffects();

    expect(container.querySelector('[role="dialog"]')).toBeTruthy();
    expect(container.textContent).toContain("Could not delete presentation.");
    errorSpy.mockRestore();
  });
});
