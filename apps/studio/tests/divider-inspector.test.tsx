// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type {
  ContainerElement,
  DividerElement,
  PowerShowElement,
} from "@powershow/document-schema";

import { ElementInspector } from "../src/features/editor/element-inspector";
import { DividerInspector } from "../src/features/editor/inspector/divider-inspector";
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

function dividerElement(
  overrides: Partial<Omit<DividerElement, "type">> = {},
): DividerElement {
  return {
    id: "divider-1",
    type: "divider",
    hidden: false,
    orientation: "horizontal",
    ...overrides,
  };
}

describe("DividerInspector", () => {
  let container: HTMLDivElement;
  let root: Root;
  let elementState: DividerElement;
  let updates: DividerElement[];

  function renderInspector() {
    root.render(
      <StudioI18nProvider>
        <DividerInspector
          element={elementState}
          onUpdate={(update) => {
            const next = update(elementState);
            if (next.type !== "divider") {
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

  function mount(initial: DividerElement) {
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

  function orientationSelect(): HTMLSelectElement {
    const select = container.querySelector<HTMLSelectElement>(
      "#divider-orientation",
    );
    if (!select) {
      throw new Error("divider-orientation select not found");
    }
    return select;
  }

  function widthInput(): HTMLInputElement {
    const input = container.querySelector<HTMLInputElement>("#divider-width");
    if (!input) {
      throw new Error("divider-width input not found");
    }
    return input;
  }

  function heightInput(): HTMLInputElement {
    const input = container.querySelector<HTMLInputElement>("#divider-height");
    if (!input) {
      throw new Error("divider-height input not found");
    }
    return input;
  }

  function radiusInput(): HTMLInputElement {
    const input = container.querySelector<HTMLInputElement>("#divider-border-radius");
    if (!input) throw new Error("divider-border-radius input not found");
    return input;
  }

  function opacityInput(): HTMLInputElement {
    const input = container.querySelector<HTMLInputElement>("#divider-opacity");
    if (!input) throw new Error("divider-opacity input not found");
    return input;
  }

  function setNumberInputValue(input: HTMLInputElement, value: string) {
    const setter = Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      "value",
    )?.set;

    if (!setter) {
      throw new Error("Unable to set input value");
    }

    setter.call(input, value);
    input.dispatchEvent(new Event("change", { bubbles: true }));
  }

  function setOrientation(orientation: "horizontal" | "vertical") {
    const select = orientationSelect();
    select.value = orientation;
    select.dispatchEvent(new Event("change", { bubbles: true }));
  }

  it("mounting with undefined dimensions performs no document write", async () => {
    await act(async () => {
      mount(dividerElement());
    });

    expect(updates).toHaveLength(0);
  });

  it("displays effective horizontal defaults without persisting them", async () => {
    await act(async () => {
      mount(dividerElement());
    });

    expect(widthInput().value).toBe("100");
    expect(heightInput().value).toBe("2");
    expect(updates).toHaveLength(0);
  });

  it("keeps both dimensions undefined when switching orientation with no explicit dims", async () => {
    await act(async () => {
      mount(dividerElement());
    });

    await act(async () => {
      setOrientation("vertical");
    });

    expect(updates).toHaveLength(1);
    expect(updates[0]?.orientation).toBe("vertical");
    expect(updates[0]?.layout?.width).toBeUndefined();
    expect(updates[0]?.layout?.height).toBeUndefined();
  });

  it("swaps both explicit dimensions when switching orientation", async () => {
    await act(async () => {
      mount(
        dividerElement({
          layout: { width: "50%", height: "6px" },
        }),
      );
    });

    await act(async () => {
      setOrientation("vertical");
    });

    expect(updates[0]?.orientation).toBe("vertical");
    expect(updates[0]?.layout?.width).toBe("6px");
    expect(updates[0]?.layout?.height).toBe("50%");
  });

  it("moves a lone explicit width to height when switching orientation", async () => {
    await act(async () => {
      mount(
        dividerElement({
          layout: { width: "50%" },
        }),
      );
    });

    await act(async () => {
      setOrientation("vertical");
    });

    expect(updates[0]?.orientation).toBe("vertical");
    expect(updates[0]?.layout?.width).toBeUndefined();
    expect(updates[0]?.layout?.height).toBe("50%");
  });

  it("moves a lone explicit height to width when switching orientation", async () => {
    await act(async () => {
      mount(
        dividerElement({
          layout: { height: "6px" },
        }),
      );
    });

    await act(async () => {
      setOrientation("vertical");
    });

    expect(updates[0]?.orientation).toBe("vertical");
    expect(updates[0]?.layout?.width).toBe("6px");
    expect(updates[0]?.layout?.height).toBeUndefined();
  });

  it("writes an explicit width edit to layout.width", async () => {
    await act(async () => {
      mount(dividerElement());
    });

    await act(async () => {
      setNumberInputValue(widthInput(), "40");
    });

    expect(updates).toHaveLength(1);
    expect(updates[0]?.layout?.width).toBe("40%");
  });

  it("writes an explicit height edit to layout.height", async () => {
    await act(async () => {
      mount(dividerElement());
    });

    await act(async () => {
      setNumberInputValue(heightInput(), "4");
    });

    expect(updates).toHaveLength(1);
    expect(updates[0]?.layout?.height).toBe(4);
  });

  it("writes appearance updates to the canonical visual style, not a Divider field", async () => {
    await act(async () => {
      mount(dividerElement());
    });

    const backgroundInput = container.querySelector<HTMLInputElement>(
      "#divider-background-value",
    );
    if (!backgroundInput) {
      throw new Error("divider-background-value input not found");
    }

    await act(async () => {
      const setter = Object.getOwnPropertyDescriptor(
        HTMLInputElement.prototype,
        "value",
      )?.set;
      if (!setter) {
        throw new Error("Unable to set input value");
      }
      setter.call(backgroundInput, "#22d3ee");
      backgroundInput.dispatchEvent(
        new Event("input", { bubbles: true }),
      );
    });

    expect(updates).toHaveLength(1);
    expect(updates[0]?.style?.background?.color).toBe("#22d3ee");
    expect(updates[0]?.orientation).toBe("horizontal");
  });

  it("displays authored background and clears only the canonical background", async () => {
    await act(async () => {
      mount(dividerElement({
        style: {
          background: { color: "#123456" },
          borderRadius: 8,
          className: "preserve-me",
        },
      }));
    });

    expect(container.querySelector<HTMLInputElement>("#divider-background-value")?.value).toBe("#123456");
    const clear = container.querySelector<HTMLInputElement>("#divider-background")?.parentElement?.parentElement?.querySelector<HTMLButtonElement>("button");
    expect(clear).toBeDefined();

    await act(async () => clear?.click());

    expect(updates[0]?.style?.background).toBeUndefined();
    expect(updates[0]?.style?.borderRadius).toBe(8);
    expect(updates[0]?.style?.className).toBe("preserve-me");
  });

  it("uses the effective radius baseline without persisting it", async () => {
    await act(async () => mount(dividerElement()));

    expect(radiusInput().value).toBe("0");
    expect(updates).toHaveLength(0);

    await act(async () => setNumberInputValue(radiusInput(), "6"));
    expect(updates[0]?.style?.borderRadius).toBe(6);

    await act(async () => setNumberInputValue(radiusInput(), ""));
    expect(updates.at(-1)?.style?.borderRadius).toBeUndefined();
  });

  it("keeps opacity in effect with the established percent UI", async () => {
    await act(async () => mount(dividerElement()));

    expect(container.textContent).toContain("Opacity");
    expect(container.querySelector("#divider-opacity")?.parentElement?.textContent).toContain("%");
    expect(opacityInput().closest("label")?.querySelector("span")?.getAttribute("title")).toContain("transparency");

    await act(async () => setNumberInputValue(opacityInput(), "50"));
    expect(updates[0]?.effect?.opacity).toBe(0.5);
    expect("opacity" in (updates[0]?.style ?? {})).toBe(false);

    await act(async () => setNumberInputValue(opacityInput(), ""));
    expect(updates.at(-1)?.effect?.opacity).toBeUndefined();
  });
});

describe("ElementInspector dispatcher for Divider", () => {
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

  it("renders the DividerInspector for a selected Divider", async () => {
    const element: PowerShowElement = dividerElement();
    const parent: ContainerElement | null = null;

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
            parent={parent}
            layerControls={null}
            topicsAuthoringControls={TOPICS_AUTHORING_CONTROLS}
            blocksAuthoringControls={BLOCKS_AUTHORING_CONTROLS}
            tableAuthoringControls={TABLE_AUTHORING_CONTROLS}
          />
        </StudioI18nProvider>,
      );
    });

    const orientationSelect = container.querySelector<HTMLSelectElement>(
      "#divider-orientation",
    );
    const widthInput = container.querySelector<HTMLInputElement>(
      "#divider-width",
    );

    expect(orientationSelect).not.toBeNull();
    expect(widthInput).not.toBeNull();
    expect(orientationSelect?.value).toBe("horizontal");
  });
});
