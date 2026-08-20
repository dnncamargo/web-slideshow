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
  subscribeLiveCurrent: (onState: (state: { kind: "none" }) => void) => {
    onState({ kind: "none" });
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
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    document.body.innerHTML = "";
  });

  it("shows New and a disabled New folder action with no selection", () => {
    act(() => root.render(renderToolbar(null)));

    expect(container.textContent).toContain("+ New presentation");
    const folder = Array.from(container.querySelectorAll("button")).find(
      (button) => button.textContent === "New folder",
    );
    expect(folder?.disabled).toBe(true);
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

    const rows = container.querySelectorAll<HTMLButtonElement>("button");
    act(() => rows[1]?.click());
    expect(onSelect).toHaveBeenCalledWith("two");
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
    expect(repository.listPresentations).toHaveBeenCalledTimes(listCalls);
    expect(repository.createPresentation).not.toHaveBeenCalled();
    expect(repository.archivePresentation).not.toHaveBeenCalled();
  });
});
