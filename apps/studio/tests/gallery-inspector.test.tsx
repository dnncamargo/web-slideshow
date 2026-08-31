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
  TableAuthoringControls,
  TopicsAuthoringControls,
} from "../src/features/editor/inspector/inspector-types";
import { StudioI18nProvider } from "../src/features/i18n/studio-i18n-context";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

const FONT_RESOURCES: readonly { id: string; family: string }[] = [];

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
  let selectedItemIndex: number | null = null;

  function renderInspector() {
    root.render(
      <StudioI18nProvider>
        <GalleryInspector
          element={elementState}
          selectedItemIndex={selectedItemIndex}
          onSelectedItemIndexChange={(index) => {
            selectedItemIndex = index;
            renderInspector();
          }}
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
    selectedItemIndex = initial.items.length > 0 ? 0 : null;
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

  function itemInput(field: string): HTMLInputElement {
    const input = container.querySelector<HTMLInputElement>(
      `#gallery-gallery-1-item-${selectedItemIndex}-${field}`,
    );
    if (!input) throw new Error(`Gallery input not found: ${field}`);
    return input;
  }

  function changeInput(input: HTMLInputElement, value: string): void {
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value")?.set;
    setter?.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  }

  function buttonWithText(text: string): HTMLButtonElement {
    const button = Array.from(container.querySelectorAll<HTMLButtonElement>("button")).find((candidate) => candidate.textContent?.includes(text));
    if (!button) throw new Error(`Button not found: ${text}`);
    return button;
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
    const rows = container.querySelectorAll("[data-powershow-gallery-select]");
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
    await act(async () => {
      container.querySelector<HTMLButtonElement>('[data-powershow-gallery-select][data-powershow-gallery-index="1"]')?.click();
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
      container.querySelector<HTMLButtonElement>('[data-powershow-gallery-select][data-powershow-gallery-index="1"]')?.click();
    });
    await act(async () => {
      setTextAreaValue(itemAlt("#gallery-gallery-1-item-1-alt"), "Changed");
    });
    expect(updates[0]?.items[1]?.alt).toBe("Changed");
    expect(updates[0]?.items[0]?.alt).toBe("One");
  });

  it("shows effective default crop values for an item without crop", async () => {
    await act(async () => mount(galleryElement()));
    expect(itemInput("crop-x").value).toBe("0");
    expect(itemInput("crop-y").value).toBe("0");
    expect(itemInput("crop-width").value).toBe("100");
    expect(itemInput("crop-height").value).toBe("100");
  });

  it("edits and clamps crop only on the selected item", async () => {
    await act(async () => mount(galleryElement({ items: [
      { src: "/one.png", alt: "One", fit: "cover" },
      { src: "/two.png", alt: "Two", focalPoint: { x: 20, y: 30 } },
    ] })));
    await act(async () => changeInput(itemInput("crop-x"), "120"));
    expect(elementState.items[0]).toMatchObject({ src: "/one.png", alt: "One", fit: "cover", crop: { x: 99, y: 0, width: 1, height: 100 } });
    expect(elementState.items[1]).toEqual({ src: "/two.png", alt: "Two", focalPoint: { x: 20, y: 30 } });
  });

  it("resets only the selected item crop", async () => {
    await act(async () => mount(galleryElement({ items: [{ src: "/one.png", alt: "One", fit: "cover", crop: { x: 10, y: 20, width: 60, height: 50 }, focalPoint: { x: 25, y: 70 } }, DEFAULT_ITEMS[1]!] })));
    await act(async () => buttonWithText("Reset crop").click());
    expect(elementState.items[0]).toEqual({ src: "/one.png", alt: "One", fit: "cover", crop: undefined, focalPoint: { x: 25, y: 70 } });
    expect(elementState.items[1]).toEqual(DEFAULT_ITEMS[1]);
  });

  it("authors focal presets and clamped coordinates only on the selected item", async () => {
    await act(async () => mount(galleryElement({ items: [DEFAULT_ITEMS[0]!, { src: "/two.png", alt: "Two", crop: { x: 5, y: 6, width: 70, height: 80 } }] })));
    const presets = Array.from(container.querySelectorAll<HTMLButtonElement>("[aria-pressed]")).slice(-9);
    await act(async () => presets[8]?.click());
    expect(elementState.items[0]?.focalPoint).toEqual({ x: 100, y: 100 });
    await act(async () => changeInput(itemInput("focal-x"), "-10"));
    expect(elementState.items[0]?.focalPoint).toEqual({ x: 0, y: 100 });
    expect(elementState.items[1]).toEqual({ src: "/two.png", alt: "Two", crop: { x: 5, y: 6, width: 70, height: 80 } });
  });

  it("resets focal point, preserves crop, and follows item selection", async () => {
    await act(async () => mount(galleryElement({ items: [
      { src: "/one.png", alt: "One", crop: { x: 10, y: 20, width: 60, height: 50 }, focalPoint: { x: 10, y: 20 } },
      { src: "/two.png", alt: "Two", crop: { x: 2, y: 3, width: 90, height: 80 }, focalPoint: { x: 80, y: 90 } },
    ] })));
    await act(async () => container.querySelector<HTMLButtonElement>('[data-powershow-gallery-index="1"]')?.click());
    expect(itemInput("crop-x").value).toBe("2");
    expect(itemInput("focal-x").value).toBe("80");
    await act(async () => buttonWithText("Reset to center").click());
    expect(elementState.items[1]).toEqual({ src: "/two.png", alt: "Two", crop: { x: 2, y: 3, width: 90, height: 80 }, focalPoint: undefined });
    expect(Array.from(container.querySelectorAll<HTMLButtonElement>("button")).some((button) => button.textContent?.includes("Edit Crop on Canvas"))).toBe(false);
    expect(Array.from(container.querySelectorAll<HTMLButtonElement>("button")).some((button) => button.textContent?.includes("Edit Focal Point on Canvas"))).toBe(false);
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
      container.querySelector<HTMLButtonElement>('[data-powershow-gallery-select][data-powershow-gallery-index="1"]')?.click();
    });
    await act(async () => {
      moveUpButtons()[0]?.click();
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
  });

  it("last move down is disabled", async () => {
    await act(async () => {
      mount(galleryElement());
    });
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
            onContainerFitModeChange={() => true}
            fontResources={FONT_RESOURCES}
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
            onContainerFitModeChange={() => true}
            fontResources={FONT_RESOURCES}
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
