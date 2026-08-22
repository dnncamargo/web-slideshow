// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type {
  ContainerElement,
  GalleryElement,
  PowerShowElement,
} from "@powershow/document-schema";

import { ElementInspector } from "../src/features/editor/element-inspector";
import { GalleryInspector } from "../src/features/editor/inspector/gallery-inspector";
import type {
  BlocksAuthoringControls,
  FontResourceControls,
  TableAuthoringControls,
  TopicsAuthoringControls,
} from "../src/features/editor/inspector/inspector-types";
import { StudioI18nProvider } from "../src/features/i18n/studio-i18n-context";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

const FONT_RESOURCE_CONTROLS: FontResourceControls = {
  fontResources: [],
  onAddFontFace: vi.fn(),
  onRemoveFontFace: vi.fn(),
  isFontFamilyInUse: () => false,
};

const TOPICS_AUTHORING_CONTROLS: TopicsAuthoringControls = {
  onAddTopLevelTopic: () => null,
  onAddChildTopic: () => null,
};

const BLOCKS_AUTHORING_CONTROLS: BlocksAuthoringControls = {
  onAddRootBlock: () => null,
  onAddScopeChild: () => null,
  onAddTextPart: () => null,
  onAddSocketPart: () => null,
  onCreateSocketValue: () => null,
};

const TABLE_AUTHORING_CONTROLS: TableAuthoringControls = {
  onAddColumn: () => {},
  onRemoveColumn: () => {},
  onAddRow: () => {},
  onRemoveRow: () => {},
  onShowHeaderChange: () => {},
};

const DEFAULT_ITEMS = [
  { src: "/one.png", alt: "One" },
  { src: "/two.png", alt: "Two" },
];

function galleryElement(
  overrides: Partial<Omit<GalleryElement, "type">> = {},
): GalleryElement {
  return {
    id: "gallery-1",
    type: "gallery",
    hidden: false,
    fit: "contain",
    items: DEFAULT_ITEMS,
    ...overrides,
  };
}

describe("GalleryInspector", () => {
  let container: HTMLDivElement;
  let root: Root;
  let elementState: GalleryElement;
  let updates: GalleryElement[];

  function renderInspector() {
    root.render(
      <StudioI18nProvider>
        <GalleryInspector
          element={elementState}
          onUpdate={(update) => {
            const next = update(elementState);
            if (next.type !== "gallery") {
              return;
            }
            elementState = next;
            updates.push(elementState);
            renderInspector();
          }}
        />
      </StudioI18nProvider>,
    );
  }

  function mount(initial: GalleryElement) {
    elementState = initial;
    updates = [];
    renderInspector();
  }

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => {
      root.unmount();
    });
    document.body.innerHTML = "";
    vi.clearAllMocks();
  });

  function fitSelect(): HTMLSelectElement {
    const select = container.querySelector<HTMLSelectElement>("#gallery-fit");
    if (!select) {
      throw new Error("gallery-fit select not found");
    }
    return select;
  }

  function itemSrc(id: string): HTMLTextAreaElement {
    const input = container.querySelector<HTMLTextAreaElement>(id);
    if (!input) {
      throw new Error(`src textarea not found: ${id}`);
    }
    return input;
  }

  function itemAlt(id: string): HTMLTextAreaElement {
    const input = container.querySelector<HTMLTextAreaElement>(id);
    if (!input) {
      throw new Error(`alt textarea not found: ${id}`);
    }
    return input;
  }

  function setTextAreaValue(textarea: HTMLTextAreaElement, value: string) {
    const setter = Object.getOwnPropertyDescriptor(
      HTMLTextAreaElement.prototype,
      "value",
    )?.set;
    if (!setter) {
      throw new Error("Unable to set textarea value");
    }
    setter.call(textarea, value);
    textarea.dispatchEvent(new Event("input", { bubbles: true }));
  }

  function setFit(fit: GalleryElement["fit"]) {
    const select = fitSelect();
    select.value = fit;
    select.dispatchEvent(new Event("change", { bubbles: true }));
  }

  function addButton(): HTMLButtonElement {
    const button =
      container.querySelector<HTMLButtonElement>('[data-powershow-gallery-add]');
    if (!button) {
      throw new Error("gallery add button not found");
    }
    return button;
  }

  function removeButtons(): HTMLButtonElement[] {
    return Array.from(
      container.querySelectorAll<HTMLButtonElement>(
        "[data-powershow-gallery-remove]",
      ),
    );
  }

  function moveUpButtons(): HTMLButtonElement[] {
    return Array.from(
      container.querySelectorAll<HTMLButtonElement>(
        "[data-powershow-gallery-move-up]",
      ),
    );
  }

  function moveDownButtons(): HTMLButtonElement[] {
    return Array.from(
      container.querySelectorAll<HTMLButtonElement>(
        "[data-powershow-gallery-move-down]",
      ),
    );
  }

  it("renders the Gallery fit selector", async () => {
    await act(async () => {
      mount(galleryElement());
    });
    expect(fitSelect().value).toBe("contain");
  });

  it("displays all items in canonical order", async () => {
    await act(async () => {
      mount(galleryElement());
    });
    const rows = container.querySelectorAll("[data-powershow-gallery-item]");
    expect(rows).toHaveLength(2);
  });

  it("renders item source", async () => {
    await act(async () => {
      mount(galleryElement());
    });
    expect(itemSrc("#gallery-gallery-1-item-0-src").value).toBe("/one.png");
  });

  it("renders item alt", async () => {
    await act(async () => {
      mount(galleryElement());
    });
    expect(itemAlt("#gallery-gallery-1-item-1-alt").value).toBe("Two");
  });

  it("source edit updates only the targeted item", async () => {
    await act(async () => {
      mount(galleryElement());
    });
    await act(async () => {
      setTextAreaValue(itemSrc("#gallery-gallery-1-item-0-src"), "/changed.png");
    });
    expect(updates[0]?.items[0]?.src).toBe("/changed.png");
    expect(updates[0]?.items[1]?.src).toBe("/two.png");
  });

  it("alt edit updates only the targeted item", async () => {
    await act(async () => {
      mount(galleryElement());
    });
    await act(async () => {
      setTextAreaValue(itemAlt("#gallery-gallery-1-item-1-alt"), "Changed");
    });
    expect(updates[0]?.items[1]?.alt).toBe("Changed");
    expect(updates[0]?.items[0]?.alt).toBe("One");
  });

  it("changes fit through contain -> cover -> fill", async () => {
    await act(async () => {
      mount(galleryElement());
    });
    await act(async () => {
      setFit("cover");
    });
    expect(updates[0]?.fit).toBe("cover");
    await act(async () => {
      setFit("fill");
    });
    expect(updates[1]?.fit).toBe("fill");
  });

  it("add image appends the exact default item", async () => {
    await act(async () => {
      mount(galleryElement());
    });
    await act(async () => {
      addButton().click();
    });
    expect(updates[0]?.items).toHaveLength(3);
    expect(updates[0]?.items[2]).toEqual({
      src: "/powershow-demo.svg",
      alt: "New image",
    });
  });

  it("remove image removes the targeted item", async () => {
    await act(async () => {
      mount(galleryElement());
    });
    await act(async () => {
      removeButtons()[0]?.click();
    });
    expect(updates[0]?.items).toHaveLength(1);
    expect(updates[0]?.items[0]?.src).toBe("/two.png");
  });

  it("removal can produce an empty items array", async () => {
    await act(async () => {
      mount(galleryElement());
    });
    await act(async () => {
      removeButtons()[0]?.click();
    });
    await act(async () => {
      removeButtons()[0]?.click();
    });
    expect(updates.length).toBe(2);
    expect(updates[1]?.items).toEqual([]);
  });

  it("move up changes canonical order correctly", async () => {
    await act(async () => {
      mount(galleryElement());
    });
    await act(async () => {
      moveUpButtons()[1]?.click();
    });
    expect(updates[0]?.items.map((item) => item.src)).toEqual([
      "/two.png",
      "/one.png",
    ]);
  });

  it("move down changes canonical order correctly", async () => {
    await act(async () => {
      mount(galleryElement());
    });
    await act(async () => {
      moveDownButtons()[0]?.click();
    });
    expect(updates[0]?.items.map((item) => item.src)).toEqual([
      "/two.png",
      "/one.png",
    ]);
  });

  it("first move up is disabled", async () => {
    await act(async () => {
      mount(galleryElement());
    });
    expect(moveUpButtons()[0]?.disabled).toBe(true);
    expect(moveUpButtons()[1]?.disabled).toBe(false);
  });

  it("last move down is disabled", async () => {
    await act(async () => {
      mount(galleryElement());
    });
    expect(moveDownButtons()[1]?.disabled).toBe(true);
    expect(moveDownButtons()[0]?.disabled).toBe(false);
  });

  it("item updates never introduce an id", async () => {
    await act(async () => {
      mount(galleryElement());
    });
    await act(async () => {
      setTextAreaValue(itemSrc("#gallery-gallery-1-item-0-src"), "/changed.png");
    });
    expect(updates[0]?.items[0]).not.toHaveProperty("id");
  });

  it("Appearance section is wired for the Gallery root", async () => {
    await act(async () => {
      mount(galleryElement());
    });
    const neutralField = container.querySelector<HTMLInputElement>(
      "#gallery-background-value",
    );
    expect(neutralField).not.toBeNull();
  });

  it("Effects section is wired for the Gallery root", async () => {
    await act(async () => {
      mount(galleryElement());
    });
    const shadowMode = container.querySelector<HTMLSelectElement>(
      "#gallery-shadow-mode",
    );
    expect(shadowMode).not.toBeNull();
  });
});

describe("ElementInspector dispatcher for Gallery", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => {
      root.unmount();
    });
    document.body.innerHTML = "";
    vi.clearAllMocks();
  });

  it("renders the GalleryInspector for a selected Gallery", async () => {
    const element: PowerShowElement = galleryElement();
    const parent: ContainerElement | null = null;

    await act(async () => {
      root.render(
        <StudioI18nProvider>
          <ElementInspector
            element={element}
            onUpdate={() => undefined}
            fontResourceControls={FONT_RESOURCE_CONTROLS}
            preserveImageProportion={false}
            onPreserveImageProportionChange={() => {}}
            focalEditingImageId={null}
            onFocalEditingImageIdChange={() => {}}
            parent={parent}
            layerControls={null}
            topicsAuthoringControls={TOPICS_AUTHORING_CONTROLS}
            blocksAuthoringControls={BLOCKS_AUTHORING_CONTROLS}
            tableAuthoringControls={TABLE_AUTHORING_CONTROLS}
          />
        </StudioI18nProvider>,
      );
    });

    const fitSelect = container.querySelector<HTMLSelectElement>("#gallery-fit");
    expect(fitSelect).not.toBeNull();
    expect(fitSelect?.value).toBe("contain");
  });

  it("selecting a Gallery does not use the unsupported fallback", async () => {
    const element: PowerShowElement = galleryElement();
    const parent: ContainerElement | null = null;

    await act(async () => {
      root.render(
        <StudioI18nProvider>
          <ElementInspector
            element={element}
            onUpdate={() => undefined}
            fontResourceControls={FONT_RESOURCE_CONTROLS}
            preserveImageProportion={false}
            onPreserveImageProportionChange={() => {}}
            focalEditingImageId={null}
            onFocalEditingImageIdChange={() => {}}
            parent={parent}
            layerControls={null}
            topicsAuthoringControls={TOPICS_AUTHORING_CONTROLS}
            blocksAuthoringControls={BLOCKS_AUTHORING_CONTROLS}
            tableAuthoringControls={TABLE_AUTHORING_CONTROLS}
          />
        </StudioI18nProvider>,
      );
    });

    expect(container.querySelector("#gallery-fit")).not.toBeNull();
  });
});
