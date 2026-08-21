// @vitest-environment jsdom

import { act } from "react";
import type { ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { Slide } from "@powershow/document-schema";

import { PresentationThumbnail } from "../src/features/library/presentation-thumbnail";
import { PresentationThumbnailPreview } from "../src/features/library/presentation-thumbnail-preview";
import { PresentationList } from "../src/features/library/presentation-list";
import { PresentationLibrary } from "../src/features/library/presentation-library";
import { StudioI18nProvider } from "../src/features/i18n/studio-i18n-context";
import type {
  PresentationSummary,
  PresentationThumbnailPreview as PresentationThumbnailPreviewData,
} from "../src/features/persistence/presentation-persistence";
import type { PresentationRepository } from "../src/features/persistence/presentation-repository";

const libraryTestDependencies = vi.hoisted(() => ({
  push: vi.fn(),
  signOut: vi.fn(async () => {}),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: libraryTestDependencies.push }),
}));

vi.mock("../src/features/auth/studio-auth-provider", () => ({
  useStudioAuth: () => ({
    user: { displayName: "Test user", email: "test@example.com" },
    signOut: libraryTestDependencies.signOut,
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

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

function makeSlide(id: string, text: string): Slide {
  return {
    id,
    title: "",
    summary: "",
    speakerNotes: "",
    elements: [
      {
        id: `${id}-text`,
        type: "text",
        hidden: false,
        variant: "body",
        content: text,
      },
    ],
  };
}

function linkedSlide(id: string, text: string, href: string): Slide {
  return {
    id,
    title: "",
    summary: "",
    speakerNotes: "",
    elements: [
      {
        id: `${id}-text`,
        type: "text",
        hidden: false,
        variant: "body",
        content: text,
        link: { kind: "url", href, target: "_self" },
      },
    ],
  };
}

function emptySlide(id: string): Slide {
  return {
    id,
    title: "",
    summary: "",
    speakerNotes: "",
    elements: [],
  };
}

function previewData(
  firstSlide: Slide,
  aspectRatio: "16:9" | "4:3" = "16:9",
): PresentationThumbnailPreviewData {
  return { aspectRatio, firstSlide };
}

function summary(
  id: string,
  thumbnailPreview?: PresentationThumbnailPreviewData,
): PresentationSummary {
  return {
    id,
    title: `Title ${id}`,
    updatedAt: "ts",
    archived: false,
    archivedAt: null,
    folderId: null,
    publicationState: "draft",
    draftRevision: 1,
    publication: undefined,
    ...(thumbnailPreview ? { thumbnailPreview } : {}),
  };
}

describe("presentation thumbnail preview", () => {
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

  function renderNode(node: ReactNode) {
    act(() => root.render(node));
  }

  it("renders the first slide with the existing renderer", () => {
    renderNode(
      <PresentationThumbnailPreview
        preview={previewData(makeSlide("slide-1", "Hello world"))}
      />,
    );

    const slide = container.querySelector(".powershow-slide");
    expect(slide).not.toBeNull();
    expect(slide?.getAttribute("data-powershow-slide-id")).toBe("slide-1");
    expect(container.textContent).toContain("Hello world");
    expect(container.querySelector('[data-powershow-type="text"]')).not.toBeNull();
  });

  it("renders only the preview first slide (never additional slides)", () => {
    renderNode(
      <PresentationThumbnailPreview
        preview={previewData(makeSlide("slide-1", "First slide"))}
      />,
    );

    expect(container.querySelectorAll(".powershow-slide")).toHaveLength(1);
    expect(container.textContent).toContain("First slide");
    expect(container.textContent).not.toContain("Second slide");
  });

  it("uses the decorative fallback when thumbnailPreview is absent", () => {
    renderNode(<PresentationThumbnail summary={summary("one")} />);

    expect(container.querySelector(".powershow-slide")).toBeNull();
  });

  it("uses the decorative fallback when the first slide has no authored elements", () => {
    renderNode(
      <PresentationThumbnail
        summary={summary("one", previewData(emptySlide("slide-1")))}
      />,
    );

    expect(container.querySelector(".powershow-slide")).toBeNull();
  });

  it("isolates the rendered preview from interaction and accessibility", () => {
    renderNode(
      <PresentationThumbnailPreview
        preview={previewData(makeSlide("slide-1", "Hello world"))}
      />,
    );

    const slide = container.querySelector(".powershow-slide");
    const host = slide?.closest<HTMLElement>("[aria-hidden]");

    expect(host).not.toBeNull();
    expect(host?.getAttribute("aria-hidden")).toBe("true");
    expect(host?.hasAttribute("inert")).toBe(true);
    expect(host?.style.pointerEvents).toBe("none");
    expect(host?.style.userSelect).toBe("none");
  });

  it("keeps authored links inert inside the preview", () => {
    renderNode(
      <PresentationThumbnailPreview
        preview={previewData(
          linkedSlide("slide-1", "Visit example", "https://example.com"),
        )}
      />,
    );

    const link = container.querySelector<HTMLElement>(
      '[data-powershow-link="true"]',
    );
    expect(link).not.toBeNull();
    expect(
      link?.closest("[inert]") ?? link?.closest('[aria-hidden="true"]'),
    ).not.toBeNull();
  });

  it("selects the presentation row when the thumbnail area is clicked", () => {
    const onSelect = vi.fn();

    renderNode(
      <StudioI18nProvider>
        <PresentationList
          summaries={[
            summary("one", previewData(makeSlide("slide-1", "Hello world"))),
          ]}
          selectedId={null}
          liveState={{ kind: "none" }}
          openingId={null}
          onSelect={onSelect}
        />
      </StudioI18nProvider>,
    );

    const row = container.querySelector<HTMLButtonElement>("button");
    const slide = row?.querySelector(".powershow-slide");

    act(() => {
      slide?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(onSelect).toHaveBeenCalledWith("one");
  });
});

describe("presentation library thumbnail reads", () => {
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

  it("renders previews from the list snapshot without extra presentation reads", async () => {
    const listPresentations = vi.fn(
      async () => [summary("one", previewData(makeSlide("slide-1", "Hello world")))],
    );
    const getPresentation = vi.fn(async () => null);
    const repository: PresentationRepository = {
      listPresentations,
      getPresentation,
      createPresentation: vi.fn(async () => {}),
      savePresentation: vi.fn(async () => {}),
      archivePresentation: vi.fn(async () => {}),
      restorePresentation: vi.fn(async () => {}),
      movePresentationToFolder: vi.fn(async () => {}),
      publishPresentation: vi.fn(async () => ({
        publicationId: "publication-id",
        versionId: "version-id",
        publishedRevision: 1,
        createdVersion: true,
      })),
    };

    act(() => {
      root.render(
        <StudioI18nProvider>
          <PresentationLibrary repository={repository} />
        </StudioI18nProvider>,
      );
    });

    await act(async () => {
      await new Promise<void>((resolve) => queueMicrotask(resolve));
    });

    expect(container.querySelector(".powershow-slide")).not.toBeNull();
    expect(listPresentations).toHaveBeenCalledTimes(1);
    expect(getPresentation).not.toHaveBeenCalled();
  });
});
