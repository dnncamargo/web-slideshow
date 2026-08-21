// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

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
import type { PresentationRepository } from "../src/features/persistence/presentation-repository";
import type { PresentationSummary } from "../src/features/persistence/presentation-persistence";

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
        onNew={vi.fn()}
        onEdit={vi.fn()}
        onPresent={vi.fn()}
        onControl={vi.fn()}
        onEnd={vi.fn()}
        onArchive={vi.fn()}
      />
    </StudioI18nProvider>
  );
}

function renderLibrary(repository: PresentationRepository) {
  return (
    <StudioI18nProvider>
      <PresentationLibrary repository={repository} />
    </StudioI18nProvider>
  );
}

async function flushWorkspaceEffects() {
  await act(async () => {
    await new Promise<void>((resolve) => queueMicrotask(resolve));
  });
}

function repositoryFor(
  initialSummaries: PresentationSummary[],
): {
  repository: PresentationRepository;
  getCurrent: () => PresentationSummary[];
  listPresentations: ReturnType<typeof vi.fn>;
} {
  let current = initialSummaries;
  const listPresentations = vi.fn(async () => current);
  const repository: PresentationRepository = {
    listPresentations,
    getPresentation: vi.fn(async () => null),
    createPresentation: vi.fn(async () => {}),
    savePresentation: vi.fn(async () => {}),
    archivePresentation: vi.fn(async (id: string) => {
      current = current.filter((item) => item.id !== id);
    }),
    restorePresentation: vi.fn(async () => {}),
    movePresentationToFolder: vi.fn(async () => {}),
    publishPresentation: vi.fn(async () => ({
      publicationId: "publication-id",
      versionId: "version-id",
      publishedRevision: 1,
      createdVersion: true,
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
  });

  it("shows New with reserved disabled Import and New folder actions when nothing is selected", () => {
    act(() => root.render(renderToolbar(null)));

    expect(container.textContent).toContain("+ New presentation");

    const importButton = Array.from(container.querySelectorAll("button")).find(
      (button) => button.textContent === "Import",
    );
    expect(importButton).toBeTruthy();
    expect(importButton?.disabled).toBe(true);

    const folder = Array.from(container.querySelectorAll("button")).find(
      (button) => button.textContent === "New folder",
    );
    expect(folder).toBeTruthy();
    expect(folder?.disabled).toBe(true);
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

  it("shows Export reserved and disabled whenever a presentation is selected", () => {
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
    expect(publishedExport?.disabled).toBe(true);
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
    expect(draftExport?.disabled).toBe(true);
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
});
