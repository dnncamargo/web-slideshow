// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { EmbedElement, PowerShowElement } from "@powershow/document-schema";

import { ElementInspector } from "../src/features/editor/element-inspector";
import { EmbedInspector } from "../src/features/editor/inspector/embed-inspector";
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

function embedElement(
  overrides: Partial<Omit<EmbedElement, "type">> = {},
): EmbedElement {
  return {
    id: "embed-1",
    type: "embed",
    src: "https://example.com/",
    title: "Embedded content",
    hidden: false,
    ...overrides,
  };
}

describe("EmbedInspector", () => {
  let container: HTMLDivElement;
  let root: Root;
  let elementState: EmbedElement;
  let updates: EmbedElement[];

  function renderInspector() {
    root.render(
      <StudioI18nProvider>
        <EmbedInspector
          element={elementState}
          onUpdate={(update) => {
            const next = update(elementState);
            if (next.type !== "embed") {
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

  function mount(initial: EmbedElement) {
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

  function srcInput(): HTMLInputElement {
    const input = container.querySelector<HTMLInputElement>("#embed-src");
    if (!input) {
      throw new Error("embed-src input not found");
    }
    return input;
  }

  function titleInput(): HTMLInputElement {
    const input = container.querySelector<HTMLInputElement>("#embed-title");
    if (!input) {
      throw new Error("embed-title input not found");
    }
    return input;
  }

  function changeInput(input: HTMLInputElement, value: string): void {
    const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
      window.HTMLInputElement.prototype,
      "value",
    )?.set;

    nativeInputValueSetter?.call(input, value);

    input.dispatchEvent(new Event("input", { bubbles: true }));
  }

  function blurInput(input: HTMLInputElement): void {
    input.dispatchEvent(new FocusEvent("focusout", { bubbles: true }));
  }

  function pressKey(input: HTMLInputElement, key: string): void {
    input.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true }));
  }

  it("mounts without writing canonical state", async () => {
    await act(async () => {
      mount(embedElement());
    });

    expect(updates).toHaveLength(0);
  });

  it("renders the canonical src", async () => {
    await act(async () => {
      mount(embedElement());
    });

    expect(srcInput().value).toBe("https://example.com/");
  });

  it("renders the canonical title", async () => {
    await act(async () => {
      mount(embedElement({ title: "Live chart" }));
    });

    expect(titleInput().value).toBe("Live chart");
  });

  it("typing src alone does not write canonical state", async () => {
    await act(async () => {
      mount(embedElement());
    });

    await act(async () => {
      changeInput(srcInput(), "https://other.example.com/");
    });

    expect(updates).toHaveLength(0);
    expect(elementState.src).toBe("https://example.com/");
  });

  it("commits a valid src on blur", async () => {
    await act(async () => {
      mount(embedElement());
    });

    await act(async () => {
      changeInput(srcInput(), "https://player.example.com/demo");
    });

    await act(async () => {
      blurInput(srcInput());
    });

    expect(updates).toHaveLength(1);
    expect(elementState.src).toBe("https://player.example.com/demo");
  });

  it("commits a valid src through Enter blur behavior", async () => {
    await act(async () => {
      mount(embedElement());
    });

    await act(async () => {
      changeInput(srcInput(), "http://example.com/enter");
    });

    await act(async () => {
      const input = srcInput();
      input.focus();
      pressKey(input, "Enter");
    });

    expect(elementState.src).toBe("http://example.com/enter");
  });

  it("never writes an invalid URL to canonical state", async () => {
    await act(async () => {
      mount(embedElement());
    });

    await act(async () => {
      changeInput(srcInput(), "javascript:alert(1)");
    });

    await act(async () => {
      blurInput(srcInput());
    });

    expect(updates).toHaveLength(0);
    expect(elementState.src).toBe("https://example.com/");
  });

  it("shows a message for an invalid URL", async () => {
    await act(async () => {
      mount(embedElement());
    });

    await act(async () => {
      changeInput(srcInput(), "not-a-url");
    });

    await act(async () => {
      blurInput(srcInput());
    });

    const message = Array.from(container.querySelectorAll("small")).find(
      (small) => small.textContent?.includes("HTTP or HTTPS"),
    );

    expect(message).not.toBeUndefined();
  });

  it("resets the src draft to canonical src after an invalid commit", async () => {
    await act(async () => {
      mount(embedElement());
    });

    await act(async () => {
      changeInput(srcInput(), "/relative/path");
    });

    await act(async () => {
      blurInput(srcInput());
    });

    expect(srcInput().value).toBe("https://example.com/");
  });

  it("treats surrounding whitespace as invalid and never writes it", async () => {
    await act(async () => {
      mount(embedElement());
    });

    await act(async () => {
      changeInput(srcInput(), "  https://example.com/  ");
    });

    await act(async () => {
      blurInput(srcInput());
    });

    expect(updates).toHaveLength(0);
    expect(elementState.src).toBe("https://example.com/");
    expect(srcInput().value).toBe("https://example.com/");
  });

  it("Escape restores the canonical src without writing", async () => {
    await act(async () => {
      mount(embedElement());
    });

    await act(async () => {
      changeInput(srcInput(), "https://changed.example.com/");
    });

    await act(async () => {
      pressKey(srcInput(), "Escape");
    });

    expect(updates).toHaveLength(0);
    expect(srcInput().value).toBe("https://example.com/");
  });

  it("typing title alone does not write canonical state", async () => {
    await act(async () => {
      mount(embedElement());
    });

    await act(async () => {
      changeInput(titleInput(), "New title");
    });

    expect(updates).toHaveLength(0);
    expect(elementState.title).toBe("Embedded content");
  });

  it("commits a non-empty title", async () => {
    await act(async () => {
      mount(embedElement());
    });

    await act(async () => {
      changeInput(titleInput(), "Quarterly results");
    });

    await act(async () => {
      blurInput(titleInput());
    });

    expect(updates).toHaveLength(1);
    expect(elementState.title).toBe("Quarterly results");
  });

  it("never writes an empty title to canonical state", async () => {
    await act(async () => {
      mount(embedElement());
    });

    await act(async () => {
      changeInput(titleInput(), "");
    });

    await act(async () => {
      blurInput(titleInput());
    });

    expect(updates).toHaveLength(0);
    expect(elementState.title).toBe("Embedded content");
  });

  it("shows a required message for an empty title", async () => {
    await act(async () => {
      mount(embedElement());
    });

    await act(async () => {
      changeInput(titleInput(), "");
    });

    await act(async () => {
      blurInput(titleInput());
    });

    const message = Array.from(container.querySelectorAll("small")).find(
      (small) => small.textContent?.includes("Enter a title"),
    );

    expect(message).not.toBeUndefined();
  });

  it("resets the title draft to canonical title after an empty commit", async () => {
    await act(async () => {
      mount(embedElement({ title: "Original" }));
    });

    await act(async () => {
      changeInput(titleInput(), "");
    });

    await act(async () => {
      blurInput(titleInput());
    });

    expect(titleInput().value).toBe("Original");
  });

  it("Escape restores the canonical title without writing", async () => {
    await act(async () => {
      mount(embedElement());
    });

    await act(async () => {
      changeInput(titleInput(), "Draft title");
    });

    await act(async () => {
      pressKey(titleInput(), "Escape");
    });

    expect(updates).toHaveLength(0);
    expect(titleInput().value).toBe("Embedded content");
  });

  it("switching selected elements does not leak drafts", async () => {
    await act(async () => {
      mount(embedElement());
    });

    await act(async () => {
      changeInput(srcInput(), "https://draft.example.com/");
      changeInput(titleInput(), "Draft title");
    });

    await act(async () => {
      mount(
        embedElement({
          id: "embed-2",
          src: "https://second.example.com/",
          title: "Second embed",
        }),
      );
    });

    expect(updates).toHaveLength(0);
    expect(srcInput().value).toBe("https://second.example.com/");
    expect(titleInput().value).toBe("Second embed");
  });

  it("keeps Appearance controls available", async () => {
    await act(async () => {
      mount(embedElement());
    });

    const backgroundInput = container.querySelector<HTMLInputElement>(
      "#embed-background-value",
    );

    expect(backgroundInput).not.toBeNull();
  });

  it("keeps Effects controls available", async () => {
    await act(async () => {
      mount(embedElement());
    });

    const shadowMode = container.querySelector<HTMLSelectElement>(
      "#embed-shadow-mode",
    );

    expect(shadowMode).not.toBeNull();
  });

  it("renders no sandbox, security, provider or loading controls", async () => {
    await act(async () => {
      mount(embedElement());
    });

    const html = container.innerHTML;

    expect(html).not.toContain("allow-same-origin");
    expect(html).not.toContain("sandbox");
    expect(html).not.toContain("security");
    expect(html).not.toContain("trusted");
    expect(html).not.toContain("srcDoc");
    expect(html).not.toContain("loading");
    expect(html).not.toContain("provider");
    expect(html).not.toContain("YouTube");
    expect(html).not.toContain("Vimeo");
    expect(html).not.toContain("oEmbed");
  });
});

describe("ElementInspector dispatcher for Embed", () => {
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

  it("renders the EmbedInspector for a selected Embed", async () => {
    const element: PowerShowElement = embedElement();

    await act(async () => {
      root.render(
        <StudioI18nProvider>
          <ElementInspector
            element={element}
            onUpdate={() => undefined}
            fontResources={FONT_RESOURCES}
            preserveImageProportion={false}
            onPreserveImageProportionChange={() => {}}
            focalEditingImageId={null}
            onFocalEditingImageIdChange={() => {}}
            parent={null}
            layerControls={null}
            topicsAuthoringControls={TOPICS_AUTHORING_CONTROLS}
            blocksAuthoringControls={BLOCKS_AUTHORING_CONTROLS}
            tableAuthoringControls={TABLE_AUTHORING_CONTROLS}
          />
        </StudioI18nProvider>,
      );
    });

    const src = container.querySelector<HTMLInputElement>("#embed-src");
    const title = container.querySelector<HTMLInputElement>("#embed-title");

    expect(src).not.toBeNull();
    expect(title).not.toBeNull();
    expect(src?.value).toBe("https://example.com/");
  });
});
