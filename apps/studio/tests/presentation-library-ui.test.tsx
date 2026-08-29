// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PresentationSchema, type FontFaceResource, type Presentation } from "@powershow/document-schema";

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
import type {
  CustomLibraryPaletteRecord,
  CustomLibraryPaletteRepository,
} from "../src/features/custom-library/custom-library-palette-repository";
import type { CustomLibraryFontRecord } from "../src/features/custom-library/custom-library-font";
import type { CustomLibraryFontRepository } from "../src/features/custom-library/custom-library-font-repository";

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
        folderDestination={false}
        folderDeleteDisabled={false}
        onNew={vi.fn()}
        onNewFolder={vi.fn()}
        onDeleteFolder={vi.fn()}
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
  customLibraryPaletteRepository?: CustomLibraryPaletteRepository,
  customLibraryFontRepository?: CustomLibraryFontRepository,
) {
  return (
    <StudioI18nProvider>
      <PresentationLibrary
        repository={repository}
        folderRepository={folderRepository ?? emptyFolderRepository()}
        customLibraryRepository={customLibraryRepository}
        customLibraryPaletteRepository={customLibraryPaletteRepository ?? customLibraryPaletteRepositoryFor([]).repository}
        customLibraryFontRepository={customLibraryFontRepository ?? customLibraryFontRepositoryFor([]).repository}
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

function customLibraryPaletteRepositoryFor(initialPalettes: CustomLibraryPaletteRecord[]) {
  let current = initialPalettes;
  const listPalettes = vi.fn(async () => current);
  const deletePalette = vi.fn(async (id: string) => {
    current = current.filter((palette) => palette.id !== id);
  });
  const repository: CustomLibraryPaletteRepository = {
    savePalette: vi.fn(async () => "unused"),
    updatePalette: vi.fn(async () => undefined),
    listPalettes,
    getPalette: vi.fn(async () => null),
    deletePalette,
  };
  return { repository, listPalettes, deletePalette, getCurrent: () => current };
}

function customLibraryFontRepositoryFor(initialFonts: CustomLibraryFontRecord[]) {
  let current = initialFonts;
  const listFonts = vi.fn(async () => current);
  const saveFont = vi.fn(async (font: CustomLibraryFontRecord["font"]) => {
    const id = `font-${current.length + 1}`;
    current = [...current, { id, font }];
    return id;
  });
  const updateFont = vi.fn(async (id: string, font: CustomLibraryFontRecord["font"]) => {
    current = current.map((record) => record.id === id ? { id, font } : record);
  });
  const repository: CustomLibraryFontRepository = {
    saveFont,
    updateFont,
    listFonts,
    getFont: vi.fn(async () => null),
    deleteFont: vi.fn(async () => {}),
  };
  return { repository, listFonts, saveFont, updateFont, getCurrent: () => current };
}

function fontFace(weight: number): FontFaceResource {
  return {
    weight,
    style: "normal",
    source: { type: "url", url: `https://cdn.example.test/${weight}.woff2`, format: "woff2" },
  };
}

function findButton(container: HTMLDivElement, text: string): HTMLButtonElement {
  const button = Array.from(container.querySelectorAll<HTMLButtonElement>("button"))
    .find((candidate) => candidate.textContent?.trim() === text);
  if (!button) throw new Error(`expected button ${text}`);
  return button;
}

async function openManualFontAuthoring(container: HTMLDivElement) {
  await act(async () => { findButton(container, "Fonts").click(); await Promise.resolve(); });
  await flushWorkspaceEffects();
  await act(async () => { findButton(container, "+ Add font").click(); await Promise.resolve(); });
  await flushWorkspaceEffects();
  const source = container.querySelector<HTMLSelectElement>("#custom-library-font-source");
  if (!source) throw new Error("expected font source selector");
  act(() => {
    source.value = "manual";
    source.dispatchEvent(new Event("change", { bubbles: true }));
  });
  await flushWorkspaceEffects();
}

function customLibraryPalette(
  id: string,
  name: string,
  colors: Array<{ name: string; value: string }>,
  description?: string,
): CustomLibraryPaletteRecord {
  return {
    id,
    palette: {
      name,
      ...(description ? { description } : {}),
      colors,
    },
  };
}

function emptyFolderRepository(): PresentationFolderRepository {
  return {
    listFolders: vi.fn(async () => []),
    createFolder: vi.fn(async () => "folder-new"),
    renameFolder: vi.fn(async () => {}),
    deleteFolder: vi.fn(async () => {}),
  };
}

async function flushWorkspaceEffects() {
  await act(async () => {
    await new Promise<void>((resolve) => queueMicrotask(resolve));
  });
}

function setLibraryInputValue(input: HTMLInputElement | null, value: string): void {
  if (!input) throw new Error("expected library input");
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set?.call(input, value);
  act(() => input.dispatchEvent(new Event("input", { bubbles: true })));
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

  it("clears selection and keeps Styles loading separate from placeholders", async () => {
    const { repository, listPresentations } = repositoryFor([summary("one")]);
    const custom = customLibraryRepositoryFor([customLibraryItem("style-1", "Saved style")]);
    const palettes = customLibraryPaletteRepositoryFor([]);

    act(() => root.render(renderLibrary(repository, undefined, custom.repository, palettes.repository)));
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
    await flushWorkspaceEffects();

    expect(container.querySelector('[data-selected="true"]')).toBeNull();
    expect(container.textContent).toContain("Saved style");
    expect(custom.listItems).toHaveBeenCalledTimes(1);

    const palettesDestination = Array.from(container.querySelectorAll("button")).find(
      (button) => button.textContent === "Palettes",
    );
    if (!palettesDestination) throw new Error("expected Palettes destination");
    act(() => palettesDestination.click());
    await flushWorkspaceEffects();
    expect(container.textContent).toContain("No palettes saved yet.");
    expect(container.textContent).not.toContain("Saved style");
    expect(custom.listItems).toHaveBeenCalledTimes(1);
    expect(palettes.listPalettes).toHaveBeenCalledTimes(1);

    const fontsDestination = Array.from(container.querySelectorAll("button")).find(
      (button) => button.textContent === "Fonts",
    );
    if (!fontsDestination) throw new Error("expected Fonts destination");
    act(() => fontsDestination.click());
    await flushWorkspaceEffects();

    expect(container.textContent).toContain("No fonts saved yet.");
    expect(container.textContent).not.toContain("Saved style");
    expect(custom.listItems).toHaveBeenCalledTimes(1);
    expect(container.querySelector('[data-selected="true"]')).toBeNull();
    expect(repository.listPresentations).toHaveBeenCalledTimes(listCalls);
    expect(repository.createPresentation).not.toHaveBeenCalled();
    expect(repository.archivePresentation).not.toHaveBeenCalled();
    expect(repository.getPresentation).not.toHaveBeenCalled();
  });

  it("loads Fonts lazily, opens Library authoring, and appends faces to one master", async () => {
    const { repository } = repositoryFor([]);
    const fonts = customLibraryFontRepositoryFor([]);
    act(() => root.render(renderLibrary(repository, undefined, undefined, undefined, fonts.repository)));
    await flushWorkspaceEffects();
    expect(fonts.listFonts).not.toHaveBeenCalled();

    const destination = Array.from(container.querySelectorAll("button")).find((button) => button.textContent === "Fonts");
    if (!destination) throw new Error("expected Fonts destination");
    act(() => destination.click());
    await flushWorkspaceEffects();
    expect(fonts.listFonts).toHaveBeenCalledTimes(1);
    expect(container.textContent).toContain("No fonts saved yet.");

    const add = Array.from(container.querySelectorAll("button")).find((button) => button.textContent === "+ Add font");
    if (!add) throw new Error("expected Add font");
    act(() => add.click());
    expect(container.textContent).toContain("Add font");
    const source = container.querySelector<HTMLSelectElement>("#custom-library-font-source");
    if (!source) throw new Error("expected font source selector");
    act(() => {
      source.value = "manual";
      source.dispatchEvent(new Event("change", { bubbles: true }));
    });

    setLibraryInputValue(container.querySelector("#custom-library-font-family"), " Inter ");
    setLibraryInputValue(container.querySelector("#custom-library-font-url"), fontFace(400).source.url);
    const addFace = Array.from(container.querySelectorAll("button")).find((button) => button.textContent === "Add face");
    if (!addFace) throw new Error("expected manual Add font face");
    await act(async () => { addFace.click(); await new Promise<void>((resolve) => queueMicrotask(resolve)); });
    expect(fonts.saveFont).toHaveBeenCalledTimes(1);
    expect(fonts.saveFont).toHaveBeenCalledWith({ family: "Inter", faces: [fontFace(400)] });

    setLibraryInputValue(container.querySelector("#custom-library-font-family"), "inter");
    setLibraryInputValue(container.querySelector("#custom-library-font-url"), fontFace(700).source.url);
    const addSecond = Array.from(container.querySelectorAll("button")).find((button) => button.textContent === "Add face");
    if (!addSecond) throw new Error("expected second Add font face");
    const weight = container.querySelector<HTMLSelectElement>("#custom-library-font-weight");
    if (!weight) throw new Error("expected weight selector");
    act(() => { weight.value = "700"; weight.dispatchEvent(new Event("change", { bubbles: true })); });
    await act(async () => { addSecond.click(); await new Promise<void>((resolve) => queueMicrotask(resolve)); });
    expect(fonts.saveFont).toHaveBeenCalledTimes(1);
    expect(fonts.updateFont).toHaveBeenCalledWith("font-1", { family: "Inter", faces: [fontFace(400), fontFace(700)] });
    expect(container.textContent).toContain("Inter");
    expect(container.textContent).toContain("2 faces");
    expect(container.textContent).toContain("Fontsource");
    expect(container.querySelectorAll("[id^='presentation-']")).toHaveLength(0);
  });

  it("retries a failed Fonts load and does not load fonts from other destinations", async () => {
    const { repository } = repositoryFor([]);
    const fonts = customLibraryFontRepositoryFor([]);
    const custom = customLibraryRepositoryFor([]);
    fonts.listFonts.mockRejectedValueOnce(new Error("offline"));
    act(() => root.render(renderLibrary(repository, undefined, custom.repository, undefined, fonts.repository)));
    await flushWorkspaceEffects();
    expect(container.textContent).not.toContain("+ Add font");

    await act(async () => { findButton(container, "Fonts").click(); await Promise.resolve(); });
    await flushWorkspaceEffects();
    expect(fonts.listFonts).toHaveBeenCalledTimes(1);
    expect(container.textContent).toContain("Could not load Custom Library fonts.");
    expect(container.textContent).not.toContain("+ Add font");
    await act(async () => { findButton(container, "Retry").click(); await Promise.resolve(); });
    await flushWorkspaceEffects();
    expect(fonts.listFonts).toHaveBeenCalledTimes(2);
    expect(container.textContent).toContain("No fonts saved yet.");
    expect(container.textContent).toContain("+ Add font");

    act(() => findButton(container, "Styles").click());
    await flushWorkspaceEffects();
    act(() => findButton(container, "Palettes").click());
    await flushWorkspaceEffects();
    expect(fonts.listFonts).toHaveBeenCalledTimes(2);
  });

  it("keeps a font row selected through bubbling, then clears it on real browser background clicks", async () => {
    const { repository } = repositoryFor([]);
    const fonts = customLibraryFontRepositoryFor([
      { id: "inter-master", font: { family: "Inter", faces: [fontFace(400)] } },
      { id: "audiowide-master", font: { family: "Audiowide", faces: [fontFace(700)] } },
    ]);

    act(() => root.render(renderLibrary(repository, undefined, undefined, undefined, fonts.repository)));
    await flushWorkspaceEffects();
    act(() => findButton(container, "Fonts").click());
    await flushWorkspaceEffects();

    const rows = container.querySelectorAll<HTMLButtonElement>("[data-custom-library-font-row]");
    expect(rows).toHaveLength(2);
    act(() => rows[0]?.click());
    expect(rows[0]?.getAttribute("aria-pressed")).toBe("true");
    expect(container.querySelector('[aria-label="Details"]')?.textContent).toContain("Inter");

    const browserPane = container.querySelector<HTMLElement>("[class*='browserPane']");
    if (!browserPane) throw new Error("expected browser pane");
    act(() => browserPane.dispatchEvent(new MouseEvent("click", { bubbles: true })));
    expect(rows[0]?.getAttribute("aria-pressed")).toBe("false");
    expect(container.querySelector('[aria-label="Details"]')?.textContent).toContain("Select a font to view details.");

    act(() => rows[1]?.click());
    expect(rows[1]?.getAttribute("aria-pressed")).toBe("true");
    const workspace = container.querySelector<HTMLElement>("[class*='workspace']");
    if (!workspace) throw new Error("expected workspace");
    act(() => workspace.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true })));
    expect(rows[1]?.getAttribute("aria-pressed")).toBe("false");

    act(() => findButton(container, "Styles").click());
    await flushWorkspaceEffects();
    expect(container.querySelector("[data-custom-library-font-row]")).toBeNull();
  });

  it("waits for saveFont before showing success or updating the master inventory", async () => {
    const { repository } = repositoryFor([]);
    const fonts = customLibraryFontRepositoryFor([]);
    let resolveSave: ((id: string) => void) | undefined;
    fonts.saveFont.mockImplementationOnce(() => new Promise<string>((resolve) => { resolveSave = resolve; }));
    act(() => root.render(renderLibrary(repository, undefined, undefined, undefined, fonts.repository)));
    await flushWorkspaceEffects();
    await openManualFontAuthoring(container);
    expect(container.querySelector("#custom-library-font-source")).toBeTruthy();
    await act(async () => { findButton(container, "Close").click(); await Promise.resolve(); });
    await flushWorkspaceEffects();
    expect(container.querySelector("#custom-library-font-source")).toBeNull();
    expect(container.textContent).toContain("Select a font to view details.");
    await act(async () => { findButton(container, "+ Add font").click(); await Promise.resolve(); });
    await flushWorkspaceEffects();
    const reopenedSource = container.querySelector<HTMLSelectElement>("#custom-library-font-source");
    if (!reopenedSource) throw new Error("expected reopened font source selector");
    act(() => {
      reopenedSource.value = "manual";
      reopenedSource.dispatchEvent(new Event("change", { bubbles: true }));
    });
    await flushWorkspaceEffects();

    setLibraryInputValue(container.querySelector("#custom-library-font-family"), "Inter");
    setLibraryInputValue(container.querySelector("#custom-library-font-url"), fontFace(400).source.url);
    await act(async () => {
      findButton(container, "Add face").click();
      await Promise.resolve();
    });
    expect(fonts.saveFont).toHaveBeenCalledWith({ family: "Inter", faces: [fontFace(400)] });
    expect(container.textContent).not.toContain("Added Inter.");
    expect(container.textContent).not.toContain("1 fonts in Custom Library.");

    await act(async () => {
      resolveSave?.("inter-master");
      await Promise.resolve();
    });
    await flushWorkspaceEffects();
    expect(container.textContent).toContain("Added Inter.");
    expect(container.textContent).toContain("Inter");
    expect(container.textContent).toContain("1 face");
  });

  it("does not persist an equivalent face twice", async () => {
    const { repository } = repositoryFor([]);
    const fonts = customLibraryFontRepositoryFor([{ id: "inter-master", font: { family: "Inter", faces: [fontFace(400)] } }]);
    act(() => root.render(renderLibrary(repository, undefined, undefined, undefined, fonts.repository)));
    await flushWorkspaceEffects();
    await openManualFontAuthoring(container);
    setLibraryInputValue(container.querySelector("#custom-library-font-family"), " inter ");
    setLibraryInputValue(container.querySelector("#custom-library-font-url"), fontFace(400).source.url);
    await act(async () => { findButton(container, "Add face").click(); await Promise.resolve(); });
    expect(fonts.saveFont).not.toHaveBeenCalled();
    expect(fonts.updateFont).not.toHaveBeenCalled();
  });

  it("shows a safe save error, preserves local state, and retries successfully", async () => {
    const { repository } = repositoryFor([]);
    const fonts = customLibraryFontRepositoryFor([]);
    fonts.saveFont.mockRejectedValueOnce(new Error("raw firestore failure"));
    act(() => root.render(renderLibrary(repository, undefined, undefined, undefined, fonts.repository)));
    await flushWorkspaceEffects();
    await openManualFontAuthoring(container);
    setLibraryInputValue(container.querySelector("#custom-library-font-family"), "Inter");
    setLibraryInputValue(container.querySelector("#custom-library-font-url"), fontFace(400).source.url);
    await act(async () => { findButton(container, "Add face").click(); await Promise.resolve(); });
    expect(container.textContent).toContain("Could not save the font to Custom Library.");
    expect(container.textContent).not.toContain("Added Inter.");
    expect(container.textContent).not.toContain("raw firestore failure");
    expect(fonts.getCurrent()).toEqual([]);

    await act(async () => { findButton(container, "Add face").click(); await Promise.resolve(); });
    expect(fonts.saveFont).toHaveBeenCalledTimes(2);
  });

  it("does not optimistically retain a failed append and retries the original master", async () => {
    const { repository } = repositoryFor([]);
    const existing = { id: "inter-master", font: { family: "Inter", faces: [fontFace(400)] } };
    const fonts = customLibraryFontRepositoryFor([existing]);
    fonts.updateFont.mockRejectedValueOnce(new Error("raw update failure"));
    act(() => root.render(renderLibrary(repository, undefined, undefined, undefined, fonts.repository)));
    await flushWorkspaceEffects();
    await openManualFontAuthoring(container);
    setLibraryInputValue(container.querySelector("#custom-library-font-family"), "INTER");
    setLibraryInputValue(container.querySelector("#custom-library-font-url"), fontFace(700).source.url);
    const weight = container.querySelector<HTMLSelectElement>("#custom-library-font-weight");
    if (!weight) throw new Error("expected weight selector");
    act(() => { weight.value = "700"; weight.dispatchEvent(new Event("change", { bubbles: true })); });
    await act(async () => { findButton(container, "Add face").click(); await Promise.resolve(); });
    expect(fonts.updateFont).toHaveBeenCalledWith("inter-master", { family: "Inter", faces: [fontFace(400), fontFace(700)] });
    expect(fonts.getCurrent()).toEqual([existing]);
    expect(container.textContent).toContain("Could not save the font to Custom Library.");

    await act(async () => { findButton(container, "Add face").click(); await Promise.resolve(); });
    expect(fonts.updateFont).toHaveBeenCalledTimes(2);
    expect(fonts.getCurrent()).toEqual([{ id: "inter-master", font: { family: "Inter", faces: [fontFace(400), fontFace(700)] } }]);
  });

  it("serializes Google multi-face imports against the current master ref", async () => {
    const { repository } = repositoryFor([]);
    const fonts = customLibraryFontRepositoryFor([]);
    let resolveSave: ((id: string) => void) | undefined;
    fonts.saveFont.mockImplementationOnce(() => new Promise<string>((resolve) => { resolveSave = resolve; }));
    const result = {
      families: [{
        family: "Inter",
        variants: [400, 500, 700].map((weight) => ({ weight, style: "normal" as const, faces: [fontFace(weight)] })),
      }],
      unsupported: [],
    };
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => ({
      json: async () => String(input).includes("/status") ? { ok: true, available: true } : { ok: true, result },
    })));
    act(() => root.render(renderLibrary(repository, undefined, undefined, undefined, fonts.repository)));
    await flushWorkspaceEffects();
    await openManualFontAuthoring(container);
    const source = container.querySelector<HTMLSelectElement>("#custom-library-font-source");
    if (!source) throw new Error("expected font source selector");
    act(() => { source.value = "google-fonts"; source.dispatchEvent(new Event("change", { bubbles: true })); });
    await flushWorkspaceEffects();
    expect(container.querySelector("#custom-library-font-search")).toBeTruthy();
    expect(container.querySelector("#custom-library-font-google-import-url")).toBeTruthy();
    const url = container.querySelector<HTMLInputElement>("#custom-library-font-google-import-url");
    if (!url) throw new Error("expected Google import URL");
    setLibraryInputValue(url, "https://fonts.googleapis.com/css2?family=Inter");
    await act(async () => { findButton(container, "Resolve").click(); await Promise.resolve(); });
    await act(async () => { findButton(container, "Add selected").click(); await Promise.resolve(); });
    expect(fonts.saveFont).toHaveBeenCalledTimes(1);
    resolveSave?.("inter-master");
    await flushWorkspaceEffects();
    await flushWorkspaceEffects();
    expect(fonts.updateFont).toHaveBeenNthCalledWith(1, "inter-master", { family: "Inter", faces: [fontFace(400), fontFace(500)] });
    expect(fonts.updateFont).toHaveBeenNthCalledWith(2, "inter-master", { family: "Inter", faces: [fontFace(400), fontFace(500), fontFace(700)] });
    expect(fonts.saveFont).toHaveBeenCalledTimes(1);
  });

  it("keeps the Library write queue usable after a failed Google face", async () => {
    const { repository } = repositoryFor([]);
    const fonts = customLibraryFontRepositoryFor([]);
    fonts.updateFont.mockRejectedValueOnce(new Error("middle face failed"));
    const result = {
      families: [{ family: "Inter", variants: [400, 500, 700].map((weight) => ({ weight, style: "normal" as const, faces: [fontFace(weight)] })) }],
      unsupported: [],
    };
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => ({
      json: async () => String(input).includes("/status") ? { ok: true, available: true } : { ok: true, result },
    })));
    act(() => root.render(renderLibrary(repository, undefined, undefined, undefined, fonts.repository)));
    await flushWorkspaceEffects();
    await openManualFontAuthoring(container);
    const source = container.querySelector<HTMLSelectElement>("#custom-library-font-source");
    if (!source) throw new Error("expected font source selector");
    act(() => { source.value = "google-fonts"; source.dispatchEvent(new Event("change", { bubbles: true })); });
    await flushWorkspaceEffects();
    const url = container.querySelector<HTMLInputElement>("#custom-library-font-google-import-url");
    if (!url) throw new Error("expected Google import URL");
    setLibraryInputValue(url, "https://fonts.googleapis.com/css2?family=Inter");
    await act(async () => { findButton(container, "Resolve").click(); await Promise.resolve(); });
    await act(async () => { findButton(container, "Add selected").click(); await Promise.resolve(); });
    await flushWorkspaceEffects();
    await flushWorkspaceEffects();
    expect(fonts.saveFont).toHaveBeenCalledTimes(1);
    expect(fonts.updateFont).toHaveBeenCalledTimes(2);
    expect(fonts.updateFont).toHaveBeenNthCalledWith(1, "font-1", { family: "Inter", faces: [fontFace(400), fontFace(500)] });
    expect(fonts.updateFont).toHaveBeenNthCalledWith(2, "font-1", { family: "Inter", faces: [fontFace(400), fontFace(700)] });
    expect(fonts.getCurrent()[0]?.font.faces).toEqual([fontFace(400), fontFace(700)]);
  });

  it("loads, selects, inspects, and deletes a Custom Library Palette independently", async () => {
    const { repository } = repositoryFor([]);
    const palettes = customLibraryPaletteRepositoryFor([
      customLibraryPalette("palette-1", "Brand Warm", [
        { name: "Accent", value: "#facc15" },
        { name: "Overlay", value: "rgba(10, 20, 30, 0.5)" },
      ], "Warm presentation palette"),
    ]);

    act(() => root.render(renderLibrary(repository, undefined, undefined, palettes.repository)));
    await flushWorkspaceEffects();
    const destination = Array.from(container.querySelectorAll("button")).find(
      (button) => button.textContent === "Palettes",
    );
    if (!destination) throw new Error("expected Palettes destination");
    act(() => destination.click());
    await flushWorkspaceEffects();

    const row = container.querySelector<HTMLButtonElement>('[data-custom-library-palette-row]');
    if (!row) throw new Error("expected palette row");
    expect(row.getAttribute("aria-label")).toBe("Brand Warm");
    expect(row.getAttribute("aria-pressed")).toBe("false");
    expect(row.textContent).toContain("2 colors");
    act(() => row.click());

    const details = container.querySelector<HTMLElement>('[aria-label="Details"]');
    if (!details) throw new Error("expected palette details");
    expect(row.getAttribute("aria-pressed")).toBe("true");
    expect(details.textContent).toContain("Brand Warm");
    expect(details.textContent).toContain("Warm presentation palette");
    expect(details.textContent).toContain("Accent");
    expect(details.textContent).toContain("#facc15");
    expect(details.textContent).toContain("rgba(10, 20, 30, 0.5)");
    expect(details.textContent).not.toContain("palette-1");

    const deleteButton = Array.from(details.querySelectorAll("button")).find(
      (button) => button.textContent === "Delete palette",
    );
    if (!deleteButton) throw new Error("expected palette delete action");
    act(() => deleteButton.click());
    expect(container.textContent).toContain("Delete Custom Library palette?");
    const confirm = Array.from(container.querySelectorAll<HTMLButtonElement>('[role="dialog"] button'))
      .find((button) => button.textContent === "Delete");
    if (!confirm) throw new Error("expected palette delete confirmation");
    await act(async () => {
      confirm.click();
      await new Promise<void>((resolve) => queueMicrotask(resolve));
    });
    expect(palettes.deletePalette).toHaveBeenCalledWith("palette-1");
    expect(container.textContent).not.toContain("Brand Warm");
    expect(container.textContent).toContain("Select a palette to view details.");
    expect(repository.savePresentation).not.toHaveBeenCalled();
    expect(repository.createPresentation).not.toHaveBeenCalled();
  });

  it("creates a Custom Library Palette from the details pane and selects it locally", async () => {
    let resolveSave: ((id: string) => void) | undefined;
    const savePalette = vi.fn(() => new Promise<string>((resolve) => { resolveSave = resolve; }));
    const palettes = customLibraryPaletteRepositoryFor([]);
    const repository: CustomLibraryPaletteRepository = { ...palettes.repository, savePalette };
    const presentationRepository = repositoryFor([]).repository;

    act(() => root.render(renderLibrary(presentationRepository, undefined, undefined, repository)));
    await flushWorkspaceEffects();
    act(() => Array.from(container.querySelectorAll("button")).find((button) => button.textContent === "Palettes")?.click());
    await flushWorkspaceEffects();
    expect(container.textContent).toContain("+ New palette");
    act(() => Array.from(container.querySelectorAll("button")).find((button) => button.textContent === "+ New palette")?.click());
    expect(savePalette).not.toHaveBeenCalled();

    setLibraryInputValue(container.querySelector<HTMLInputElement>("form > label:first-of-type input"), "New master");
    act(() => Array.from(container.querySelectorAll("button")).find((button) => button.textContent === "+ Add color")?.click());
    setLibraryInputValue(container.querySelector<HTMLInputElement>("input[aria-label='Color name']"), "Accent");
    act(() => Array.from(container.querySelectorAll<HTMLButtonElement>("button")).find((button) => button.textContent === "Create")?.click());
    expect(container.textContent).toContain("Saving…");
    await act(async () => resolveSave?.("new-id"));
    expect(container.textContent).toContain("New master");
    expect(container.querySelector('[data-custom-library-palette-row][data-selected="true"]')?.getAttribute("aria-label")).toBe("New master");
    expect(container.textContent).not.toContain("Saving…");
    expect(container.querySelector("form")).toBeNull();
    expect(repository.listPalettes).toHaveBeenCalledOnce();
  });

  it("keeps the Library palette editor open after a save failure and retries", async () => {
    const savePalette = vi.fn().mockRejectedValueOnce(new Error("offline")).mockResolvedValueOnce("retry-id");
    const palettes = customLibraryPaletteRepositoryFor([]);
    const repository: CustomLibraryPaletteRepository = { ...palettes.repository, savePalette };
    const presentationRepository = repositoryFor([]).repository;

    act(() => root.render(renderLibrary(presentationRepository, undefined, undefined, repository)));
    await flushWorkspaceEffects();
    act(() => Array.from(container.querySelectorAll("button")).find((button) => button.textContent === "Palettes")?.click());
    await flushWorkspaceEffects();
    act(() => Array.from(container.querySelectorAll("button")).find((button) => button.textContent === "+ New palette")?.click());
    setLibraryInputValue(container.querySelector<HTMLInputElement>("form > label:first-of-type input"), "Retry master");
    act(() => Array.from(container.querySelectorAll("button")).find((button) => button.textContent === "+ Add color")?.click());
    setLibraryInputValue(container.querySelector<HTMLInputElement>("input[aria-label='Color name']"), "Accent");
    act(() => Array.from(container.querySelectorAll<HTMLButtonElement>("button")).find((button) => button.textContent === "Create")?.click());
    await flushWorkspaceEffects();
    expect(container.textContent).toContain("Could not save palette.");
    expect(container.querySelector("form")).not.toBeNull();
    expect(container.textContent).not.toContain("Saving…");
    act(() => Array.from(container.querySelectorAll<HTMLButtonElement>("button")).find((button) => button.textContent === "Create")?.click());
    await flushWorkspaceEffects();
    expect(savePalette).toHaveBeenCalledTimes(2);
    expect(container.querySelector('[data-custom-library-palette-row][aria-label="Retry master"]')).not.toBeNull();
  });

  it("edits the selected palette in place and copies it as a new selected record", async () => {
    const savePalette = vi.fn(async () => "copy-id");
    const updatePalette = vi.fn(async () => undefined);
    const palettes = customLibraryPaletteRepositoryFor([customLibraryPalette("brand", "Brand", [{ name: "Accent", value: "#facc15" }])]);
    const repository: CustomLibraryPaletteRepository = { ...palettes.repository, savePalette, updatePalette };
    const presentationRepository = repositoryFor([]).repository;

    act(() => root.render(renderLibrary(presentationRepository, undefined, undefined, repository)));
    await flushWorkspaceEffects();
    act(() => Array.from(container.querySelectorAll("button")).find((button) => button.textContent === "Palettes")?.click());
    await flushWorkspaceEffects();
    act(() => container.querySelector<HTMLButtonElement>("[data-custom-library-palette-row]")?.click());
    const details = container.querySelector<HTMLElement>('[aria-label="Details"]');
    expect(details?.textContent).toContain("Brand");
    expect(details?.textContent).toContain("Edit");
    expect(details?.textContent).toContain("Copy");
    act(() => Array.from(details?.querySelectorAll<HTMLButtonElement>("button") ?? []).find((button) => button.textContent === "Edit")?.click());
    setLibraryInputValue(container.querySelector<HTMLInputElement>("form > label:first-of-type input"), "Edited");
    act(() => Array.from(container.querySelectorAll<HTMLButtonElement>("button")).find((button) => button.textContent === "Save changes")?.click());
    await flushWorkspaceEffects();
    expect(updatePalette).toHaveBeenCalledWith("brand", expect.objectContaining({ name: "Edited" }));
    expect(savePalette).not.toHaveBeenCalled();
    expect(container.textContent).toContain("Edited");
    act(() => Array.from(container.querySelectorAll<HTMLButtonElement>("button")).find((button) => button.textContent === "Copy")?.click());
    setLibraryInputValue(container.querySelector<HTMLInputElement>("form > label:first-of-type input"), "Copied");
    act(() => Array.from(container.querySelectorAll<HTMLButtonElement>("button")).find((button) => button.textContent === "Create copy")?.click());
    await flushWorkspaceEffects();
    expect(savePalette).toHaveBeenCalledWith(expect.objectContaining({ name: "Copied" }));
    expect(container.querySelector('[data-custom-library-palette-row][aria-label="Copied"]')).not.toBeNull();
    expect(container.querySelector('[data-custom-library-palette-row][aria-label="Edited"]')?.getAttribute("data-selected")).toBe("false");
    expect(container.querySelector('[data-custom-library-palette-row][aria-label="Copied"]')?.getAttribute("data-selected")).toBe("true");
  });

  it("clears the selected Custom Library Palette on workspace Escape", async () => {
    const { repository } = repositoryFor([]);
    const palettes = customLibraryPaletteRepositoryFor([
      customLibraryPalette("palette-escape", "Escape palette", [
        { name: "Accent", value: "#facc15" },
      ]),
    ]);

    act(() => root.render(renderLibrary(repository, undefined, undefined, palettes.repository)));
    await flushWorkspaceEffects();
    act(() => Array.from(container.querySelectorAll("button")).find((button) => button.textContent === "Palettes")?.click());
    await flushWorkspaceEffects();
    const row = container.querySelector<HTMLButtonElement>('[data-custom-library-palette-row]');
    expect(row).toBeTruthy();
    act(() => row?.click());
    expect(container.querySelector('[aria-label="Details"]')?.textContent).toContain("Escape palette");

    const workspace = container.querySelector<HTMLElement>('[class*="workspace"]');
    expect(workspace).toBeTruthy();
    act(() => workspace?.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true })));
    expect(container.querySelector('[aria-label="Details"]')?.textContent).toContain("Select a palette to view details.");
    expect(row?.getAttribute("aria-pressed")).toBe("false");
  });

  it("shows a palette-specific load error and retries only palette loading", async () => {
    const { repository } = repositoryFor([]);
    const palettes = customLibraryPaletteRepositoryFor([
      customLibraryPalette("palette-1", "Retry palette", [
        { name: "Accent", value: "#facc15" },
      ]),
    ]);
    palettes.listPalettes
      .mockRejectedValueOnce(new Error("palette load failed"))
      .mockResolvedValueOnce(palettes.getCurrent());

    act(() => root.render(renderLibrary(repository, undefined, undefined, palettes.repository)));
    await flushWorkspaceEffects();
    const destination = Array.from(container.querySelectorAll("button")).find(
      (button) => button.textContent === "Palettes",
    );
    if (!destination) throw new Error("expected Palettes destination");
    act(() => destination.click());
    await flushWorkspaceEffects();
    expect(container.textContent).toContain("Could not load Custom Library palettes.");
    expect(container.textContent).not.toContain("Retry palette");

    const retry = Array.from(container.querySelectorAll("button")).find(
      (button) => button.textContent === "Retry",
    );
    if (!retry) throw new Error("expected palette retry");
    act(() => retry.click());
    await flushWorkspaceEffects();
    expect(palettes.listPalettes).toHaveBeenCalledTimes(2);
    expect(container.textContent).toContain("Retry palette");
    expect(repository.savePresentation).not.toHaveBeenCalled();
  });

  it.each([
    ["Styles", "Styles"],
    ["Palettes", "Palettes"],
    ["Fonts", "Fonts"],
  ])("uses Custom Library as the section for %s", async (destination, title) => {
    const { repository } = repositoryFor([]);
    const custom = customLibraryRepositoryFor([]);

    act(() => root.render(renderLibrary(repository, undefined, custom.repository)));
    await flushWorkspaceEffects();

    const destinationButton = Array.from(container.querySelectorAll("button")).find(
      (button) => button.textContent === destination,
    );
    if (!destinationButton) throw new Error(`expected ${destination} destination`);
    act(() => destinationButton.click());
    await flushWorkspaceEffects();

    const heading = container.querySelector("h1");
    expect(heading?.previousElementSibling?.textContent).toBe("Custom Library");
    expect(heading?.textContent).toBe(title);
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

  it("lists Custom Library destinations without a clickable generic Folders destination", async () => {
    const { repository } = repositoryFor([]);

    act(() => root.render(renderLibrary(repository)));
    await flushWorkspaceEffects();

    expect(
      Array.from(container.querySelectorAll("h2")).some(
        (heading) => heading.textContent === "Custom Library",
      ),
    ).toBe(true);
    expect(
      Array.from(container.querySelectorAll("button")).some(
        (button) => button.textContent?.trim() === "Custom Library",
      ),
    ).toBe(false);

    // Fonts exists as a Custom Library destination.
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
      (button) => button.textContent === "Styles",
    );
    if (!destination) throw new Error("expected Styles destination");
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
      (button) => button.textContent === "Styles",
    );
    if (!destination) throw new Error("expected Styles destination");
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
      (button) => button.textContent === "Styles",
    );
    if (!failingDestination) throw new Error("expected Styles destination");
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
      (button) => button.textContent === "Styles",
    );
    if (!destination) throw new Error("expected Styles destination");
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
      (button) => button.textContent === "Styles",
    );
    if (!destination) throw new Error("expected Styles destination");
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
      (button) => button.textContent === "Styles",
    );
    if (!destination) throw new Error("expected Styles destination");
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
