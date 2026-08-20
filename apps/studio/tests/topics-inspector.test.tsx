// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type {
  PowerShowElement,
  TopicItem,
  TopicsElement,
} from "@powershow/document-schema";

import { StudioI18nProvider } from "../src/features/i18n/studio-i18n-context";
import { TopicsInspector } from "../src/features/editor/inspector/topics-inspector";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

function topicsElement(
  overrides: Partial<Omit<TopicsElement, "type">> = {},
): TopicsElement {
  return {
    type: "topics",
    id: "topics-1",
    hidden: false,
    kind: "unordered",
    items: [
      {
        id: "topic-a",
        content: {
          id: "slot-a",
          children: [
            {
              type: "text",
              id: "topic-a-text",
              hidden: false,
              variant: "body",
              content: "First topic",
            },
          ],
        },
        children: [
          {
            id: "topic-a-child",
            content: {
              id: "slot-a-child",
              children: [
                {
                  type: "text",
                  id: "topic-a-child-text",
                  hidden: false,
                  variant: "body",
                  content: "First child",
                },
              ],
            },
            children: [],
          },
        ],
      },
      {
        id: "topic-b",
        content: {
          id: "slot-b",
          children: [
            {
              type: "text",
              id: "topic-b-text",
              hidden: false,
              variant: "body",
              content: "Second topic",
            },
          ],
        },
        children: [],
      },
    ],
    ...overrides,
  };
}

describe("TopicsInspector", () => {
  let container: HTMLDivElement;
  let root: Root;
  let elementState: TopicsElement;
  let updates: TopicsElement[];
  let addTopLevelTopic: ReturnType<typeof vi.fn>;
  let addChildTopic: ReturnType<typeof vi.fn>;
  let fontResourceControls: {
    fontResources: [];
    onAddFontFace: ReturnType<typeof vi.fn>;
    onRemoveFontFace: ReturnType<typeof vi.fn>;
    isFontFamilyInUse: ReturnType<typeof vi.fn>;
  };

  function renderInspector() {
    root.render(
      <StudioI18nProvider>
        <TopicsInspector
          element={elementState}
          onUpdate={(update) => {
            const next = update(elementState);
            if (next.type !== "topics") {
              return;
            }
            elementState = next;
            updates.push(elementState);
            renderInspector();
          }}
          topicsAuthoringControls={{
            onAddTopLevelTopic: addTopLevelTopic,
            onAddChildTopic: addChildTopic,
          }}
          fontResourceControls={fontResourceControls}
        />
      </StudioI18nProvider>,
    );
  }

  function mount(initial: TopicsElement) {
    elementState = initial;
    updates = [];
    addTopLevelTopic = vi.fn(() => "topic-created");
    addChildTopic = vi.fn(() => "child-topic-created");
    fontResourceControls = {
      fontResources: [],
      onAddFontFace: vi.fn(),
      onRemoveFontFace: vi.fn(),
      isFontFamilyInUse: vi.fn(() => false),
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

  function kindSelect(): HTMLSelectElement {
    const select = container.querySelector<HTMLSelectElement>("#topics-kind");
    if (!select) {
      throw new Error("topics-kind select not found");
    }
    return select;
  }

  function topicTextInputs(): HTMLInputElement[] {
    return Array.from(
      container.querySelectorAll<HTMLInputElement>(
        'input[data-powershow-topic-input="true"]',
      ),
    );
  }

  function topicSpacingInput(): HTMLInputElement {
    const input = container.querySelector<HTMLInputElement>("#topics-item-gap");
    if (!input) {
      throw new Error("topics-item-gap input not found");
    }
    return input;
  }

  function topicRow(topicItemId: string): HTMLLIElement {
    const row = container.querySelector<HTMLLIElement>(
      `li[data-powershow-topic-item-id="${topicItemId}"]`,
    );

    if (!row) {
      throw new Error(`Topic row not found: ${topicItemId}`);
    }

    return row;
  }

  function topicInput(topicItemId: string): HTMLInputElement | null {
    return topicRow(topicItemId).querySelector<HTMLInputElement>(
      'input[data-powershow-topic-input="true"]',
    );
  }

  function topicContentState(topicItemId: string): HTMLElement {
    const row = topicRow(topicItemId);
    const state = row.querySelector<HTMLElement>(
      "[data-powershow-topic-content-state]",
    );

    if (!state) {
      throw new Error(`Topic content state not found: ${topicItemId}`);
    }

    return state;
  }

  function topicContentSummary(topicItemId: string): HTMLElement | null {
    return topicRow(topicItemId).querySelector<HTMLElement>(
      '[data-powershow-topic-content-summary="true"]',
    );
  }

  function setTextInputValue(input: HTMLInputElement, value: string) {
    const setter = Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      "value",
    )?.set;

    if (!setter) {
      throw new Error("Unable to set input value");
    }

    setter.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  }

  function setNumberInputValue(input: HTMLInputElement, value: string) {
    const setter = Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      "value",
    )?.set;

    if (!setter) {
      throw new Error("Unable to set number input value");
    }

    setter.call(input, value);
    input.dispatchEvent(new Event("change", { bubbles: true }));
  }

  function rootMarkerStyleSelect(): HTMLSelectElement {
    const select = container.querySelector<HTMLSelectElement>(
      "#topics-marker-style",
    );

    if (!select) {
      throw new Error("topics-marker-style select not found");
    }

    return select;
  }

  function rootMarkerStyleValues(): string[] {
    return Array.from(rootMarkerStyleSelect().options).map(
      (option) => option.value,
    );
  }

  function text(id: string, content = id): PowerShowElement {
    return {
      type: "text",
      id,
      hidden: false,
      variant: "body",
      content,
    };
  }

  function image(id: string): PowerShowElement {
    return {
      type: "image",
      id,
      hidden: false,
      src: `/assets/${id}.png`,
      alt: id,
      fit: "contain",
    };
  }

  function table(id: string): PowerShowElement {
    return {
      type: "table",
      id,
      hidden: false,
      columns: [{ key: "value", label: "Value" }],
      rows: [{ value: id }],
    };
  }

  function containerElement(
    id: string,
    children: PowerShowElement[] = [],
  ): PowerShowElement {
    return {
      type: "container",
      id,
      hidden: false,
      direction: "column",
      children,
    };
  }

  function topicItem(
    id: string,
    contentChildren: PowerShowElement[],
    children: TopicItem[] = [],
  ): TopicItem {
    return {
      id,
      content: {
        id: `slot-${id}`,
        children: contentChildren,
      },
      children,
    };
  }

  it("mounting the inspector performs no document write", async () => {
    await act(async () => {
      mount(topicsElement());
    });

    expect(updates).toHaveLength(0);
  });

  it("displays the unordered state", async () => {
    await act(async () => {
      mount(topicsElement());
    });

    expect(kindSelect().value).toBe("unordered");
  });

  it("changes unordered to ordered through onUpdate", async () => {
    await act(async () => {
      mount(topicsElement());
    });

    await act(async () => {
      kindSelect().value = "ordered";
      kindSelect().dispatchEvent(new Event("change", { bubbles: true }));
    });

    expect(updates).toHaveLength(1);
    expect(updates[0]?.kind).toBe("ordered");
    expect(updates[0]?.items).toHaveLength(2);
  });

  it("renders the recursive topic inputs", async () => {
    await act(async () => {
      mount(topicsElement());
    });

    const inputs = topicTextInputs();
    expect(inputs).toHaveLength(3);
    expect(inputs.map((input) => input.value)).toEqual([
      "First topic",
      "First child",
      "Second topic",
    ]);
    expect(container.textContent ?? "").toContain("Topics: 2");
  });

  it("keeps editable text and adds a non-text summary when content is mixed", async () => {
    await act(async () => {
      mount(
        topicsElement({
          items: [
            topicItem("topic-a", [
              text("topic-a-text", "Alpha"),
              image("topic-a-image"),
              table("topic-a-table"),
            ]),
          ],
        }),
      );
    });

    expect(topicInput("topic-a")).not.toBeNull();
    expect(topicInput("topic-a")?.value).toBe("Alpha");
    expect(topicContentSummary("topic-a")?.textContent).toBe(
      "Image · Table",
    );
  });

  it("shows read-only descriptors when a topic has no direct text child", async () => {
    await act(async () => {
      mount(
        topicsElement({
          items: [
            topicItem("topic-image", [image("topic-image-image")]),
            topicItem("topic-table", [table("topic-table-table")]),
            topicItem("topic-container", [
              containerElement("topic-container-child"),
            ]),
            topicItem("topic-mixed", [
              image("topic-mixed-image"),
              table("topic-mixed-table"),
            ]),
          ],
        }),
      );
    });

    expect(topicInput("topic-image")).toBeNull();
    expect(topicContentState("topic-image").textContent).toBe("Image");

    expect(topicInput("topic-table")).toBeNull();
    expect(topicContentState("topic-table").textContent).toBe("Table");

    expect(topicInput("topic-container")).toBeNull();
    expect(topicContentState("topic-container").textContent).toBe("Container");

    expect(topicInput("topic-mixed")).toBeNull();
    expect(topicContentState("topic-mixed").textContent).toBe("Image · Table");
  });

  it("shows an explicit empty topic state for an empty content slot", async () => {
    await act(async () => {
      mount(
        topicsElement({
          items: [topicItem("topic-empty", [])],
        }),
      );
    });

    expect(topicInput("topic-empty")).toBeNull();
    expect(topicContentState("topic-empty").textContent).toBe("Empty topic");
  });

  it("keeps add and remove controls available for non-text topics", async () => {
    await act(async () => {
      mount(
        topicsElement({
          items: [topicItem("topic-image", [image("topic-image-image")])],
        }),
      );
    });

    const addButton = topicRow("topic-image").querySelector<HTMLButtonElement>(
      'button[data-powershow-topic-add-child="true"]',
    );
    const removeButton = topicRow("topic-image").querySelector<HTMLButtonElement>(
      'button[data-powershow-topic-remove="true"]',
    );

    expect(addButton).not.toBeNull();
    expect(removeButton).not.toBeNull();
    expect(addButton?.disabled).toBe(false);
    expect(removeButton?.disabled).toBe(false);
  });

  it("renders the same descriptor recursively for image-only subtopics", async () => {
    await act(async () => {
      mount(
        topicsElement({
          items: [
            topicItem(
              "topic-parent",
              [text("topic-parent-text", "Parent")],
              [topicItem("topic-child", [image("topic-child-image")])],
            ),
          ],
        }),
      );
    });

    expect(topicInput("topic-parent")?.value).toBe("Parent");
    expect(topicContentState("topic-child").textContent).toBe("Image");
  });

  it("edits the canonical text content for a topic item", async () => {
    await act(async () => {
      mount(topicsElement());
    });

    const inputs = topicTextInputs();

    await act(async () => {
      setTextInputValue(inputs[0]!, "Updated topic");
    });

    expect(updates).toHaveLength(1);
    expect(updates[0]?.items[0]?.content.children[0]).toMatchObject({
      type: "text",
      content: "Updated topic",
    });
    expect(updates[0]?.items[1]).toBe(elementState.items[1]);
  });

  it("edits a nested child topic without touching sibling references", async () => {
    await act(async () => {
      mount(topicsElement());
    });

    const inputs = topicTextInputs();

    await act(async () => {
      setTextInputValue(inputs[1]!, "Updated child");
    });

    expect(updates).toHaveLength(1);
    expect(
      updates[0]?.items[0]?.children[0]?.content.children[0],
    ).toMatchObject({
      type: "text",
      content: "Updated child",
    });
    expect(updates[0]?.items[1]).toBe(elementState.items[1]);
  });

  it("text color updates TopicsElement.style only", async () => {
    await act(async () => {
      mount(topicsElement());
    });

    const firstItem = elementState.items[0];
    const firstChildText = firstItem?.content.children[0];
    const input = container.querySelector<HTMLInputElement>(
      "#topics-text-color-value",
    );

    if (!input) {
      throw new Error("topics-text-color-value input not found");
    }

    await act(async () => {
      setTextInputValue(input, "#ffffff");
    });

    expect(updates).toHaveLength(1);
    expect(updates[0]?.style?.color).toBe("#ffffff");
    expect(updates[0]?.items[0]).toBe(firstItem);
    expect(updates[0]?.items[0]?.content.children[0]).toBe(firstChildText);
  });

  it("font size updates TopicsElement.style only", async () => {
    await act(async () => {
      mount(topicsElement());
    });

    const unitSelect = container.querySelector<HTMLSelectElement>(
      "#topics-font-size-unit",
    );
    const input =
      container.querySelector<HTMLInputElement>("#topics-font-size");

    if (!unitSelect || !input) {
      throw new Error("topics font size controls not found");
    }

    await act(async () => {
      unitSelect.value = "px";
      unitSelect.dispatchEvent(new Event("change", { bubbles: true }));
      setNumberInputValue(input, "24");
    });

    expect(updates).toHaveLength(1);
    expect(updates[0]?.style?.fontSize).toBe(24);
    expect(updates[0]?.items[0]).toBe(elementState.items[0]);
  });

  it("decoration line updates TopicsElement.style only", async () => {
    await act(async () => {
      mount(topicsElement());
    });

    const select = container.querySelector<HTMLSelectElement>(
      "#topics-text-decoration-line",
    );

    if (!select) {
      throw new Error("topics-text-decoration-line select not found");
    }

    await act(async () => {
      select.value = "underline";
      select.dispatchEvent(new Event("change", { bubbles: true }));
    });

    expect(updates).toHaveLength(1);
    expect(updates[0]?.style?.textDecorationLine).toBe("underline");
    expect(updates[0]?.items[0]).toBe(elementState.items[0]);
  });

  it("decoration color updates TopicsElement.style only", async () => {
    await act(async () => {
      mount(topicsElement());
    });

    const input = container.querySelector<HTMLInputElement>(
      "#topics-decoration-color-value",
    );

    if (!input) {
      throw new Error("topics-decoration-color-value input not found");
    }

    await act(async () => {
      setTextInputValue(input, "#22d3ee");
    });

    expect(updates).toHaveLength(1);
    expect(updates[0]?.style?.textDecorationColor).toBe("#22d3ee");
    expect(updates[0]?.items[0]).toBe(elementState.items[0]);
  });

  it("starts topic spacing from the effective default when undefined", async () => {
    await act(async () => {
      mount(topicsElement({ itemGap: undefined }));
    });

    expect(topicSpacingInput().value).toBe("6");
    expect(updates).toHaveLength(0);
  });

  it("persists an explicit topic spacing edit", async () => {
    await act(async () => {
      mount(topicsElement({ itemGap: undefined }));
    });

    await act(async () => {
      setNumberInputValue(topicSpacingInput(), "12");
    });

    expect(updates).toHaveLength(1);
    expect(updates[0]?.itemGap).toBe(12);
  });

  it("supports zero topic spacing", async () => {
    await act(async () => {
      mount(topicsElement({ itemGap: 12 }));
    });

    const input = topicSpacingInput();

    await act(async () => {
      const setter = Object.getOwnPropertyDescriptor(
        HTMLInputElement.prototype,
        "value",
      )?.set;

      if (!setter) {
        throw new Error("Unable to set number input value");
      }

      setter.call(input, "0");

      input.dispatchEvent(
        new InputEvent("input", {
          bubbles: true,
          inputType: "insertText",
          data: "0",
        }),
      );

      input.dispatchEvent(new Event("change", { bubbles: true }));
    });

    expect(updates).toHaveLength(1);
    expect(updates[0]?.itemGap).toBe(0);
  });

  it("restores the theme default topic spacing when reset", async () => {
    await act(async () => {
      mount(topicsElement({ itemGap: 12 }));
    });

    const resetButton =
      topicSpacingInput().parentElement?.parentElement?.querySelector<HTMLButtonElement>(
        "button[title='Use theme default']",
      );

    expect(resetButton).toBeDefined();

    await act(async () => {
      resetButton?.click();
    });

    expect(updates).toHaveLength(1);
    expect(updates[0]?.itemGap).toBeUndefined();
  });

  it("Add Topic invokes the structural callback with the selected Topics id", async () => {
    await act(async () => {
      mount(topicsElement());
    });

    const button = Array.from(container.querySelectorAll("button")).find((b) =>
      b.textContent?.includes("Add topic"),
    );

    expect(button).toBeDefined();

    await act(async () => {
      button?.click();
    });

    expect(addTopLevelTopic).toHaveBeenCalledTimes(1);
    expect(addTopLevelTopic).toHaveBeenCalledWith("topics-1");
  });

  it("Add subtopic targets the clicked TopicItem id", async () => {
    await act(async () => {
      mount(topicsElement());
    });

    const buttons = Array.from(
      container.querySelectorAll<HTMLButtonElement>(
        'button[data-powershow-topic-add-child="true"]',
      ),
    );

    expect(buttons).toHaveLength(3);

    await act(async () => {
      buttons[0]?.click();
    });

    expect(addChildTopic).toHaveBeenCalledTimes(1);
    expect(addChildTopic).toHaveBeenCalledWith("topics-1", "topic-a");
  });

  it("Remove targets the clicked TopicItem id", async () => {
    await act(async () => {
      mount(topicsElement());
    });

    const buttons = Array.from(
      container.querySelectorAll<HTMLButtonElement>(
        'button[data-powershow-topic-remove="true"]',
      ),
    );

    expect(buttons).toHaveLength(3);

    await act(async () => {
      buttons[1]?.click();
    });

    expect(updates).toHaveLength(1);
    expect(updates[0]?.items).toHaveLength(2);
    expect(updates[0]?.items[0]?.id).toBe("topic-a");
    expect(updates[0]?.items[0]?.children).toHaveLength(0);
    expect(updates[0]?.items[1]?.id).toBe("topic-b");
  });

  it("shows only unordered marker styles for a bulleted list", async () => {
    await act(async () => {
      mount(topicsElement({ kind: "unordered" }));
    });

    expect(rootMarkerStyleValues()).toEqual([
      "",
      "disc",
      "circle",
      "square",
      "none",
    ]);
  });

  it("shows only ordered marker styles for a numbered list", async () => {
  await act(async () => {
    mount(topicsElement({ kind: "ordered" }));
  });

  expect(rootMarkerStyleValues()).toEqual([
    "",
    "decimal",
    "lower-alpha",
    "upper-alpha",
    "lower-roman",
    "upper-roman",
    "none",
  ]);
});

it("does not persist a root marker style when mounting with the default", async () => {
  await act(async () => {
    mount(topicsElement({ rootMarkerStyle: undefined }));
  });

  expect(rootMarkerStyleSelect().value).toBe("");
  expect(updates).toHaveLength(0);
});

it("updates the explicit root marker style", async () => {
  await act(async () => {
    mount(topicsElement({ kind: "unordered" }));
  });

  await act(async () => {
    rootMarkerStyleSelect().value = "circle";
    rootMarkerStyleSelect().dispatchEvent(
      new Event("change", { bubbles: true }),
    );
  });

  expect(updates).toHaveLength(1);
  expect(updates[0]?.rootMarkerStyle).toBe("circle");
});

it("preserves none when switching list kind", async () => {
  await act(async () => {
    mount(
      topicsElement({
        kind: "unordered",
        rootMarkerStyle: "none",
      }),
    );
  });

  const kindSelect =
    container.querySelector<HTMLSelectElement>("#topics-kind");

  if (!kindSelect) {
    throw new Error("topics-kind select not found");
  }

  await act(async () => {
    kindSelect.value = "ordered";
    kindSelect.dispatchEvent(new Event("change", { bubbles: true }));
  });

  expect(updates[0]?.kind).toBe("ordered");
  expect(updates[0]?.rootMarkerStyle).toBe("none");
});

it("normalizes an explicit unordered marker when switching to ordered", async () => {
  await act(async () => {
    mount(
      topicsElement({
        kind: "unordered",
        rootMarkerStyle: "circle",
      }),
    );
  });

  const kindSelect =
    container.querySelector<HTMLSelectElement>("#topics-kind");

  if (!kindSelect) {
    throw new Error("topics-kind select not found");
  }

  await act(async () => {
    kindSelect.value = "ordered";
    kindSelect.dispatchEvent(new Event("change", { bubbles: true }));
  });

  expect(updates[0]?.rootMarkerStyle).toBe("decimal");
});
it("normalizes an explicit ordered marker when switching to unordered", async () => {
  await act(async () => {
    mount(
      topicsElement({
        kind: "ordered",
        rootMarkerStyle: "lower-alpha",
      }),
    );
  });

  const kindSelect =
    container.querySelector<HTMLSelectElement>("#topics-kind");

  if (!kindSelect) {
    throw new Error("topics-kind select not found");
  }

  await act(async () => {
    kindSelect.value = "unordered";
    kindSelect.dispatchEvent(new Event("change", { bubbles: true }));
  });

  expect(updates[0]?.rootMarkerStyle).toBe("disc");
});

it("updates marker color independently from topic text color", async () => {
  await act(async () => {
    mount(topicsElement());
  });

  const input =
    container.querySelector<HTMLInputElement>(
      "#topics-marker-color-value",
    );

  if (!input) {
    throw new Error("topics-marker-color-value input not found");
  }

  await act(async () => {
    setTextInputValue(input, "#22d3ee");
  });

  expect(updates).toHaveLength(1);
  expect(updates[0]?.markerColor).toBe("#22d3ee");
  expect(updates[0]?.style?.color).toBeUndefined();
});

it("places topic content rows before list type and typography controls", async () => {
  await act(async () => {
    mount(topicsElement());
  });

  function isBefore(a: Element, b: Element): boolean {
    return (
      (a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0
    );
  }

  const firstTopicInput = container.querySelector<HTMLInputElement>(
    'input[data-powershow-topic-input="true"]',
  );
  const addTopicButton = Array.from(container.querySelectorAll("button")).find(
    (button) => button.textContent?.includes("Add topic"),
  );
  const kindSelect = container.querySelector<HTMLSelectElement>("#topics-kind");
  const fontSizeInput =
    container.querySelector<HTMLInputElement>("#topics-font-size");
  const markerSelect = container.querySelector<HTMLSelectElement>(
    "#topics-marker-style",
  );

  expect(firstTopicInput).toBeDefined();
  expect(addTopicButton).toBeDefined();
  expect(kindSelect).toBeDefined();
  expect(topicSpacingInput()).toBeDefined();

  expect(isBefore(firstTopicInput!, kindSelect!)).toBe(true);
  expect(isBefore(addTopicButton!, kindSelect!)).toBe(true);
  expect(isBefore(firstTopicInput!, fontSizeInput!)).toBe(true);
  expect(isBefore(firstTopicInput!, markerSelect!)).toBe(true);
});

it("does not render the body/title/subtitle/caption apply style control", async () => {
  await act(async () => {
    mount(topicsElement());
  });

  expect(container.querySelector("#text-variant")).toBeNull();

  const variantOption = Array.from(container.querySelectorAll("option")).find(
    (option) =>
      option.value === "body" ||
      option.value === "title" ||
      option.value === "subtitle" ||
      option.value === "caption",
  );

  expect(variantOption).toBeUndefined();
});

function structuralTopicChain(
  levels: number,
): TopicsElement["items"] {
  let items: TopicsElement["items"] = [];

  for (let level = levels; level >= 1; level -= 1) {
    items = [
      {
        id: `topic-level-${level}`,
        content: {
          id: `slot-level-${level}`,
          children: [
            {
              type: "text",
              id: `text-level-${level}`,
              hidden: false,
              variant: "body",
              content: `Level ${level}`,
            },
          ],
        },
        children: items,
      },
    ];
  }

  return items;
}

function addChildButtons(): HTMLButtonElement[] {
  return Array.from(
    container.querySelectorAll<HTMLButtonElement>(
      'button[data-powershow-topic-add-child="true"]',
    ),
  );
}

it("keeps Add subtopic available at structural depth 1 through 4", async () => {
  await act(async () => {
    mount(topicsElement({ items: structuralTopicChain(5) }));
  });

  const buttons = addChildButtons();

  expect(buttons).toHaveLength(5);
  expect(buttons.slice(0, 4).every((button) => !button.disabled)).toBe(true);
});

it("disables Add subtopic at structural depth 5", async () => {
  await act(async () => {
    mount(topicsElement({ items: structuralTopicChain(5) }));
  });

  const depth5Button = addChildButtons()[4];

  expect(depth5Button?.disabled).toBe(true);

  await act(async () => {
    depth5Button?.click();
  });

  expect(addChildTopic).not.toHaveBeenCalled();
});

it("keeps editing and removing a depth-5 topic intact", async () => {
  await act(async () => {
    mount(topicsElement({ items: structuralTopicChain(5) }));
  });

  const inputs = topicTextInputs();
  expect(inputs).toHaveLength(5);

  await act(async () => {
    setTextInputValue(inputs[4]!, "Updated deep topic");
  });

  expect(updates).toHaveLength(1);
  expect(
    updates[0]?.items[0]?.children[0]?.children[0]?.children[0]?.children[0]
      ?.content.children[0],
  ).toMatchObject({ type: "text", content: "Updated deep topic" });

  const removeButtons = Array.from(
    container.querySelectorAll<HTMLButtonElement>(
      'button[data-powershow-topic-remove="true"]',
    ),
  );

  await act(async () => {
    removeButtons[4]?.click();
  });

  expect(updates).toHaveLength(2);
  expect(
    updates[1]?.items[0]?.children[0]?.children[0]?.children[0]?.children,
  ).toEqual([]);
});
});
