// @vitest-environment jsdom

import { act } from "react";
import type { ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { Presentation, Slide } from "@web-slideshow/document-schema";
import { renderPresentation } from "@web-slideshow/renderer";

import { PresentationThumbnail } from "../src/features/library/presentation-thumbnail";
import { PresentationThumbnailPreview } from "../src/features/library/presentation-thumbnail-preview";
import { PresentationList } from "../src/features/library/presentation-list";
import { PresentationLibrary } from "../src/features/library/presentation-library";
import { deriveThumbnailPreview } from "../src/features/persistence/presentation-persistence";
import { StudioI18nProvider } from "../src/features/i18n/studio-i18n-context";
import type {
  PresentationSummary,
  PresentationThumbnailPreview as PresentationThumbnailPreviewData,
} from "../src/features/persistence/presentation-persistence";
import type { PresentationRepository } from "../src/features/persistence/presentation-repository";
import type { PresentationFolderRepository } from "../src/features/persistence/presentation-folder-repository";

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

function croppedImageSlide(id: string): Slide {
  return {
    id,
    title: "",
    summary: "",
    speakerNotes: "",
    elements: [{
      id: `${id}-image`,
      type: "image",
      hidden: false,
      src: "/assets/cropped-image.png",
      alt: "Cropped image",
      fit: "contain",
      crop: { x: 10, y: 20, width: 60, height: 50 },
      layout: { width: 640, height: 360 },
    }],
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
  const presentation: Presentation = {
    schemaVersion: 1,
    id: "thumbnail-presentation",
    title: "Thumbnail presentation",
    description: "",
    aspectRatio,
    slides: [firstSlide],
  };

  return { aspectRatio, firstSlide, presentation };
}

function rootBackedPreview(): PresentationThumbnailPreviewData {
  const preview = deriveThumbnailPreview({
    schemaVersion: 1,
    id: "root-backed-presentation",
    title: "Root-backed presentation",
    slides: [{
      id: "slide-1",
      elements: [],
      localRootChildren: [{
        targetContainerId: "target",
        children: [{ id: "local-text", type: "text", content: "Local content" }],
      }],
    }],
    rootDefinitions: [{
      id: "master",
      name: "Master",
      root: {
        id: "master-root",
        type: "container",
        children: [
          { id: "master-text", type: "text", content: "Master content" },
          { id: "target", type: "container", children: [] },
        ],
      },
      localChildTargetIds: ["target"],
    }],
    defaultRootDefinitionId: "master",
  });

  if (!preview) {
    throw new Error("Expected root-backed thumbnail preview fixture to parse.");
  }
  return preview;
}

function referencedStylePreview(): PresentationThumbnailPreviewData {
  const preview = deriveThumbnailPreview({
    schemaVersion: 1,
    id: "referenced-style-presentation",
    title: "Referenced styles",
    slides: [{ id: "slide-1", elements: [], rootDefinitionId: "master" }],
    defaultRootDefinitionId: "master",
    palette: { colors: [{ id: "accent", name: "Accent", value: "#facc15" }] },
    resources: {
      fonts: [{
        id: "demo-font",
        family: "Demo Sans",
        source: { type: "url", url: "https://example.com/demo.woff2", format: "woff2" },
      }],
    },
    textStyles: [{
      id: "master-text-style",
      name: "Master text",
      role: "body",
      style: { color: { kind: "palette", colorId: "accent" } },
      typography: { fontFamily: "Demo Sans", fontWeight: 700 },
    }],
    linkedStyles: [{
      id: "master-card-style",
      name: "Master card",
      style: { background: { color: { kind: "palette", colorId: "accent" } } },
    }],
    rootDefinitions: [{
      id: "master",
      name: "Master",
      root: {
        id: "master-root",
        type: "container",
        children: [{
          id: "master-card",
          type: "container",
          linkedStyleId: "master-card-style",
          children: [{
            id: "master-text",
            type: "text",
            variant: "master-text-style",
            content: "Master content",
          }],
        }],
      },
    }],
  });

  if (!preview) {
    throw new Error("Expected referenced-style thumbnail preview fixture to parse.");
  }
  return preview;
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

    const slide = container.querySelector(".presentation-slide");
    expect(slide).not.toBeNull();
    expect(slide?.getAttribute("data-presentation-slide-id")).toBe("slide-1");
    expect(container.textContent).toContain("Hello world");
    expect(container.querySelector('[data-presentation-type="text"]')).not.toBeNull();
  });

  it("hydrates an already-loaded cropped Image after the thumbnail scale rerender", () => {
    const originalNaturalWidth = Object.getOwnPropertyDescriptor(
      HTMLImageElement.prototype,
      "naturalWidth",
    );
    const originalNaturalHeight = Object.getOwnPropertyDescriptor(
      HTMLImageElement.prototype,
      "naturalHeight",
    );
    const originalGetBoundingClientRect = HTMLElement.prototype.getBoundingClientRect;

    Object.defineProperty(HTMLImageElement.prototype, "naturalWidth", {
      configurable: true,
      get() {
        return 1200;
      },
    });
    Object.defineProperty(HTMLImageElement.prototype, "naturalHeight", {
      configurable: true,
      get() {
        return 800;
      },
    });
    HTMLElement.prototype.getBoundingClientRect = function getBoundingClientRect() {
      if (this.hasAttribute("aria-hidden") && this.hasAttribute("inert")) {
        return { width: 320, height: 180 } as DOMRect;
      }

      if (this.dataset.presentationImageCrop !== undefined) {
        const stage = this.closest<HTMLElement>("[data-presentation-thumbnail-stage]");
        const isMeasured = stage?.style.transform !== "scale(0)";
        return { width: isMeasured ? 640 : 0, height: isMeasured ? 360 : 0 } as DOMRect;
      }

      return { width: 0, height: 0 } as DOMRect;
    };

    try {
      renderNode(
        <PresentationThumbnailPreview
          preview={previewData(croppedImageSlide("slide-1"))}
        />,
      );

      const imageRoot = container.querySelector<HTMLElement>("[data-presentation-image-crop]");
      const viewport = container.querySelector<HTMLElement>(".presentation-image-crop-viewport");
      const image = container.querySelector<HTMLImageElement>(".presentation-image-media");
      const stage = container.querySelector<HTMLElement>("[data-presentation-thumbnail-stage]");

      expect(imageRoot).not.toBeNull();
      expect(stage?.style.transform).not.toBe("scale(0)");
      expect(Number.parseFloat(viewport?.style.width ?? "0")).toBeCloseTo(640);
      expect(Number.parseFloat(viewport?.style.height ?? "0")).toBeCloseTo(355.5555556);
      expect(Number.parseFloat(image?.style.width ?? "0")).toBeCloseTo(1066.6666667);
      expect(Number.parseFloat(image?.style.height ?? "0")).toBeCloseTo(711.1111111);
      expect(Number.parseFloat(image?.style.left ?? "0")).toBeCloseTo(-106.6666667);
      expect(Number.parseFloat(image?.style.top ?? "0")).toBeCloseTo(-142.2222222);
    } finally {
      if (originalNaturalWidth) {
        Object.defineProperty(HTMLImageElement.prototype, "naturalWidth", originalNaturalWidth);
      } else {
        delete (HTMLImageElement.prototype as unknown as Record<string, unknown>).naturalWidth;
      }
      if (originalNaturalHeight) {
        Object.defineProperty(HTMLImageElement.prototype, "naturalHeight", originalNaturalHeight);
      } else {
        delete (HTMLImageElement.prototype as unknown as Record<string, unknown>).naturalHeight;
      }
      HTMLElement.prototype.getBoundingClientRect = originalGetBoundingClientRect;
    }
  });

  it("rehydrates cropped Image geometry after a thumbnail ResizeObserver rescale", () => {
    const originalNaturalWidth = Object.getOwnPropertyDescriptor(
      HTMLImageElement.prototype,
      "naturalWidth",
    );
    const originalNaturalHeight = Object.getOwnPropertyDescriptor(
      HTMLImageElement.prototype,
      "naturalHeight",
    );
    const originalGetBoundingClientRect = HTMLElement.prototype.getBoundingClientRect;
    const originalResizeObserver = Object.getOwnPropertyDescriptor(globalThis, "ResizeObserver");
    let hostSize = { width: 320, height: 180 };
    let notifyResize: (() => void) | undefined;

    Object.defineProperty(HTMLImageElement.prototype, "naturalWidth", {
      configurable: true,
      get() {
        return 1200;
      },
    });
    Object.defineProperty(HTMLImageElement.prototype, "naturalHeight", {
      configurable: true,
      get() {
        return 800;
      },
    });
    HTMLElement.prototype.getBoundingClientRect = function getBoundingClientRect() {
      if (this.hasAttribute("aria-hidden") && this.hasAttribute("inert")) {
        return hostSize as DOMRect;
      }

      if (this.dataset.presentationImageCrop !== undefined) {
        const stage = this.closest<HTMLElement>("[data-presentation-thumbnail-stage]");
        const isMeasured = stage?.style.transform !== "scale(0)";
        return { width: isMeasured ? 640 : 0, height: isMeasured ? 360 : 0 } as DOMRect;
      }

      return { width: 0, height: 0 } as DOMRect;
    };

    class TestResizeObserver {
      constructor(callback: ResizeObserverCallback) {
        notifyResize = () => callback([], this as unknown as ResizeObserver);
      }

      observe(): void {}
      disconnect(): void {}
    }

    Object.defineProperty(globalThis, "ResizeObserver", {
      configurable: true,
      writable: true,
      value: TestResizeObserver,
    });

    try {
      renderNode(
        <PresentationThumbnailPreview
          preview={previewData(croppedImageSlide("slide-1"))}
        />,
      );

      const stage = container.querySelector<HTMLElement>("[data-presentation-thumbnail-stage]");
      const viewport = container.querySelector<HTMLElement>(".presentation-image-crop-viewport");
      const initialScale = stage?.style.transform;

      hostSize = { width: 160, height: 90 };
      act(() => notifyResize?.());

      expect(stage?.style.transform).not.toBe(initialScale);
      expect(Number.parseFloat(viewport?.style.width ?? "0")).toBeGreaterThan(0);
      expect(Number.parseFloat(viewport?.style.height ?? "0")).toBeGreaterThan(0);
    } finally {
      if (originalNaturalWidth) {
        Object.defineProperty(HTMLImageElement.prototype, "naturalWidth", originalNaturalWidth);
      } else {
        delete (HTMLImageElement.prototype as unknown as Record<string, unknown>).naturalWidth;
      }
      if (originalNaturalHeight) {
        Object.defineProperty(HTMLImageElement.prototype, "naturalHeight", originalNaturalHeight);
      } else {
        delete (HTMLImageElement.prototype as unknown as Record<string, unknown>).naturalHeight;
      }
      HTMLElement.prototype.getBoundingClientRect = originalGetBoundingClientRect;
      if (originalResizeObserver) {
        Object.defineProperty(globalThis, "ResizeObserver", originalResizeObserver);
      } else {
        delete (globalThis as { ResizeObserver?: unknown }).ResizeObserver;
      }
    }
  });

  it("keeps Presentation-level palette and font resources for referenced master styles", () => {
    const preview = referencedStylePreview();
    const normalMarkup = renderPresentation(preview.presentation);

    expect(normalMarkup).toContain("--ps-palette-0061006300630065006e0074:#facc15");
    expect(normalMarkup).toContain("@font-face");

    renderNode(<PresentationThumbnailPreview preview={preview} />);

    const paletteStyle = container.querySelector("style[data-presentation-thumbnail-palette]");
    expect(paletteStyle?.textContent).toContain(
      "--ps-palette-0061006300630065006e0074:#facc15",
    );
    expect(container.querySelector("[data-presentation-thumbnail-stage]")).not.toBeNull();
    expect(container.querySelector("style[data-presentation-font-resources]")).not.toBeNull();
  });

  it("renders only the preview first slide (never additional slides)", () => {
    renderNode(
      <PresentationThumbnailPreview
        preview={previewData(makeSlide("slide-1", "First slide"))}
      />,
    );

    expect(container.querySelectorAll(".presentation-slide")).toHaveLength(1);
    expect(container.textContent).toContain("First slide");
    expect(container.textContent).not.toContain("Second slide");
  });

  it("renders linked Containers with the preview owner Presentation context", () => {
    const firstSlide: Slide = {
      ...emptySlide("slide-1"),
      elements: [{
        id: "card",
        type: "container",
        hidden: false,
        linkedStyleId: "card-style",
        children: [],
      }],
    };
    const preview = previewData(firstSlide);
    preview.presentation.linkedStyles = [{
      id: "card-style",
      name: "Card",
      style: { background: { color: "#123456" } },
    }];

    renderNode(<PresentationThumbnailPreview preview={preview} />);

    expect(container.querySelector('[data-presentation-id="card"]')).not.toBeNull();
    expect(container.innerHTML).toContain("background:#123456");
  });

  it("renders a materialized Root Definition thumbnail with local content and IDs", () => {
    renderNode(
      <PresentationThumbnail
        summary={summary("root-backed", rootBackedPreview())}
      />,
    );

    expect(container.querySelector(".presentation-slide")).not.toBeNull();
    const master = container.querySelector('[data-presentation-id="master-text"]');
    const local = container.querySelector('[data-presentation-id="local-text"]');

    expect(master).not.toBeNull();
    expect(local).not.toBeNull();
    expect(container.textContent?.indexOf("Master content")).toBeLessThan(
      container.textContent?.indexOf("Local content") ?? -1,
    );
    expect(container.querySelector("[data-root-definition]")).toBeNull();
  });

  it("uses the decorative fallback when thumbnailPreview is absent", () => {
    renderNode(<PresentationThumbnail summary={summary("one")} />);

    expect(container.querySelector(".presentation-slide")).toBeNull();
  });

  it("uses the decorative fallback when the first slide has no authored elements", () => {
    renderNode(
      <PresentationThumbnail
        summary={summary("one", previewData(emptySlide("slide-1")))}
      />,
    );

    expect(container.querySelector(".presentation-slide")).toBeNull();
  });

  it("isolates the rendered preview from interaction and accessibility", () => {
    renderNode(
      <PresentationThumbnailPreview
        preview={previewData(makeSlide("slide-1", "Hello world"))}
      />,
    );

    const slide = container.querySelector(".presentation-slide");
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
      '[data-presentation-link="true"]',
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
    const slide = row?.querySelector(".presentation-slide");

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
      deleteArchivedPresentation: vi.fn(async () => {}),
      movePresentationToFolder: vi.fn(async () => {}),
      publishPresentation: vi.fn(async () => ({
        publicationId: "publication-id",
        versionId: "version-id",
        publishedRevision: 1,
        createdVersion: true,
      })),
    };

    const folderRepository: PresentationFolderRepository = {
      listFolders: vi.fn(async () => []),
      createFolder: vi.fn(async () => "folder-new"),
      renameFolder: vi.fn(async () => {}),
      deleteFolder: vi.fn(async () => {}),
    };

    act(() => {
      root.render(
        <StudioI18nProvider>
          <PresentationLibrary repository={repository} folderRepository={folderRepository} />
        </StudioI18nProvider>,
      );
    });

    await act(async () => {
      await new Promise<void>((resolve) => queueMicrotask(resolve));
    });

    expect(container.querySelector(".presentation-slide")).not.toBeNull();
    expect(listPresentations).toHaveBeenCalledTimes(1);
    expect(getPresentation).not.toHaveBeenCalled();
  });
});
