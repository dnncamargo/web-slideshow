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

import { BlocksItemEditor } from "../src/features/editor/inspector/blocks-item-editor";
import type { BlocksItemEditorLabels } from "../src/features/editor/inspector/blocks-item-editor-types";
import type { BlocksAuthoringControls } from "../src/features/editor/inspector/inspector-types";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

// ============================================================
// FIXTURES
// ============================================================

const colorKey = (id: string): string => id;

const colorFor = (key: string): string =>
  key === "cat-b" ? "#654321" : "#123456";

const textPart = (id: string, text = id): BlockPart => ({
  id,
  type: "text",
  text,
});

const socketEmptyPart = (id: string): BlockPart => ({
  id,
  type: "socket",
  content: { type: "empty" },
});

const socketLiteralPart = (id: string, value: string): BlockPart => ({
  id,
  type: "socket",
  content: { type: "literal", value },
});

const socketBlockPart = (id: string, block: BlockItem): BlockPart => ({
  id,
  type: "socket",
  content: { type: "block", block },
});

const value = (
  id: string,
  color: string,
  parts: BlockPart[] = [],
): BlockItem => ({
  id,
  color: colorFor(color),
  shape: "value",
  parts,
  children: [],
});

const logic = (
  id: string,
  color: string,
  parts: BlockPart[] = [],
): BlockItem => ({
  id,
  color: colorFor(color),
  shape: "logic",
  parts,
  children: [],
});

const statement = (
  id: string,
  color: string,
  parts: BlockPart[] = [],
  children: BlockItem[] = [],
): BlockItem => ({
  id,
  color: colorFor(color),
  shape: "statement",
  parts,
  children,
});

const scope = (
  id: string,
  color: string,
  parts: BlockPart[] = [],
  children: BlockItem[] = [],
): BlockItem => ({
  id,
  color: colorFor(color),
  shape: "scope",
  parts,
  children,
});

const blocks = (
  _colorKeys: string[],
  items: BlockItem[],
): BlocksElement => ({
  id: "blocks-1",
  type: "blocks",
  hidden: false,
  items,
});

/** A chain of nested scopes: scope-1 at depth 1 ... scope-<depth> at depth <depth>. */
function deepScopeChain(depth: number): BlockItem[] {
  let items: BlockItem[] = [];

  for (let level = depth; level >= 1; level -= 1) {
    items = [scope(`scope-${level}`, "cat", [textPart(`p-${level}`)], items)];
  }

  return items;
}

/** Deep scope chain where every scope also carries an empty socket part. */
function deepScopeChainWithSockets(depth: number): BlockItem[] {
  let items: BlockItem[] = [];

  for (let level = depth; level >= 1; level -= 1) {
    items = [
      scope(
        `scope-${level}`,
        "cat",
        [textPart(`p-${level}`), socketEmptyPart(`sock-${level}`)],
        items,
      ),
    ];
  }

  return items;
}

// ============================================================
// LABELS (English fixture contract)
// ============================================================

const LABELS: BlocksItemEditorLabels = {
  color: "Block color",
  shape: "Shape",
  statement: "Statement",
  start: "Start",
  scope: "Scope",
  end: "End",
  value: "Value",
  logic: "Logic",
  moveEarlier: "Move earlier",
  moveLater: "Move later",
  remove: "Remove",
  addTextPart: "Add text part",
  addSocketPart: "Add socket part",
  addChild: "Add child",
  addChildAtMaxDepth: "Maximum block depth reached",
  socketContent: "Content",
  socketEmpty: "Empty",
  socketLiteral: "Literal",
  socketValue: "Value",
  socketLogic: "Logic",
  literalValue: "Literal value",
  valueAtMaxDepth: "Maximum block depth reached",
  textPartLabel: "Block text",
  content: "Content",
  inside: "Inside",
};

// ============================================================
// HARNESS
// ============================================================

describe("BlocksItemEditor", () => {
  let container: HTMLDivElement;
  let root: Root;
  let elementState: BlocksElement;
  let updates: BlocksElement[];
  let controls: BlocksAuthoringControls;

  function renderEditor() {
    root.render(
      <BlocksItemEditor
        element={elementState}
        onUpdate={(update) => {
          const next = update(elementState);
          if (next.type !== "blocks") {
            return;
          }
          elementState = next;
          updates.push(elementState);
          renderEditor();
        }}
        blocksAuthoringControls={controls}
        labels={LABELS}
      />,
    );
  }

  function mount(initial: BlocksElement) {
    elementState = initial;
    updates = [];
    controls = {
      onAddRootBlock: vi.fn(() => null),
      onAddScopeChild: vi.fn(() => null),
      onAddTextPart: vi.fn(() => null),
      onAddSocketPart: vi.fn(() => null),
      onCreateSocketValue: vi.fn(() => null),
    };
    act(() => {
      renderEditor();
    });
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

  function changeSelect(select: HTMLSelectElement | null, value: string) {
    if (!select) throw new Error("Expected select not found");
    act(() => {
      select.value = value;
      select.dispatchEvent(new Event("change", { bubbles: true }));
    });
  }

  function changeTextInput(input: HTMLInputElement, value: string) {
    const setter = Object.getOwnPropertyDescriptor(
      window.HTMLInputElement.prototype,
      "value",
    )?.set;
    act(() => {
      setter?.call(input, value);
      input.dispatchEvent(new Event("input", { bubbles: true }));
    });
  }

  function click(button: HTMLButtonElement | null) {
    if (!button) {
      throw new Error("Expected button not found");
    }
    act(() => {
      button.click();
    });
  }

  const row = (id: string): HTMLLIElement | null =>
    container.querySelector(`[data-powershow-block-item-id="${id}"]`);

  // The row's own header line: nested scope/value rows live inside the
  // row element, so unscoped queries could match a descendant instead.
  const rowLine = (id: string): HTMLDivElement | null =>
    row(id)?.querySelector(":scope > div") ?? null;

  const colorInput = (id: string): HTMLInputElement | null =>
    rowLine(id)?.querySelector('[data-powershow-block-color="true"]') ??
    null;

  const shapeSelect = (id: string): HTMLSelectElement | null =>
    rowLine(id)?.querySelector('[data-powershow-block-shape="true"]') ?? null;

  const moveUpButton = (id: string): HTMLButtonElement | null =>
    rowLine(id)?.querySelector('[data-powershow-block-move-up="true"]') ??
    null;

  const moveDownButton = (id: string): HTMLButtonElement | null =>
    rowLine(id)?.querySelector('[data-powershow-block-move-down="true"]') ??
    null;

  const removeBlockButton = (id: string): HTMLButtonElement | null =>
    rowLine(id)?.querySelector('[data-powershow-block-remove="true"]') ??
    null;

  const addChildButton = (id: string): HTMLButtonElement | null =>
    row(id)?.querySelector(
      ':scope > [data-powershow-block-add-child="true"]',
    ) ?? null;

  const addTextPartButton = (id: string): HTMLButtonElement | null =>
    row(id)?.querySelector(
      ':scope > [data-powershow-block-add-part-actions="true"] > [data-powershow-block-add-part-text="true"]',
    ) ?? null;

  const addSocketPartButton = (id: string): HTMLButtonElement | null =>
    row(id)?.querySelector(
      ':scope > [data-powershow-block-add-part-actions="true"] > [data-powershow-block-add-part-socket="true"]',
    ) ?? null;

  const partRow = (id: string): HTMLLIElement | null =>
    container.querySelector(`[data-powershow-block-part-id="${id}"]`);

  const partLine = (id: string): HTMLDivElement | null =>
    partRow(id)?.querySelector(":scope > div") ?? null;

  const textInput = (id: string): HTMLInputElement | null =>
    row(id)?.querySelector(
      ':scope > [data-powershow-block-parts="true"] > li > div > [data-powershow-part-text="true"]',
    ) ?? null;

  const partMoveUpButton = (id: string): HTMLButtonElement | null =>
    partLine(id)?.querySelector('[data-powershow-part-move-up="true"]') ??
    null;

  const partMoveDownButton = (id: string): HTMLButtonElement | null =>
    partLine(id)?.querySelector('[data-powershow-part-move-down="true"]') ??
    null;

  const partRemoveButton = (id: string): HTMLButtonElement | null =>
    partLine(id)?.querySelector('[data-powershow-part-remove="true"]') ??
    null;

  const socketModeSelect = (id: string): HTMLSelectElement | null =>
    partLine(id)?.querySelector('[data-powershow-part-socket-mode="true"]') ??
    null;

  const literalInput = (id: string): HTMLInputElement | null =>
    partRow(id)?.querySelector(
      '[data-powershow-part-socket-literal-input="true"]',
    ) ?? null;

  function firstItem(): BlockItem | undefined {
    return elementState.items[0];
  }

  // ============================================================
  // BLOCK ITEM: COLOR / SHAPE / STACK
  // ============================================================

  it("changes the direct color of a statement block through the canonical path", () => {
    mount(
      blocks(
        [colorKey("cat-a"), colorKey("cat-b")],
        [statement("s1", "cat-a", [textPart("p1")])],
      ),
    );

    const input = colorInput("s1");
    if (!input) {
      throw new Error("Block color input not found");
    }

    changeTextInput(input, "#abcdef");

    expect(firstItem()?.color).toBe("#abcdef");
    expect(updates.length).toBeGreaterThan(0);
  });

  it("converts a statement into a scope", () => {
    mount(
      blocks(
        [colorKey("cat")],
        [statement("s1", "cat", [textPart("p1")])],
      ),
    );

    const select = shapeSelect("s1");
    if (!select) {
      throw new Error("Shape select not found");
    }

    changeSelect(select, "scope");

    expect(firstItem()?.shape).toBe("scope");
  });

  it("never lets a populated scope flatten to a statement", () => {
    mount(
      blocks(
        [colorKey("cat")],
        [scope("sc1", "cat", [textPart("p1")], [statement("c1", "cat", [])])],
      ),
    );

    const select = shapeSelect("sc1");
    if (!select) {
      throw new Error("Shape select not found");
    }

    const statementOption = select.querySelector(
      'option[value="statement"]',
    ) as HTMLOptionElement | null;
    expect(statementOption?.disabled).toBe(true);

    // Even a forced programmatic change must be refused by the canonical op.
    changeSelect(select, "statement");

    expect(firstItem()?.shape).toBe("scope");
  });

  it("exposes only statement/scope shape choices for stack rows", () => {
    mount(
      blocks(
        [colorKey("cat")],
        [scope("sc1", "cat", [], [statement("c1", "cat", [])])],
      ),
    );

    const childSelect = shapeSelect("c1");
    const options = Array.from(
      childSelect?.querySelectorAll("option") ?? [],
    ).map((option) => option.value);

    expect(options).toEqual(["start", "statement", "scope", "end"]);
  });

  it("writes Start and End stack shape selections", () => {
    mount(blocks([colorKey("cat")], [statement("s1", "cat", [])]));
    const select = shapeSelect("s1");
    if (!select) throw new Error("Shape select not found");
    changeSelect(select, "start");
    expect(firstItem()?.shape).toBe("start");
    changeSelect(shapeSelect("s1"), "end");
    expect(firstItem()?.shape).toBe("end");
    changeSelect(shapeSelect("s1"), "statement");
    expect(firstItem()?.shape).toBe("statement");
  });

  it("does not duplicate the parent reporter selector inside value and logic rows", () => {
    mount(blocks([colorKey("cat")], [statement("owner", "cat", [
      socketBlockPart("value-socket", value("v", "cat")),
      socketBlockPart("logic-socket", logic("l", "cat")),
   ])]));
    const valueSelect = shapeSelect("v");
    const logicSelect = shapeSelect("l");
    expect(valueSelect).toBeNull();
    expect(logicSelect).toBeNull();
  });

  it("preserves populated scope when Start, Statement, or End is forced", () => {
    const child = statement("child", "cat", []);
    mount(blocks([colorKey("cat")], [scope("sc", "cat", [], [child])]));
    const select = shapeSelect("sc");
    if (!select) throw new Error("Shape select not found");
    expect((select.querySelector('option[value="start"]') as HTMLOptionElement | null)?.disabled).toBe(true);
    expect((select.querySelector('option[value="statement"]') as HTMLOptionElement | null)?.disabled).toBe(true);
    expect((select.querySelector('option[value="end"]') as HTMLOptionElement | null)?.disabled).toBe(true);
    for (const shape of ["start", "statement", "end"]) {
      changeSelect(select, shape);
      expect(firstItem()?.shape).toBe("scope");
      expect(firstItem()?.children[0]).toBe(child);
    }
  });

  it("moves root blocks earlier/later and honors stack boundaries", () => {
    mount(
      blocks(
        [colorKey("cat")],
        [statement("r1", "cat", []), statement("r2", "cat", [])],
      ),
    );

    expect(moveUpButton("r1")?.disabled).toBe(true);
    expect(moveDownButton("r2")?.disabled).toBe(true);

    click(moveDownButton("r1"));

    expect(elementState.items.map((item) => item.id)).toEqual(["r2", "r1"]);
    expect(moveDownButton("r1")?.disabled).toBe(true);
    expect(moveUpButton("r2")?.disabled).toBe(true);

    click(moveUpButton("r1"));

    expect(elementState.items.map((item) => item.id)).toEqual(["r1", "r2"]);
  });

  it("removes a root block", () => {
    mount(
      blocks(
        [colorKey("cat")],
        [statement("r1", "cat", [textPart("p1")])],
      ),
    );

    click(removeBlockButton("r1"));

    expect(elementState.items).toHaveLength(0);
  });

  // ============================================================
  // PARTS: TEXT
  // ============================================================

  it("edits a text part in place", () => {
    mount(
      blocks(
        [colorKey("cat")],
        [statement("s1", "cat", [textPart("p1", "Hello")])],
      ),
    );

    const input = textInput("s1");
    if (!input) {
      throw new Error("Text part input not found");
    }

    changeTextInput(input, "Hello world");

    const part = firstItem()?.parts[0];
    expect(part?.type).toBe("text");
    if (part?.type === "text") {
      expect(part.text).toBe("Hello world");
    }
  });

  it("edits a text part with a deferred updater after the event finishes", () => {
    elementState = blocks(
      [colorKey("cat")],
      [statement("s1", "cat", [textPart("p1", "New block")])],
    );
    updates = [];
    controls = {
      onAddRootBlock: vi.fn(() => null),
      onAddScopeChild: vi.fn(() => null),
      onAddTextPart: vi.fn(() => null),
      onAddSocketPart: vi.fn(() => null),
      onCreateSocketValue: vi.fn(() => null),
    };

    let capturedUpdate:
      | ((element: PowerShowElement) => PowerShowElement)
      | undefined;
    act(() => {
      root.render(
        <BlocksItemEditor
          element={elementState}
          onUpdate={(update) => {
            capturedUpdate = update;
          }}
          blocksAuthoringControls={controls}
          labels={LABELS}
        />,
      );
    });

    const input = textInput("s1");
    if (!input) {
      throw new Error("Text part input not found");
    }

    changeTextInput(input, "Renamed block");

    expect(capturedUpdate).toBeDefined();
    expect(() => {
      const update = capturedUpdate;
      if (!update) {
        throw new Error("Deferred updater not captured");
      }
      const next = update(elementState);
      if (next.type === "blocks") {
        elementState = next;
      }
    }).not.toThrow();

    const part = firstItem()?.parts[0];
    expect(part?.type).toBe("text");
    if (part?.type === "text") {
      expect(part.text).toBe("Renamed block");
    }
  });

  it("reorders text and socket parts within a block", () => {
    mount(
      blocks(
        [colorKey("cat")],
        [statement("s1", "cat", [textPart("p1"), socketEmptyPart("s1")])],
      ),
    );

    click(partMoveDownButton("p1"));

    expect(firstItem()?.parts.map((part) => part.id)).toEqual(["s1", "p1"]);

    click(partMoveUpButton("p1"));

    expect(firstItem()?.parts.map((part) => part.id)).toEqual(["p1", "s1"]);
  });

  it("removes a part", () => {
    mount(
      blocks(
        [colorKey("cat")],
        [statement("s1", "cat", [textPart("p1"), socketEmptyPart("p1b")])],
      ),
    );

    click(partRemoveButton("p1b"));

    expect(firstItem()?.parts.map((part) => part.id)).toEqual(["p1"]);
  });

  // ============================================================
  // PARTS: ADD (CREATION DELEGATES TO CONTROLS)
  // ============================================================

  it("delegates text part creation to the controls", () => {
    mount(blocks([colorKey("cat")], [statement("s1", "cat", [])]));

    click(addTextPartButton("s1"));

    expect(controls.onAddTextPart).toHaveBeenCalledTimes(1);
    expect(controls.onAddTextPart).toHaveBeenCalledWith("blocks-1", "s1");
  });

  it("delegates socket part creation to the controls", () => {
    mount(blocks([colorKey("cat")], [statement("s1", "cat", [])]));

    click(addSocketPartButton("s1"));

    expect(controls.onAddSocketPart).toHaveBeenCalledTimes(1);
    expect(controls.onAddSocketPart).toHaveBeenCalledWith("blocks-1", "s1");
  });

  // ============================================================
  // SOCKET CONTENT MODE
  // ============================================================

  it("switches an empty socket to a literal", () => {
    mount(
      blocks(
        [colorKey("cat")],
        [statement("s1", "cat", [socketEmptyPart("sock1")])],
      ),
    );

    const select = socketModeSelect("sock1");
    if (!select) {
      throw new Error("Socket mode select not found");
    }

    changeSelect(select, "literal");

    const part = firstItem()?.parts[0];
    expect(part?.type).toBe("socket");
    if (part?.type === "socket") {
      expect(part.content).toEqual({ type: "literal", value: "" });
    }
    expect(literalInput("sock1")).not.toBeNull();
  });

  it("edits a literal in place", () => {
    mount(
      blocks(
        [colorKey("cat")],
        [statement("s1", "cat", [socketLiteralPart("sock1", "5")])],
      ),
    );

    const input = literalInput("sock1");
    if (!input) {
      throw new Error("Literal input not found");
    }

    changeTextInput(input, "42");

    const part = firstItem()?.parts[0];
    expect(part?.type).toBe("socket");
    if (part?.type === "socket") {
      expect(part.content).toEqual({ type: "literal", value: "42" });
    }
  });

  it("edits a literal with a deferred updater after the event finishes", () => {
    elementState = blocks(
      [colorKey("cat")],
      [statement("s1", "cat", [socketLiteralPart("sock1", "5")])],
    );
    updates = [];
    controls = {
      onAddRootBlock: vi.fn(() => null),
      onAddScopeChild: vi.fn(() => null),
      onAddTextPart: vi.fn(() => null),
      onAddSocketPart: vi.fn(() => null),
      onCreateSocketValue: vi.fn(() => null),
    };

    let capturedUpdate:
      | ((element: PowerShowElement) => PowerShowElement)
      | undefined;
    act(() => {
      root.render(
        <BlocksItemEditor
          element={elementState}
          onUpdate={(update) => {
            capturedUpdate = update;
          }}
          blocksAuthoringControls={controls}
          labels={LABELS}
        />,
      );
    });

    const input = literalInput("sock1");
    if (!input) {
      throw new Error("Literal input not found");
    }

    changeTextInput(input, "42");

    expect(capturedUpdate).toBeDefined();
    expect(() => {
      const update = capturedUpdate;
      if (!update) {
        throw new Error("Deferred updater not captured");
      }
      const next = update(elementState);
      if (next.type === "blocks") {
        elementState = next;
      }
    }).not.toThrow();

    const part = firstItem()?.parts[0];
    expect(part?.type).toBe("socket");
    if (part?.type === "socket") {
      expect(part.content).toEqual({ type: "literal", value: "42" });
    }
  });

  it("delegates value creation exactly once from an empty mode", () => {
    mount(
      blocks(
        [colorKey("cat")],
        [statement("s1", "cat", [socketEmptyPart("sock1")])],
      ),
    );

    const select = socketModeSelect("sock1");
    if (!select) {
      throw new Error("Socket mode select not found");
    }

    changeSelect(select, "value");

    expect(controls.onCreateSocketValue).toHaveBeenCalledTimes(1);
    expect(controls.onCreateSocketValue).toHaveBeenCalledWith(
      "blocks-1",
      "s1",
      "sock1",
    );
  });

  it("delegates value creation exactly once from a literal mode", () => {
    mount(
      blocks(
        [colorKey("cat")],
        [statement("s1", "cat", [socketLiteralPart("sock1", "7")])],
      ),
    );

    const select = socketModeSelect("sock1");
    if (!select) {
      throw new Error("Socket mode select not found");
    }

    changeSelect(select, "value");

    expect(controls.onCreateSocketValue).toHaveBeenCalledTimes(1);
    expect(controls.onCreateSocketValue).toHaveBeenCalledWith(
      "blocks-1",
      "s1",
      "sock1",
    );
  });

  it("removes a value subtree when switching its socket back to empty", () => {
    mount(
      blocks(
        [colorKey("cat")],
        [
          statement("s1", "cat", [
            socketBlockPart(
              "sock1",
              value("v1", "cat", [textPart("v1p")]),
            ),
          ]),
        ],
      ),
    );

    const select = socketModeSelect("sock1");
    if (!select) {
      throw new Error("Socket mode select not found");
    }

    changeSelect(select, "empty");

    const part = firstItem()?.parts[0];
    expect(part?.type).toBe("socket");
    if (part?.type === "socket") {
      expect(part.content).toEqual({ type: "empty" });
    }
    expect(row("v1")).toBeNull();
  });

  it("renders an existing canonical block socket as UI mode value", () => {
    mount(
      blocks(
        [colorKey("cat")],
        [
          statement("s1", "cat", [
            socketBlockPart(
              "sock1",
              value("v1", "cat", [textPart("v1p")]),
            ),
          ]),
        ],
      ),
    );

    const select = socketModeSelect("sock1");
    if (!select) {
      throw new Error("Socket mode select not found");
    }

    expect(select.value).toBe("value");
  });

  it("marks the Value option as the currently selected option for an existing socket block", () => {
    mount(
      blocks(
        [colorKey("cat")],
        [
          statement("s1", "cat", [
            socketBlockPart(
              "sock1",
              value("v1", "cat", [textPart("v1p")]),
            ),
          ]),
        ],
      ),
    );

    const select = socketModeSelect("sock1");
    if (!select) {
      throw new Error("Socket mode select not found");
    }

    const selectedValue = select.selectedOptions[0]?.value;
    expect(selectedValue).toBe("value");

    const valueOption = select.querySelector(
      'option[value="value"]',
    ) as HTMLOptionElement | null;
    expect(valueOption?.selected).toBe(true);
  });

  it("converts an existing socket reporter between Value and Logic in place", () => {
    const reporter = value("reporter", "cat", [textPart("part", "x")]);
    mount(blocks([colorKey("cat")], [statement("s1", "cat", [socketBlockPart("sock", reporter)])]));
    const select = socketModeSelect("sock");
    if (!select) throw new Error("Socket mode select not found");
    changeSelect(select, "logic");
    const converted = firstItem()?.parts[0];
    expect(converted?.type).toBe("socket");
    if (converted?.type === "socket" && converted.content.type === "block") {
      expect(converted.content.block).toMatchObject({ id: "reporter", color: "#123456", shape: "logic", parts: reporter.parts, children: [] });
      expect(converted.content.block.parts).toBe(reporter.parts);
    }
    changeSelect(socketModeSelect("sock"), "value");
    const reverted = firstItem()?.parts[0];
    if (reverted?.type === "socket" && reverted.content.type === "block") expect(reverted.content.block.shape).toBe("value");
  });

  it("delegates Value and Logic reporter creation without Inspector ids", () => {
    mount(blocks([colorKey("cat")], [statement("s1", "cat", [socketEmptyPart("sock")])]));
    changeSelect(socketModeSelect("sock"), "value");
    expect(controls.onCreateSocketValue).toHaveBeenCalledWith("blocks-1", "s1", "sock");
    vi.clearAllMocks();
    mount(blocks([colorKey("cat")], [statement("s1", "cat", [socketEmptyPart("sock")])]));
    changeSelect(socketModeSelect("sock"), "logic");
    expect(controls.onCreateSocketValue).toHaveBeenCalledWith("blocks-1", "s1", "sock", "logic");
  });

  it("replaces an existing value subtree with a literal", () => {
    mount(
      blocks(
        [colorKey("cat")],
        [
          statement("s1", "cat", [
            socketBlockPart(
              "sock1",
              value("v1", "cat", [textPart("v1p")]),
            ),
          ]),
        ],
      ),
    );

    const select = socketModeSelect("sock1");
    if (!select) {
      throw new Error("Socket mode select not found");
    }

    changeSelect(select, "literal");

    const part = firstItem()?.parts[0];
    expect(part?.type).toBe("socket");
    if (part?.type === "socket") {
      expect(part.content).toEqual({ type: "literal", value: "" });
    }
    expect(row("v1")).toBeNull();
    expect(literalInput("sock1")).not.toBeNull();
  });

  // ============================================================
  // RECURSION: VALUE BLOCKS
  // ============================================================

  it("edits a socket-contained value block recursively", () => {
    mount(
      blocks(
        [colorKey("cat")],
        [
          statement("s1", "cat", [
            socketBlockPart("sock1", value("v1", "cat", [textPart("v1p")])),
          ]),
        ],
      ),
    );

    const input = textInput("v1");
    if (!input) {
      throw new Error("Value block text input not found");
    }

    changeTextInput(input, "Renamed value");

    const valuePart = firstItem()?.parts[0];
    expect(valuePart?.type).toBe("socket");
    if (valuePart?.type === "socket" && valuePart.content.type === "block") {
      const textPartOfValue = valuePart.content.block.parts[0];
      expect(textPartOfValue?.type).toBe("text");
      if (textPartOfValue?.type === "text") {
        expect(textPartOfValue.text).toBe("Renamed value");
      }
    }
  });

  it("keeps value blocks recursively creatable (parts delegate to controls)", () => {
    mount(
      blocks(
        [colorKey("cat")],
        [
          statement("s1", "cat", [
            socketBlockPart("sock1", value("v1", "cat", [])),
          ]),
        ],
      ),
    );

    click(addTextPartButton("v1"));
    click(addSocketPartButton("v1"));

    expect(controls.onAddTextPart).toHaveBeenCalledWith("blocks-1", "v1");
    expect(controls.onAddSocketPart).toHaveBeenCalledWith("blocks-1", "v1");
  });

  it("never exposes stack shape/move/remove controls for a value block", () => {
    mount(
      blocks(
        [colorKey("cat")],
        [
          statement("s1", "cat", [
            socketBlockPart("sock1", value("v1", "cat", [textPart("v1p")])),
          ]),
        ],
      ),
    );

    expect(row("v1")?.getAttribute("data-powershow-block-shape")).toBe(
      "value",
    );
    expect(moveUpButton("v1")).toBeNull();
    expect(moveDownButton("v1")).toBeNull();
    expect(removeBlockButton("v1")).toBeNull();

    expect(shapeSelect("v1")).toBeNull();
  });

  // ============================================================
  // SCOPE CHILDREN
  // ============================================================

  it("delegates scope child creation to the controls", () => {
    mount(blocks([colorKey("cat")], [scope("sc1", "cat", [])]));

    click(addChildButton("sc1"));

    expect(controls.onAddScopeChild).toHaveBeenCalledTimes(1);
    expect(controls.onAddScopeChild).toHaveBeenCalledWith("blocks-1", "sc1");
  });

  it("reorders and removes scope children", () => {
    mount(
      blocks(
        [colorKey("cat")],
        [
          scope("sc1", "cat", [], [
            statement("c1", "cat", []),
            statement("c2", "cat", []),
          ]),
        ],
      ),
    );

    click(moveDownButton("c1"));

    expect(
      firstItem()?.children.map((child) => child.id),
    ).toEqual(["c2", "c1"]);

    click(removeBlockButton("c1"));

    expect(firstItem()?.children.map((child) => child.id)).toEqual(["c2"]);
  });

  // ============================================================
  // DEPTH
  // ============================================================

  it("disables adding a scope child at MAX_BLOCK_AUTHORING_DEPTH", () => {
    mount(blocks([colorKey("cat")], deepScopeChain(5)));

    expect(row("scope-5")?.getAttribute("data-powershow-block-depth")).toBe(
      "5",
    );
    expect(addChildButton("scope-5")?.disabled).toBe(true);
    // One level shallower still allows a new child (would land at depth 5).
    expect(addChildButton("scope-4")?.disabled).toBe(false);
  });

  it("disables creating a socket value block at MAX_BLOCK_AUTHORING_DEPTH", () => {
    mount(blocks([colorKey("cat")], deepScopeChainWithSockets(5)));

    const deepSocket = socketModeSelect("sock-5");
    const deepValueOption = deepSocket?.querySelector(
      'option[value="value"]',
    ) as HTMLOptionElement | null;
    expect(deepValueOption?.disabled).toBe(true);

    const shallowSocket = socketModeSelect("sock-4");
    const shallowValueOption = shallowSocket?.querySelector(
      'option[value="value"]',
    ) as HTMLOptionElement | null;
    expect(shallowValueOption?.disabled).toBe(false);
  });

  it("keeps imported content deeper than 5 editable and removable", () => {
    mount(blocks([colorKey("cat")], deepScopeChain(6)));

    const deepest = row("scope-6");
    expect(deepest).not.toBeNull();
    expect(deepest?.getAttribute("data-powershow-block-depth")).toBe("6");

    const input = textInput("scope-6");
    if (!input) {
      throw new Error("Deep imported block text input not found");
    }
    changeTextInput(input, "Imported edit");

    // Walk to the deepest block of the imported chain.
    let cursor: BlockItem | undefined = firstItem();
    while (cursor?.children.length) {
      cursor = cursor.children[0];
    }
    const textPartOfDeepest = cursor?.parts[0];
    expect(textPartOfDeepest?.type).toBe("text");
    if (textPartOfDeepest?.type === "text") {
      expect(textPartOfDeepest.text).toBe("Imported edit");
    }

    click(removeBlockButton("scope-6"));

    expect(row("scope-6")).toBeNull();

    let afterRemoval: BlockItem | undefined = firstItem();
    while (afterRemoval?.children.length) {
      afterRemoval = afterRemoval.children[0];
    }
    expect(afterRemoval?.id).toBe("scope-5");
    expect(afterRemoval?.children).toHaveLength(0);
  });
});
