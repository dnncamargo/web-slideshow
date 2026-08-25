// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PresentationSchema, type Presentation } from "@powershow/document-schema";

type TestLiveState =
  | { kind: "none" }
  | {
      kind: "active";
      live: {
        publicationId: string;
        currentVersionId: string;
        revision: number;
      };
    };

const testDependencies = vi.hoisted(() => ({
  push: vi.fn(),
  signOut: vi.fn(async () => {}),
  liveState: { kind: "none" } as TestLiveState,
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
  subscribeLiveCurrent: (onState: (state: TestLiveState) => void) => {
    onState(testDependencies.liveState);
    return () => {};
  },
  activateLivePresentation: vi.fn(async () => {}),
  endLivePresentation: vi.fn(async () => {}),
}));

import { StudioI18nProvider } from "../src/features/i18n/studio-i18n-context";
import { PresentationLibrary } from "../src/features/library/presentation-library";
import { PresentationList } from "../src/features/library/presentation-list";
import { PresentationToolbar } from "../src/features/library/presentation-toolbar";
import { createBlankPresentation } from "../src/features/persistence/presentation-repository-instance";
import type { PresentationRepository } from "../src/features/persistence/presentation-repository";
import type { PresentationRecoveryInspection } from "../src/features/persistence/presentation-repository";
import type { PresentationFolderRepository } from "../src/features/persistence/presentation-folder-repository";
import type { PresentationSummary } from "../src/features/persistence/presentation-persistence";
import type {
  CustomLibraryItemRecord,
  CustomLibraryRepository,
} from "../src/features/custom-library/custom-library-repository";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

function summary(
  id: string,
  publicationState: PresentationSummary["publicationState"] = "draft",
): PresentationSummary {
  return {
    id,
    title: `Title ${id}`,
    updatedAt: "ts",
    archived: false,
    archivedAt: null,
    folderId: null,
    publicationState,
    draftRevision: 1,
    publication:
      publicationState === "draft"
        ? undefined
        : {
            publicationId: `publication-${id}`,
            currentVersionId: `version-${id}`,
            publishedRevision: 1,
            publishedAt: "date",
          },
  };
}

function presentation(id = "presentation-source"): Presentation {
  return PresentationSchema.parse({
    schemaVersion: 1,
    id,
    title: "Imported presentation",
    description: "Imported description",
    aspectRatio: "16:9",
    slides: [
      {
        id: "slide-source",
        elements: [{ id: "text-source", type: "text", content: "Imported text" }],
      },
    ],
  });
}

function importFile(text: string): File {
  return {
    name: "source.json",
    type: "application/json",
    text: async () => text,
  } as unknown as File;
}

/** Minimal Firestore-server-timestamp-like shape used by the SDK. */
function firestoreTimestamp(millis: number) {
  return {
    seconds: Math.floor(millis / 1000),
    nanoseconds: (millis % 1000) * 1_000_000,
  };
}

function renderToolbar(
  selected: PresentationSummary | null,
  liveState: React.ComponentProps<typeof PresentationToolbar>["liveState"] = {
    kind: "none",
  },
) {
  return (
    <StudioI18nProvider>
      <PresentationToolbar
        selected={selected}
        liveState={liveState}
        creating={false}
        openingId={null}
        archivingId={null}
        restoringId={null}
        deletingId={null}
        transferBusy={false}
        newFolderDisabled={false}
        onNew={vi.fn()}
        onNewFolder={vi.fn()}
        onEdit={vi.fn()}
        onPresent={vi.fn()}
        onControl={vi.fn()}
        onEnd={vi.fn()}
        onArchive={vi.fn()}
        onRestore={vi.fn()}
        onDelete={vi.fn()}
        onImport={vi.fn()}
        onExport={vi.fn()}
      />
    </StudioI18nProvider>
  );
}

function renderLibrary(
  repository: PresentationRepository,
  folderRepository?: PresentationFolderRepository,
  customLibraryRepository?: CustomLibraryRepository,
) {
  return (
    <StudioI18nProvider>
      <PresentationLibrary
        repository={repository}
        folderRepository={folderRepository ?? emptyFolderRepository()}
        customLibraryRepository={customLibraryRepository}
      />
    </StudioI18nProvider>
  );
}

function customLibraryItem(
  id: string,
  name: string,
  description?: string,
): CustomLibraryItemRecord {
  return {
    id,
    item: {
      name,
      ...(description ? { description } : {}),
      root: {
        type: "container",
        properties: [
          { path: "layout.width", value: "100%" },
          { path: "style.background", value: "#secret-background" },
        ],
        children: [
          {
            type: "scripted",
            properties: [
              { path: "html", value: "<p>secret html</p>" },
              { path: "css", value: ".secret { color: red; }" },
              { path: "script", value: "alert('secret')" },
            ],
          },
          { type: "text", properties: [] },
        ],
      },
    },
  };
}

function customLibraryRepositoryFor(initialItems: CustomLibraryItemRecord[]) {
  let current = initialItems;
  const listItems = vi.fn(async () => current);
  const deleteItem = vi.fn(async (id: string) => {
    current = current.filter((item) => item.id !== id);
  });
  const repository: CustomLibraryRepository = {
    saveItem: vi.fn(async () => "unused"),
    listItems,
    getItem: vi.fn(async () => null),
    deleteItem,
  };
  return { repository, listItems, deleteItem, getCurrent: () => current };
}

function emptyFolderRepository(): PresentationFolderRepository {
  return {
    listFolders: vi.fn(async () => []),
    createFolder: vi.fn(async () => "folder-new"),
    renameFolder: vi.fn(async () => {}),
  };
}

async function flushWorkspaceEffects() {
  await act(async () => {
    await new Promise<void>((resolve) => queueMicrotask(resolve));
  });
}

async function selectImportFile(container: HTMLDivElement, file: File) {
  const input = container.querySelector<HTMLInputElement>('input[type="file"]');
  if (!input) throw new Error("expected import input");

  Object.defineProperty(input, "files", {
    configurable: true,
    value: [file],
  });
  await act(async () => {
    input.dispatchEvent(new Event("change", { bubbles: true }));
    await new Promise<void>((resolve) => queueMicrotask(resolve));
  });
}

function repositoryFor(
  initialSummaries: PresentationSummary[],
  presentations: Record<string, Presentation | null> = {},
): {
  repository: PresentationRepository;
  getCurrent: () => PresentationSummary[];
  listPresentations: ReturnType<typeof vi.fn>;
} {
  let current = initialSummaries;
  const listPresentations = vi.fn(async () => current);
  const repository: PresentationRepository = {
    listPresentations,
    getPresentation: vi.fn(async (id: string) => presentations[id] ?? null),
    createPresentation: vi.fn(async () => {}),
    savePresentation: vi.fn(async () => {}),
    archivePresentation: vi.fn(async (id: string) => {
      current = current.filter((item) => item.id !== id);
    }),
    restorePresentation: vi.fn(async () => {}),
    deleteArchivedPresentation: vi.fn(async () => {}),
    movePresentationToFolder: vi.fn(async () => {}),
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

  return { repository, getCurrent: () => current, listPresentations };
}

describe("presentation library workspace controls", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    testDependencies.liveState = { kind: "none" };
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    document.body.innerHTML = "";
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("shows New with enabled Import and enabled New folder actions when nothing is selected", () => {
    act(() => root.render(renderToolbar(null)));

    expect(container.textContent).toContain("+ New presentation");

    const importButton = Array.from(container.querySelectorAll("button")).find(
      (button) => button.textContent === "Import",
    );
    expect(importButton).toBeTruthy();
    expect(importButton?.disabled).toBe(false);

    const folder = Array.from(container.querySelectorAll("button")).find(
      (button) => button.textContent === "New folder",
    );
    expect(folder).toBeTruthy();
    expect(folder?.disabled).toBe(false);
  });

  it("keeps New presentation available for inactive and Live selections", () => {
    act(() => root.render(renderToolbar(summary("published", "published"))));
    expect(container.textContent).toContain("+ New presentation");

    act(() => root.render(renderToolbar(summary("draft"))));
    expect(container.textContent).toContain("+ New presentation");

    act(() =>
      root.render(
        renderToolbar(summary("live", "published"), {
          kind: "active",
          live: {
            publicationId: "publication-live",
            currentVersionId: "version-live",
            revision: 1,
          },
        }),
      ),
    );
    expect(container.textContent).toContain("+ New presentation");
  });

  it("shows enabled Export whenever a presentation is selected", () => {
    act(() => root.render(renderToolbar(null)));
    expect(
      Array.from(container.querySelectorAll("button")).some(
        (button) => button.textContent === "Export",
      ),
    ).toBe(false);
    expect(
      Array.from(container.querySelectorAll("button")).some(
        (button) => button.textContent === "Import",
      ),
    ).toBe(true);

    act(() => root.render(renderToolbar(summary("published", "published"))));
    const publishedExport = Array.from(container.querySelectorAll("button")).find(
      (button) => button.textContent === "Export",
    );
    expect(publishedExport).toBeTruthy();
    expect(publishedExport?.disabled).toBe(false);
    // Export replaces Import in the transfer slot when selected.
    expect(
      Array.from(container.querySelectorAll("button")).some(
        (button) => button.textContent === "Import",
      ),
    ).toBe(false);

    act(() => root.render(renderToolbar(summary("draft"))));
    const draftExport = Array.from(container.querySelectorAll("button")).find(
      (button) => button.textContent === "Export",
    );
    expect(draftExport).toBeTruthy();
    expect(draftExport?.disabled).toBe(false);
  });

  it("exports the selected full presentation, downloads it, and revokes the object URL", async () => {
    const source = presentation("selected-id");
    const { repository } = repositoryFor([summary("selected-id")], {
      "selected-id": source,
    });
    const createObjectURL = vi.fn(() => "blob:test");
    const revokeObjectURL = vi.fn();
    vi.stubGlobal("URL", { createObjectURL, revokeObjectURL });
    const anchorClick = vi
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(() => {});

    act(() => root.render(renderLibrary(repository)));
    await flushWorkspaceEffects();
    const row = container.querySelector<HTMLButtonElement>(
      '[aria-label="Select presentation Title selected-id"]',
    );
    if (!row) throw new Error("expected selected presentation row");
    act(() => row.click());

    const exportButton = Array.from(container.querySelectorAll("button")).find(
      (button) => button.textContent === "Export",
    );
    if (!exportButton) throw new Error("expected Export action");
    await act(async () => {
      exportButton.click();
      await new Promise<void>((resolve) => queueMicrotask(resolve));
    });

    expect(repository.getPresentation).toHaveBeenCalledWith("selected-id");
    expect(createObjectURL).toHaveBeenCalledTimes(1);
    expect(anchorClick).toHaveBeenCalledTimes(1);
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:test");
  });

  it("fails safely when the selected presentation is missing during export", async () => {
    const { repository } = repositoryFor([summary("missing")]);
    act(() => root.render(renderLibrary(repository)));
    await flushWorkspaceEffects();
    const row = container.querySelector<HTMLButtonElement>(
      '[aria-label="Select presentation Title missing"]',
    );
    if (!row) throw new Error("expected missing presentation row");
    act(() => row.click());

    const exportButton = Array.from(container.querySelectorAll("button")).find(
      (button) => button.textContent === "Export",
    );
    if (!exportButton) throw new Error("expected Export action");
    await act(async () => {
      exportButton.click();
      await new Promise<void>((resolve) => queueMicrotask(resolve));
    });

    expect(container.querySelector('[role="alert"]')?.textContent).toBe(
      "Could not export presentation.",
    );
  });

  it("imports a new root id while preserving canonical internal ids and navigates to the Editor", async () => {
    const source = presentation();
    const { repository } = repositoryFor([]);
    act(() => root.render(renderLibrary(repository)));
    await flushWorkspaceEffects();

    await selectImportFile(
      container,
      importFile(JSON.stringify(source)),
    );

    const imported = (repository.createPresentation as ReturnType<typeof vi.fn>)
      .mock.calls[0]?.[0] as Presentation;
    expect(imported.id).not.toBe(source.id);
    expect(imported.slides[0]?.id).toBe("slide-source");
    expect(imported.slides[0]?.elements[0]?.id).toBe("text-source");
    expect(testDependencies.push).toHaveBeenCalledWith(
      `/studio/editor?id=${encodeURIComponent(imported.id)}`,
    );
  });

  it("passes the current folder id when importing inside a folder", async () => {
    const source = presentation();
    const { repository } = repositoryFor([]);
    const folderRepository: PresentationFolderRepository = {
      ...emptyFolderRepository(),
      listFolders: vi.fn(async () => [
        { id: "folder-1", name: "Folder 1", createdAt: "now", updatedAt: "now" },
      ]),
    };
    act(() => root.render(renderLibrary(repository, folderRepository)));
    await flushWorkspaceEffects();

    const folder = Array.from(container.querySelectorAll("button")).find(
      (button) => button.textContent === "Folder 1",
    );
    if (!folder) throw new Error("expected folder destination");
    act(() => folder.click());
    await flushWorkspaceEffects();
    await selectImportFile(
      container,
      importFile(JSON.stringify(source)),
    );

    expect(repository.createPresentation).toHaveBeenCalledWith(
      expect.anything(),
      { folderId: "folder-1" },
    );
  });

  it.each([
    ["malformed JSON", "{", "The selected file is not valid JSON."],
    [
      "schema-invalid JSON",
      JSON.stringify({ schemaVersion: 2 }),
      "The selected file is not a valid PowerShow presentation.",
    ],
  ])("does not write when importing %s", async (_name, text, message) => {
    const { repository } = repositoryFor([]);
    act(() => root.render(renderLibrary(repository)));
    await flushWorkspaceEffects();

    await selectImportFile(
      container,
      importFile(text),
    );

    expect(repository.createPresentation).not.toHaveBeenCalled();
    expect(container.querySelector('[role="alert"]')?.textContent).toBe(message);
  });

  it("does not navigate when import persistence fails", async () => {
    const { repository } = repositoryFor([]);
    (repository.createPresentation as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error("write failed"),
    );
    act(() => root.render(renderLibrary(repository)));
    await flushWorkspaceEffects();

    await selectImportFile(
      container,
      importFile(JSON.stringify(presentation())),
    );

    expect(testDependencies.push).not.toHaveBeenCalled();
    expect(container.querySelector('[role="alert"]')?.textContent).toBe(
      "Could not import presentation.",
    );
  });

  it("checks another generated id after a collision before creating an import", async () => {
    const source = presentation();
    const { repository } = repositoryFor([]);
    const getPresentation = repository.getPresentation as ReturnType<typeof vi.fn>;
    getPresentation
      .mockResolvedValueOnce(presentation("collision"))
      .mockResolvedValueOnce(null);

    act(() => root.render(renderLibrary(repository)));
    await flushWorkspaceEffects();
    await selectImportFile(
      container,
      importFile(JSON.stringify(source)),
    );

    const firstCandidate = getPresentation.mock.calls[0]?.[0];
    const secondCandidate = getPresentation.mock.calls[1]?.[0];
    expect(firstCandidate).toBeDefined();
    expect(secondCandidate).toBeDefined();
    expect(secondCandidate).not.toBe(firstCandidate);
    expect(repository.createPresentation).toHaveBeenCalledWith(
      expect.objectContaining({ id: secondCandidate }),
    );
  });

  it("allows the same file to be selected again after handling it", async () => {
    const source = presentation();
    const { repository } = repositoryFor([]);
    act(() => root.render(renderLibrary(repository)));
    await flushWorkspaceEffects();
    const file = importFile(JSON.stringify(source));

    await selectImportFile(container, file);
    await selectImportFile(container, file);

    expect(repository.createPresentation).toHaveBeenCalledTimes(2);
  });

  it("shows contextual actions for published, unpublished, and live selections", () => {
    act(() => root.render(renderToolbar(summary("published", "published"))));
    expect(container.textContent).toContain("Present");
    expect(container.textContent).toContain("Edit");
    expect(container.textContent).toContain("Archive");

    act(() => root.render(renderToolbar(summary("draft"))));
    const present = Array.from(container.querySelectorAll("button")).find(
      (button) => button.textContent === "Present",
    );
    expect(present?.disabled).toBe(true);

    act(() =>
      root.render(
        renderToolbar(summary("live", "published"), {
          kind: "active",
          live: {
            publicationId: "publication-live",
            currentVersionId: "version-live",
            revision: 1,
          },
        }),
      ),
    );
    expect(container.textContent).toContain("Control");
    expect(container.textContent).toContain("End");
    expect(container.textContent).toContain("Edit");
    expect(container.textContent).not.toContain("Archive");
  });

  it("exposes Restore and Delete for an archived unpublished selection", () => {
    const archivedUnpublished: PresentationSummary = {
      ...summary("arch"),
      archived: true,
      archivedAt: "ts",
    };

    act(() => root.render(renderToolbar(archivedUnpublished)));

    expect(container.textContent).toContain("Restore");
    expect(container.textContent).toContain("Delete");
  });

  it("does not expose Delete for an active selection", () => {
    act(() => root.render(renderToolbar(summary("active", "published"))));

    expect(container.textContent).not.toContain("Delete");
    expect(container.textContent).not.toContain("Restore");
  });

  it("shows a disabled Delete for a published archived selection", () => {
    const publishedArchived: PresentationSummary = {
      ...summary("pa", "published"),
      archived: true,
      archivedAt: "ts",
    };

    act(() => root.render(renderToolbar(publishedArchived)));

    const deleteButton = Array.from(container.querySelectorAll("button")).find(
      (button) => button.textContent === "Delete",
    );
    expect(deleteButton).toBeTruthy();
    expect(deleteButton?.disabled).toBe(true);
  });

  it("explains the published-artifact limitation on the disabled Delete", () => {
    const publishedArchived: PresentationSummary = {
      ...summary("pa", "published"),
      archived: true,
      archivedAt: "ts",
    };

    act(() => root.render(renderToolbar(publishedArchived)));

    const deleteButton = Array.from(container.querySelectorAll("button")).find(
      (button) => button.textContent === "Delete",
    );
    expect(deleteButton?.getAttribute("title")).toBe(
      "Deleting published presentations is not available yet.",
    );
  });

  it("renders no contextual group when nothing is selected", () => {
    act(() => root.render(renderToolbar(null)));

    expect(container.querySelector('[role="group"]')).toBeNull();
    expect(container.textContent).not.toContain("Present");
    expect(container.textContent).not.toContain("Edit");
    expect(container.textContent).not.toContain("Archive");

    // Global management remains visible without a selection.
    expect(container.textContent).toContain("+ New presentation");
    expect(container.textContent).toContain("Import");
    expect(container.textContent).toContain("New folder");
  });

  it("places the selected title immediately before the contextual action buttons semantically", () => {
    act(() => root.render(renderToolbar(summary("published", "published"))));

    const text = container.textContent;
    if (!text) throw new Error("expected toolbar text");

    // textContent concatenates in DOM order, so the title must precede the
    // contextual Present/Edit/Archive buttons.
    expect(text.indexOf("Title published")).toBeGreaterThanOrEqual(0);
    expect(text.indexOf("Present")).toBeGreaterThan(
      text.indexOf("Title published"),
    );
    expect(text.indexOf("Edit")).toBeGreaterThan(
      text.indexOf("Title published"),
    );
    expect(text.indexOf("Archive")).toBeGreaterThan(
      text.indexOf("Title published"),
    );

    // The title is a distinct semantic element before the buttons.
    const contextGroup = container.querySelector<HTMLElement>('[role="group"]');
    const title = contextGroup?.querySelector('[title="Title published"]');
    expect(title).toBeTruthy();
  });

  it("keeps row controls out of the presentation list and selects one row at a time", () => {
    const onSelect = vi.fn();
    act(() =>
      root.render(
        <StudioI18nProvider>
          <PresentationList
            summaries={[summary("one"), summary("two", "published")]}
            selectedId="one"
            liveState={{ kind: "none" }}
            openingId={null}
            onSelect={onSelect}
          />
        </StudioI18nProvider>,
      ),
    );

    expect(container.querySelectorAll("button")).toHaveLength(2);
    expect(container.textContent).not.toContain("Edit");
    expect(container.textContent).not.toContain("Archive");
    expect(container.querySelector('[data-selected="true"]')).toBeTruthy();
    expect(container.querySelectorAll('[aria-pressed="true"]')).toHaveLength(1);

    const rows = container.querySelectorAll<HTMLButtonElement>("button");
    act(() => rows[1]?.click());
    expect(onSelect).toHaveBeenCalledWith("two");
  });

  it("selects exactly one presentation row at a time through the real library", async () => {
    const { repository } = repositoryFor([summary("one"), summary("two")]);

    act(() => root.render(renderLibrary(repository)));
    await flushWorkspaceEffects();

    const selectedRows = () =>
      container.querySelectorAll<HTMLButtonElement>('[data-selected="true"]');

    const firstRow = container.querySelector<HTMLButtonElement>(
      '[aria-label="Select presentation Title one"]',
    );
    if (!firstRow) throw new Error("expected first presentation row");
    act(() => firstRow.click());

    expect(selectedRows()).toHaveLength(1);
    expect(selectedRows()[0]?.getAttribute("aria-label")).toBe(
      "Select presentation Title one",
    );

    const secondRow = container.querySelector<HTMLButtonElement>(
      '[aria-label="Select presentation Title two"]',
    );
    if (!secondRow) throw new Error("expected second presentation row");
    act(() => secondRow.click());

    expect(selectedRows()).toHaveLength(1);
    expect(selectedRows()[0]?.getAttribute("aria-label")).toBe(
      "Select presentation Title two",
    );
  });

  it("deselects the selected row when it is clicked again", async () => {
    const { repository } = repositoryFor([summary("one"), summary("two")]);

    act(() => root.render(renderLibrary(repository)));
    await flushWorkspaceEffects();

    const firstRow = container.querySelector<HTMLButtonElement>(
      '[aria-label="Select presentation Title one"]',
    );
    if (!firstRow) throw new Error("expected first presentation row");
    act(() => firstRow.click());
    expect(container.querySelector('[data-selected="true"]')).toBeTruthy();

    act(() => firstRow.click());
    expect(container.querySelector('[data-selected="true"]')).toBeNull();
    expect(container.querySelectorAll('[aria-pressed="true"]')).toHaveLength(0);
  });

  it("clears selection with Escape while the workspace has focus", async () => {
    const { repository } = repositoryFor([summary("one")]);

    act(() => root.render(renderLibrary(repository)));
    await flushWorkspaceEffects();

    const firstRow = container.querySelector<HTMLButtonElement>(
      '[aria-label="Select presentation Title one"]',
    );
    if (!firstRow) throw new Error("expected first presentation row");
    act(() => firstRow.click());
    expect(container.querySelector('[data-selected="true"]')).toBeTruthy();

    act(() => {
      firstRow.dispatchEvent(
        new KeyboardEvent("keydown", { key: "Escape", bubbles: true }),
      );
    });
    expect(container.querySelector('[data-selected="true"]')).toBeNull();
  });

  it("clears selection by clicking apparent empty space inside the list/browser", async () => {
    const { repository } = repositoryFor([summary("one")]);

    act(() => root.render(renderLibrary(repository)));
    await flushWorkspaceEffects();

    const firstRow = container.querySelector<HTMLButtonElement>(
      '[aria-label="Select presentation Title one"]',
    );
    if (!firstRow) throw new Error("expected first presentation row");
    act(() => firstRow.click());
    expect(container.querySelector('[data-selected="true"]')).toBeTruthy();

    // Click the list container's own empty space (not a row, not a control).
    const list = firstRow.closest("ul");
    if (!list) throw new Error("expected presentation list");

    act(() => {
      list.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    expect(container.querySelector('[data-selected="true"]')).toBeNull();
  });

  it("does not clear selection when clicking a presentation row", async () => {
    const { repository } = repositoryFor([summary("one"), summary("two")]);

    act(() => root.render(renderLibrary(repository)));
    await flushWorkspaceEffects();

    const firstRow = container.querySelector<HTMLButtonElement>(
      '[aria-label="Select presentation Title one"]',
    );
    if (!firstRow) throw new Error("expected first presentation row");
    act(() => firstRow.click());
    expect(container.querySelector('[data-selected="true"]')).toBeTruthy();

    const secondRow = container.querySelector<HTMLButtonElement>(
      '[aria-label="Select presentation Title two"]',
    );
    if (!secondRow) throw new Error("expected second presentation row");

    // Click inside the row (its details text), which must toggle selection
    // to the second row and never be swallowed by background deselection.
    const rowContent = secondRow.querySelector("strong");
    if (!rowContent) throw new Error("expected row title content");

    act(() => {
      rowContent.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    const selectedRows = container.querySelectorAll('[data-selected="true"]');
    expect(selectedRows).toHaveLength(1);
    expect(selectedRows[0]?.getAttribute("aria-label")).toBe(
      "Select presentation Title two",
    );
  });

  it("clears selection after archive, reloads summaries, and does not fetch full presentations", async () => {
    const { repository, getCurrent } = repositoryFor([
      summary("one", "published"),
      summary("two", "draft"),
    ]);

    act(() => root.render(renderLibrary(repository)));
    await flushWorkspaceEffects();

    const firstRow = container.querySelector<HTMLButtonElement>(
      '[aria-label="Select presentation Title one"]',
    );
    if (!firstRow) throw new Error("expected first presentation row");
    act(() => firstRow.click());

    const archive = Array.from(container.querySelectorAll("button")).find(
      (button) => button.textContent === "Archive",
    );
    if (!archive) throw new Error("expected contextual Archive action");
    act(() => archive.click());
    await flushWorkspaceEffects();

    expect(getCurrent().map((item) => item.id)).toEqual(["two"]);
    expect(container.textContent).not.toContain("Title one");
    expect(container.querySelector('[data-selected="true"]')).toBeNull();
    expect(repository.archivePresentation).toHaveBeenCalledWith("one");
    expect(repository.listPresentations).toHaveBeenCalledTimes(2);
    expect(repository.getPresentation).not.toHaveBeenCalled();
  });

  it("clears selection and performs no persistence work for placeholder destinations", async () => {
    const { repository, listPresentations } = repositoryFor([summary("one")]);

    act(() => root.render(renderLibrary(repository)));
    await flushWorkspaceEffects();

    const firstRow = container.querySelector<HTMLButtonElement>(
      '[aria-label="Select presentation Title one"]',
    );
    if (!firstRow) throw new Error("expected first presentation row");
    act(() => firstRow.click());

    const listCalls = listPresentations.mock.calls.length;
    const stylesDestination = Array.from(container.querySelectorAll("button")).find(
      (button) => button.textContent === "Styles",
    );
    if (!stylesDestination) throw new Error("expected Styles destination");
    act(() => stylesDestination.click());

    expect(container.textContent).toContain("Reusable styles are planned");
    expect(container.querySelector('[data-selected="true"]')).toBeNull();

    const fontsDestination = Array.from(container.querySelectorAll("button")).find(
      (button) => button.textContent === "Fonts",
    );
    if (!fontsDestination) throw new Error("expected Fonts destination");
    act(() => fontsDestination.click());

    expect(container.textContent).toContain("Fonts are planned");
    expect(container.querySelector('[data-selected="true"]')).toBeNull();
    expect(repository.listPresentations).toHaveBeenCalledTimes(listCalls);
    expect(repository.createPresentation).not.toHaveBeenCalled();
    expect(repository.archivePresentation).not.toHaveBeenCalled();
    expect(repository.getPresentation).not.toHaveBeenCalled();
  });

  it("places the Studio user identity in the Topbar actions before Sign out", async () => {
    const { repository } = repositoryFor([]);

    act(() => root.render(renderLibrary(repository)));
    await flushWorkspaceEffects();

    const actions = container.querySelector<HTMLElement>(".ps-ui-topbar__actions");
    if (!actions) throw new Error("expected Topbar actions slot");

    expect(actions.textContent).toContain("Test user");
    expect(actions.textContent).toContain("Sign out");

    const userIndex = actions.textContent?.indexOf("Test user") ?? -1;
    const signOutIndex = actions.textContent?.indexOf("Sign out") ?? -1;
    expect(userIndex).toBeGreaterThanOrEqual(0);
    expect(signOutIndex).toBeGreaterThan(userIndex);
  });

  it("lists Fonts under Resources without a clickable generic Folders destination", async () => {
    const { repository } = repositoryFor([]);

    act(() => root.render(renderLibrary(repository)));
    await flushWorkspaceEffects();

    // Fonts exists as a Resources destination.
    const fontsButton = Array.from(container.querySelectorAll("button")).find(
      (button) => button.textContent === "Fonts",
    );
    expect(fontsButton).toBeTruthy();

    // The Folders section remains, but there is no generic clickable Folders
    // workspace destination. An exact-match button is expected to be absent.
    expect(container.textContent).toContain("Folders");
    expect(container.textContent).toContain("No folders yet.");
    expect(
      Array.from(container.querySelectorAll("button")).some(
        (button) => button.textContent?.trim() === "Folders",
      ),
    ).toBe(false);
  });

  it("shows the empty Details state when nothing is selected", async () => {
    const { repository } = repositoryFor([summary("one")]);

    act(() => root.render(renderLibrary(repository)));
    await flushWorkspaceEffects();

    const details = container.querySelector<HTMLElement>('[aria-label="Details"]');
    if (!details) throw new Error("expected Details pane");

    expect(details.textContent).toContain("Select an item to view details.");
    expect(repository.getPresentation).not.toHaveBeenCalled();
  });

  it("exposes title, publication status and draft revision in Details for the selected presentation", async () => {
    const { repository } = repositoryFor([summary("one", "published")]);

    act(() => root.render(renderLibrary(repository)));
    await flushWorkspaceEffects();

    const firstRow = container.querySelector<HTMLButtonElement>(
      '[aria-label="Select presentation Title one"]',
    );
    if (!firstRow) throw new Error("expected first presentation row");
    act(() => firstRow.click());

    const details = container.querySelector<HTMLElement>('[aria-label="Details"]');
    if (!details) throw new Error("expected Details pane");

    expect(details.textContent).toContain("Title one");
    expect(details.textContent).toContain("Published");
    expect(details.textContent).toContain("Draft revision");
    expect(repository.getPresentation).not.toHaveBeenCalled();
  });

  it("shows summary-backed publication, revision and date information without internal IDs", async () => {
    const published: PresentationSummary = {
      ...summary("rich"),
      publicationState: "unpublished-changes",
      draftRevision: 4,
      updatedAt: firestoreTimestamp(Date.UTC(2026, 0, 2, 12, 0, 0)),
      publication: {
        publicationId: "internal-publication-id",
        currentVersionId: "internal-version-id",
        publishedRevision: 2,
        publishedAt: firestoreTimestamp(Date.UTC(2025, 11, 20, 9, 30, 0)),
      },
    };

    const { repository } = repositoryFor([published]);

    act(() => root.render(renderLibrary(repository)));
    await flushWorkspaceEffects();

    const row = container.querySelector<HTMLButtonElement>(
      '[aria-label="Select presentation Title rich"]',
    );
    if (!row) throw new Error("expected rich presentation row");
    act(() => row.click());

    const details = container.querySelector<HTMLElement>('[aria-label="Details"]');
    if (!details) throw new Error("expected Details pane");

    expect(details.textContent).toContain("Title rich");
    expect(details.textContent).toContain("Unpublished changes");
    expect(details.textContent).toContain("Draft revision");
    expect(details.textContent).toContain("Published revision");
    expect(details.textContent).toContain("Unpublished revision delta");
    expect(details.textContent).toContain("Last updated");
    expect(details.textContent).toContain("Last published");

    // Internal identifiers must never surface in user-facing details.
    expect(details.textContent).not.toContain("internal-publication-id");
    expect(details.textContent).not.toContain("internal-version-id");
    expect(repository.getPresentation).not.toHaveBeenCalled();
  });

  it("shows the Live indication in Details when the active publicationId matches the selected presentation", async () => {
    testDependencies.liveState = {
      kind: "active",
      live: {
        publicationId: "publication-live",
        currentVersionId: "version-live",
        revision: 1,
      },
    };

    const { repository } = repositoryFor([
      {
        ...summary("live", "published"),
        publication: {
          publicationId: "publication-live",
          currentVersionId: "version-live",
          publishedRevision: 1,
          publishedAt: "date",
        },
      },
    ]);

    act(() => root.render(renderLibrary(repository)));
    await flushWorkspaceEffects();

    const row = container.querySelector<HTMLButtonElement>(
      '[aria-label="Select presentation Title live"]',
    );
    if (!row) throw new Error("expected live presentation row");
    act(() => row.click());

    const details = container.querySelector<HTMLElement>('[aria-label="Details"]');
    if (!details) throw new Error("expected Details pane");

    expect(details.textContent).toContain("Live");
    expect(repository.getPresentation).not.toHaveBeenCalled();
  });

  it("lazily loads Custom Library and preserves repository order", async () => {
    const { repository } = repositoryFor([]);
    const custom = customLibraryRepositoryFor([
      customLibraryItem("doc-1", "First item", "First description"),
      customLibraryItem("doc-2", "Second item"),
    ]);

    act(() => root.render(renderLibrary(repository, undefined, custom.repository)));
    await flushWorkspaceEffects();
    expect(custom.listItems).not.toHaveBeenCalled();

    const destination = Array.from(container.querySelectorAll("button")).find(
      (button) => button.textContent === "Custom Library",
    );
    if (!destination) throw new Error("expected Custom Library destination");
    act(() => destination.click());
    await flushWorkspaceEffects();

    expect(custom.listItems).toHaveBeenCalledTimes(1);
    expect(container.textContent?.indexOf("First item")).toBeLessThan(
      container.textContent?.indexOf("Second item") ?? -1,
    );
    expect(container.textContent).toContain("Container");
    expect(container.textContent).not.toContain("doc-1");
  });

  it("shows loading and generic retryable failure states", async () => {
    const { repository } = repositoryFor([]);
    let resolve: ((items: CustomLibraryItemRecord[]) => void) | undefined;
    const listItems = vi.fn(
      () => new Promise<CustomLibraryItemRecord[]>((done) => { resolve = done; }),
    );
    const custom: CustomLibraryRepository = {
      saveItem: vi.fn(async () => "unused"),
      listItems,
      getItem: vi.fn(async () => null),
      deleteItem: vi.fn(async () => {}),
    };

    act(() => root.render(renderLibrary(repository, undefined, custom)));
    await flushWorkspaceEffects();
    const destination = Array.from(container.querySelectorAll("button")).find(
      (button) => button.textContent === "Custom Library",
    );
    if (!destination) throw new Error("expected Custom Library destination");
    act(() => destination.click());
    expect(container.textContent).toContain("Loading Custom Library…");
    resolve?.([]);
    await flushWorkspaceEffects();
    expect(container.textContent).toContain("No Custom Library items yet.");

    const failingList = vi.fn(async () => { throw new Error("malformed persisted record"); });
    const failingCustom: CustomLibraryRepository = { ...custom, listItems: failingList };
    act(() => root.render(renderLibrary(repository, undefined, failingCustom)));
    await flushWorkspaceEffects();
    const failingDestination = Array.from(container.querySelectorAll("button")).find(
      (button) => button.textContent === "Custom Library",
    );
    if (!failingDestination) throw new Error("expected Custom Library destination");
    act(() => failingDestination.click());
    await flushWorkspaceEffects();
    expect(container.textContent).toContain("Could not load Custom Library.");
    const retry = Array.from(container.querySelectorAll("button")).find(
      (button) => button.textContent === "Retry",
    );
    if (!retry) throw new Error("expected Custom Library retry");
    act(() => retry.click());
    await flushWorkspaceEffects();
    expect(failingList).toHaveBeenCalledTimes(2);
    expect(container.textContent).not.toContain("No Custom Library items yet.");
  });

  it("inspects recursive property paths without rendering persisted values", async () => {
    const { repository } = repositoryFor([]);
    const custom = customLibraryRepositoryFor([customLibraryItem("doc-1", "Reusable warning", "Warning description")]);
    act(() => root.render(renderLibrary(repository, undefined, custom.repository)));
    await flushWorkspaceEffects();
    const destination = Array.from(container.querySelectorAll("button")).find(
      (button) => button.textContent === "Custom Library",
    );
    if (!destination) throw new Error("expected Custom Library destination");
    act(() => destination.click());
    await flushWorkspaceEffects();
    const row = container.querySelector<HTMLButtonElement>('[data-custom-library-row]');
    if (!row) throw new Error("expected Custom Library row");
    act(() => row.click());

    const details = container.querySelector<HTMLElement>('[aria-label="Details"]');
    if (!details) throw new Error("expected Custom Library details");
    expect(details.textContent).toContain("Reusable warning");
    expect(details.textContent).toContain("Warning description");
    expect(details.textContent).toContain("layout.width");
    expect(details.textContent).toContain("style.background");
    expect(details.textContent).toContain("html");
    expect(details.textContent).toContain("css");
    expect(details.textContent).toContain("script");
    expect(details.textContent).toContain("No selected properties");
    expect(details.textContent).not.toContain("secret html");
    expect(details.textContent).not.toContain("secret-background");
    expect(details.textContent).not.toContain("alert('secret')");
    expect(repository.getPresentation).not.toHaveBeenCalled();

    act(() => row.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true })));
    expect(details.textContent).toContain("Select an item to view details.");
  });

  it("confirms Custom Library deletion, removes locally, and supports retry after failure", async () => {
    const { repository } = repositoryFor([]);
    const item = customLibraryItem("exact-doc-id", "Delete me");
    const custom = customLibraryRepositoryFor([item]);
    act(() => root.render(renderLibrary(repository, undefined, custom.repository)));
    await flushWorkspaceEffects();
    const destination = Array.from(container.querySelectorAll("button")).find(
      (button) => button.textContent === "Custom Library",
    );
    if (!destination) throw new Error("expected Custom Library destination");
    act(() => destination.click());
    await flushWorkspaceEffects();
    const row = container.querySelector<HTMLButtonElement>('[data-custom-library-row]');
    if (!row) throw new Error("expected Custom Library row");
    act(() => row.click());
    const deleteButton = Array.from(container.querySelectorAll("button")).find(
      (button) => button.textContent === "Delete",
    );
    if (!deleteButton) throw new Error("expected Custom Library Delete action");
    act(() => deleteButton.click());
    expect(container.textContent).toContain("Delete Custom Library item?");
    const cancel = Array.from(container.querySelectorAll("button")).find(
      (button) => button.textContent === "Cancel",
    );
    if (!cancel) throw new Error("expected Cancel");
    act(() => cancel.click());
    expect(custom.deleteItem).not.toHaveBeenCalled();

    act(() => deleteButton.click());
    const confirm = Array.from(container.querySelectorAll<HTMLButtonElement>('[role="dialog"] button')).find(
      (button) => button.textContent === "Delete",
    );
    if (!confirm) throw new Error("expected delete confirmation");
    act(() => { confirm.click(); confirm.click(); });
    await flushWorkspaceEffects();
    expect(custom.deleteItem).toHaveBeenCalledTimes(1);
    expect(custom.deleteItem).toHaveBeenCalledWith("exact-doc-id");
    expect(container.textContent).not.toContain("Delete me");
    expect(container.textContent).toContain("Select an item to view details.");
    expect(repository.deleteArchivedPresentation).not.toHaveBeenCalled();
  });

  it("keeps a failed Custom Library delete open and retries it successfully", async () => {
    const { repository } = repositoryFor([]);
    const custom = customLibraryRepositoryFor([
      customLibraryItem("retry-doc-id", "Retry delete", "Retained while retrying"),
    ]);
    custom.deleteItem.mockRejectedValueOnce(new Error("delete failed"));

    act(() => root.render(renderLibrary(repository, undefined, custom.repository)));
    await flushWorkspaceEffects();
    const destination = Array.from(container.querySelectorAll("button")).find(
      (button) => button.textContent === "Custom Library",
    );
    if (!destination) throw new Error("expected Custom Library destination");
    act(() => destination.click());
    await flushWorkspaceEffects();

    const row = container.querySelector<HTMLButtonElement>('[data-custom-library-row]');
    if (!row) throw new Error("expected Custom Library row");
    act(() => row.click());
    const details = container.querySelector<HTMLElement>('[aria-label="Details"]');
    if (!details) throw new Error("expected Custom Library details");

    const deleteButton = Array.from(container.querySelectorAll("button")).find(
      (button) => button.textContent === "Delete",
    );
    if (!deleteButton) throw new Error("expected Custom Library Delete action");
    act(() => deleteButton.click());

    let confirm = Array.from(
      container.querySelectorAll<HTMLButtonElement>('[role="dialog"] button'),
    ).find((button) => button.textContent === "Delete");
    if (!confirm) throw new Error("expected delete confirmation");
    await act(async () => {
      confirm?.click();
      await new Promise<void>((resolve) => queueMicrotask(resolve));
    });

    expect(custom.deleteItem).toHaveBeenCalledTimes(1);
    expect(custom.deleteItem).toHaveBeenNthCalledWith(1, "retry-doc-id");
    expect(container.textContent).toContain("Retry delete");
    expect(details.textContent).toContain("Retained while retrying");
    expect(container.textContent).toContain("Delete Custom Library item?");
    expect(container.textContent).toContain("Could not delete Custom Library item.");
    expect(repository.createPresentation).not.toHaveBeenCalled();
    expect(repository.savePresentation).not.toHaveBeenCalled();
    expect(repository.archivePresentation).not.toHaveBeenCalled();
    expect(repository.restorePresentation).not.toHaveBeenCalled();
    expect(repository.deleteArchivedPresentation).not.toHaveBeenCalled();
    expect(repository.movePresentationToFolder).not.toHaveBeenCalled();

    confirm = Array.from(
      container.querySelectorAll<HTMLButtonElement>('[role="dialog"] button'),
    ).find((button) => button.textContent === "Delete");
    if (!confirm) throw new Error("expected retry delete confirmation");
    await act(async () => {
      confirm?.click();
      await new Promise<void>((resolve) => queueMicrotask(resolve));
    });

    expect(custom.deleteItem).toHaveBeenCalledTimes(2);
    expect(custom.deleteItem).toHaveBeenNthCalledWith(2, "retry-doc-id");
    expect(container.textContent).not.toContain("Retry delete");
    expect(container.textContent).toContain("Select an item to view details.");
    expect(container.textContent).not.toContain("Delete Custom Library item?");
    expect(container.textContent).not.toContain("Could not delete Custom Library item.");
    expect(repository.createPresentation).not.toHaveBeenCalled();
    expect(repository.savePresentation).not.toHaveBeenCalled();
    expect(repository.archivePresentation).not.toHaveBeenCalled();
    expect(repository.restorePresentation).not.toHaveBeenCalled();
    expect(repository.deleteArchivedPresentation).not.toHaveBeenCalled();
    expect(repository.movePresentationToFolder).not.toHaveBeenCalled();
  });
});
