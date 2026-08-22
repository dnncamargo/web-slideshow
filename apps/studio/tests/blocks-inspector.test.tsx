// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type {
  BlockItem,
  BlockPart,
  BlocksElement,
  PowerShowElement,
} from "@powershow/document-schema";

import { StudioI18nProvider } from "../src/features/i18n/studio-i18n-context";
import { BlocksInspector } from "../src/features/editor/inspector/blocks-inspector";
import type { BlocksAuthoringControls } from "../src/features/editor/inspector/inspector-types";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

const textPart = (id: string): BlockPart => ({
  id,
  type: "text",
  text: id,
});

const socketValue = (id: string, categoryId: string): BlockItem => ({
  id,
  categoryId,
  shape: "value",
  parts: [textPart(`${id}-p`)],
  children: [],
});

function fixturesBlocks(
  overrides: {
    categories?: { id: string; name: string; color: string }[];
    items?: BlockItem[];
  } = {},
): BlocksElement {
  return {
    type: "blocks",
    id: "blocks-1",
    hidden: false,
    categories: [
      { id: "cat", name: "Category", color: "#6366f1" },
    ],
    items: [
      {
        id: "scope-a",
        categoryId: "cat",
        shape: "scope",
        parts: [
          textPart("scope-a-text"),
          {
            id: "scope-a-socket",
            type: "socket",
            content: { type: "block", block: socketValue("value-a", "cat") },
          },
        ],
        children: [
          {
            id: "child-a",
            categoryId: "cat",
            shape: "statement",
            parts: [textPart("child-a-text")],
            children: [],
          },
        ],
      },
    ],
    ...overrides,
  };
}

describe("BlocksInspector (temporary, non-destructive)", () => {
  let container: HTMLDivElement;
  let root: Root;
  let elementState: BlocksElement;
  let updates: PowerShowElement[];
  let onUpdate: ReturnType<typeof vi.fn>;
  let controls: BlocksAuthoringControls;

  function renderInspector() {
    root.render(
      <StudioI18nProvider>
        <BlocksInspector
          element={elementState}
          onUpdate={onUpdate}
          blocksAuthoringControls={controls}
        />
      </StudioI18nProvider>,
    );
  }

  function mount(initial?: BlocksElement) {
    elementState = initial ?? fixturesBlocks();
    updates = [];
    onUpdate = vi.fn(
      (update: (element: PowerShowElement) => PowerShowElement) => {
        const next = update(elementState);
        elementState = next as BlocksElement;
        updates.push(elementState);
      },
    );
    controls = {
      onAddRootBlock: vi.fn(() => null),
      onAddScopeChild: vi.fn(() => null),
      onAddTextPart: vi.fn(() => null),
      onAddSocketPart: vi.fn(() => null),
      onCreateSocketValue: vi.fn(() => null),
    };
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

  it("renders without performing any document write", async () => {
    await act(async () => {
      mount();
    });

    expect(updates).toHaveLength(0);
    expect(container.querySelector('[data-powershow-blocks-inspector="true"]'))
      .not.toBeNull();
  });

  it("counts children and socket values through both recursion edges", async () => {
    await act(async () => {
      mount();
    });

    const count = container.querySelector(
      "[data-powershow-blocks-count]",
    )?.getAttribute("data-powershow-blocks-count");
    const categories = container.querySelector(
      "[data-powershow-blocks-categories]",
    )?.getAttribute("data-powershow-blocks-categories");

    // scope-a + child-a + socket value value-a = 3 root/nested blocks
    expect(count).toBe("3");
    expect(categories).toBe("1");
  });

  it("receives BlocksAuthoringControls but never invokes them while temporary", async () => {
    await act(async () => {
      mount();
    });

    expect(controls.onAddRootBlock).not.toHaveBeenCalled();
    expect(controls.onAddScopeChild).not.toHaveBeenCalled();
    expect(controls.onAddTextPart).not.toHaveBeenCalled();
    expect(controls.onAddSocketPart).not.toHaveBeenCalled();
    expect(controls.onCreateSocketValue).not.toHaveBeenCalled();
  });

  it("exposes no R2-B authoring controls yet", async () => {
    await act(async () => {
      mount();
    });

    const authoringMarkers = container.querySelectorAll(
      "[data-powershow-block-add]",
    );
    expect(authoringMarkers).toHaveLength(0);
  });

  it("keeps the obsolete text editor out of the temporary inspector", async () => {
    await act(async () => {
      mount();
    });

    expect(
      container.querySelector('input[data-powershow-block-text="true"]'),
    ).toBeNull();
    expect(
      container.querySelector('textarea[data-powershow-block-text="true"]'),
    ).toBeNull();
  });

  it("keeps Appearance and Effects sections", async () => {
    await act(async () => {
      mount();
    });

    const text = container.textContent ?? "";
    expect(text).toContain("Appearance");
    expect(text).toContain("Effects");
  });
});