// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import type {
  TextElement,
  TextRun,
} from "@powershow/document-schema";

import { TextInspector } from "../src/features/editor/inspector/text-inspector";
import { StudioI18nProvider } from "../src/features/i18n/studio-i18n-context";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

function richTextElement(
  overrides: Partial<Omit<TextElement, "type">> = {},
): TextElement {
  return {
    type: "text",
    id: "text-1",
    hidden: false,
    variant: "body",
    content: "Hello world",
    ...overrides,
  };
}

function richText(runs: TextRun[]): TextElement["content"] {
  return {
    type: "rich-text",
    runs,
  };
}

describe("TextInspector rich text authoring", () => {
  let container: HTMLDivElement;
  let root: Root;
  let elementState: TextElement;
  let updates: TextElement[];
  let layerMoves: number[];

  function renderInspector() {
    root.render(
      <StudioI18nProvider>
        <TextInspector
          element={elementState}
          onUpdate={(update) => {
            const next = update(elementState);

            if (next.type !== "text") {
              return;
            }

            elementState = next;
            updates.push(elementState);
            renderInspector();
          }}
          fontResources={[]}
          parent={null}
          layerControls={{
            index: 0,
            count: 2,
            onMoveTo: (index) => {
              layerMoves.push(index);
            },
          }}
        />
      </StudioI18nProvider>,
    );
  }

  function mount(initial: TextElement) {
    elementState = initial;
    updates = [];
    layerMoves = [];
    renderInspector();
  }

  function rerenderWithElement(nextElement: TextElement) {
    elementState = nextElement;
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
  });

  function textarea(): HTMLTextAreaElement {
    const input = container.querySelector<HTMLTextAreaElement>("#text-content");

    if (!input) {
      throw new Error("text-content textarea not found");
    }

    return input;
  }

  function inlineButton(format: "bold" | "italic" | "underline" | "code"): HTMLButtonElement {
    const button = container.querySelector<HTMLButtonElement>(
      `[data-powershow-inline-format="${format}"]`,
    );

    if (!button) {
      throw new Error(`inline format button not found: ${format}`);
    }

    return button;
  }

  function clearFormattingButton(): HTMLButtonElement {
    const button = container.querySelector<HTMLButtonElement>(
      '[data-powershow-inline-format-clear-formatting="true"]',
    );

    if (!button) {
      throw new Error("clear formatting button not found");
    }

    return button;
  }

  function inlineColorButton(): HTMLButtonElement {
    const button = container.querySelector<HTMLButtonElement>(
      '[data-powershow-inline-color="true"]',
    );

    if (!button) {
      throw new Error("inline color button not found");
    }

    return button;
  }

  function colorInput(): HTMLInputElement {
    const input = container.querySelector<HTMLInputElement>("#text-inline-color");

    if (!input) {
      throw new Error("text-inline-color input not found");
    }

    return input;
  }

  function linkUrlInput(): HTMLInputElement {
    const input = container.querySelector<HTMLInputElement>("#text-link-url");

    if (!input) {
      throw new Error("text-link-url input not found");
    }

    return input;
  }

  function linkTargetSelect(): HTMLSelectElement {
    const select = container.querySelector<HTMLSelectElement>("#text-link-target");

    if (!select) {
      throw new Error("text-link-target select not found");
    }

    return select;
  }

  function variantSelect(): HTMLSelectElement {
    const select = container.querySelector<HTMLSelectElement>("#text-variant");

    if (!select) {
      throw new Error("text-variant select not found");
    }

    return select;
  }

  function setInputValue(input: HTMLInputElement, value: string) {
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

  function setTextareaValue(input: HTMLTextAreaElement, value: string) {
    const setter = Object.getOwnPropertyDescriptor(
      HTMLTextAreaElement.prototype,
      "value",
    )?.set;

    if (!setter) {
      throw new Error("Unable to set textarea value");
    }

    setter.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  }

  function selectRange(start: number, end: number) {
    const input = textarea();

    input.focus();
    input.setSelectionRange(start, end);
    input.dispatchEvent(new Event("select", { bubbles: true }));
    input.dispatchEvent(new MouseEvent("mouseup", { bubbles: true }));
    input.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  }

  it("mounts plain text without writing canonical updates", async () => {
    await act(async () => {
      mount(richTextElement());
    });

    expect(textarea().value).toBe("Hello world");
    expect(updates).toHaveLength(0);
  });

  it("mounts rich text as plain textarea content without writing", async () => {
    await act(async () => {
      mount(
        richTextElement({
          content: richText([
            { text: "Dar " },
            { text: "instruções", marks: { bold: true } },
            { text: " para um computador" },
          ]),
        }),
      );
    });

    expect(textarea().value).toBe("Dar instruções para um computador");
    expect(updates).toHaveLength(0);
  });

  it("does not write when only the selection changes", async () => {
    await act(async () => {
      mount(richTextElement());
    });

    await act(async () => {
      selectRange(0, 5);
    });

    expect(updates).toHaveLength(0);
  });

  it("composes the toolbar and textarea inside one editor shell", async () => {
    await act(async () => {
      mount(richTextElement());
    });

    const shell = container.querySelector('[data-powershow-text-editor="true"]');
    const toolbar = container.querySelector(
      '[data-powershow-text-editor-toolbar="true"]',
    );

    expect(shell).not.toBeNull();
    expect(toolbar?.parentElement).toBe(shell);
    expect(textarea().parentElement).toBe(shell);
    expect(
      (toolbar?.compareDocumentPosition(textarea()) ?? 0) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).not.toBe(0);
    expect(container.querySelector('[data-powershow-inline-color-panel="true"]'))
      .toBeNull();
  });

  it("uses compact but descriptive inline toolbar controls", async () => {
    await act(async () => {
      mount(richTextElement());
    });

    expect(inlineButton("bold").textContent).toBe("B");
    expect(inlineButton("bold").getAttribute("aria-label")).toBe("Bold");
    expect(inlineButton("italic").textContent).toBe("I");
    expect(inlineButton("italic").getAttribute("aria-label")).toBe("Italic");
    expect(inlineButton("underline").textContent).toBe("U");
    expect(inlineButton("underline").getAttribute("aria-label")).toBe("Underline");
    expect(inlineButton("code").textContent).toBe("</>");
    expect(inlineButton("code").getAttribute("aria-label")).toBe("Code");
    expect(inlineColorButton().getAttribute("aria-label")).toBe("Text color");
    expect(clearFormattingButton().getAttribute("aria-label")).toBe("Clear formatting");
    expect(inlineColorButton().textContent).not.toContain("A");
    expect(
      inlineColorButton().querySelector(
        '[data-powershow-inline-color-icon="paint-bucket"]',
      ),
    ).not.toBeNull();
  });

  it("applies bold to the selected range", async () => {
    await act(async () => {
      mount(richTextElement());
    });

    await act(async () => {
      selectRange(0, 5);
    });

    expect(inlineButton("bold").getAttribute("aria-pressed")).toBe("false");

    await act(async () => {
      const button = inlineButton("bold");
      button.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, cancelable: true }));
      expect(document.activeElement).toBe(textarea());
      button.click();
    });

    expect(updates).toHaveLength(1);
    expect(updates[0]?.content).toEqual({
      type: "rich-text",
      runs: [{ text: "Hello", marks: { bold: true } }, { text: " world" }],
    });
  });

  it("removes bold from the same selected range", async () => {
    await act(async () => {
      mount(
        richTextElement({
          content: richText([
            { text: "Hello", marks: { bold: true } },
            { text: " world" },
          ]),
        }),
      );
    });

    await act(async () => {
      selectRange(0, 5);
    });

    expect(inlineButton("bold").getAttribute("aria-pressed")).toBe("true");

    await act(async () => {
      inlineButton("bold").click();
    });

    expect(updates).toHaveLength(1);
    expect(updates[0]?.content).toBe("Hello world");
  });

  it("exposes mixed marks and applies them uniformly on click", async () => {
    await act(async () => {
      mount(richTextElement({
        content: richText([
          { text: "He", marks: { bold: true } },
          { text: "llo" },
          { text: " world" },
        ]),
      }));
    });

    await act(async () => {
      selectRange(0, 5);
    });

    expect(inlineButton("bold").getAttribute("aria-pressed")).toBe("mixed");

    await act(async () => {
      inlineButton("bold").click();
    });

    expect(elementState.content).toEqual(richText([
      { text: "Hello", marks: { bold: true } },
      { text: " world" },
    ]));

    await act(async () => {
      inlineButton("bold").click();
    });

    expect(elementState.content).toBe("Hello world");
  });

  it.each([
    ["italic", { italic: true }],
    ["underline", { underline: true }],
    ["code", { code: true }],
  ] as const)("applies %s to the selection", async (format, marks) => {
    await act(async () => {
      mount(richTextElement());
    });

    await act(async () => {
      selectRange(6, 11);
    });

    await act(async () => {
      inlineButton(format).click();
    });

    expect(updates).toHaveLength(1);
    expect(updates[0]?.content).toEqual({
      type: "rich-text",
      runs: [
        { text: "Hello " },
        { text: "world", marks },
      ],
    });
  });

  it("applies color to the stored selection after focus moves away", async () => {
    await act(async () => {
      mount(richTextElement());
    });

    await act(async () => {
      selectRange(6, 11);
    });

    await act(async () => {
      const colorButton = inlineColorButton();
      colorButton.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, cancelable: true }));
      colorButton.click();
    });

    expect(inlineColorButton().getAttribute("aria-expanded")).toBe("true");

    await act(async () => {
      colorInput().focus();
      setInputValue(colorInput(), "#7c3aed");
      colorInput().dispatchEvent(new Event("change", { bubbles: true }));
    });

    expect(updates).toHaveLength(1);
    expect(updates[0]?.content).toEqual({
      type: "rich-text",
      runs: [
        { text: "Hello " },
        { text: "world", marks: { color: "#7c3aed" } },
      ],
    });
  });

  it("clears color from its disclosure while preserving other marks", async () => {
    await act(async () => {
      mount(
        richTextElement({
          content: richText([
            { text: "Hello " },
            { text: "world", marks: { bold: true, color: "#7c3aed" } },
          ]),
        }),
      );
    });

    await act(async () => {
      selectRange(6, 11);
    });

    await act(async () => {
      inlineColorButton().click();
    });

    const clearColor = Array.from(container.querySelectorAll("button")).find(
      (button) => button.textContent === "Clear color",
    );
    expect(clearColor).toBeDefined();

    await act(async () => {
      clearColor?.click();
    });

    expect(updates).toHaveLength(1);
    expect(updates[0]?.content).toEqual({
      type: "rich-text",
      runs: [
        { text: "Hello " },
        { text: "world", marks: { bold: true } },
      ],
    });
  });

  it("disables inline controls with an empty selection", async () => {
    await act(async () => {
      mount(richTextElement());
    });

    expect(inlineButton("bold").disabled).toBe(true);
    expect(inlineButton("italic").disabled).toBe(true);
    expect(inlineButton("underline").disabled).toBe(true);
    expect(inlineButton("code").disabled).toBe(true);
    expect(inlineColorButton().disabled).toBe(true);
    expect(clearFormattingButton().disabled).toBe(true);
    expect(container.querySelector("#text-inline-color")).toBeNull();
  });

  it("enables all selection actions only after a non-empty range is selected", async () => {
    await act(async () => {
      mount(richTextElement());
    });

    await act(async () => {
      selectRange(0, 5);
    });

    expect(inlineButton("bold").disabled).toBe(false);
    expect(inlineButton("italic").disabled).toBe(false);
    expect(inlineButton("underline").disabled).toBe(false);
    expect(inlineButton("code").disabled).toBe(false);
    expect(inlineColorButton().disabled).toBe(false);
    expect(clearFormattingButton().disabled).toBe(false);
  });

  it("opens the existing ColorControl without losing the stored selection", async () => {
    await act(async () => {
      mount(richTextElement());
    });

    await act(async () => {
      selectRange(0, 5);
    });

    await act(async () => {
      inlineColorButton().click();
    });

    expect(container.querySelector("#text-inline-color")).not.toBeNull();
    expect(container.querySelector("#text-inline-color-value")).not.toBeNull();
    expect(textarea().value).toBe("Hello world");

    await act(async () => {
      const valueInput = container.querySelector<HTMLInputElement>("#text-inline-color-value");
      if (!valueInput) {
        throw new Error("text-inline-color value input not found");
      }

      valueInput.focus();
      setInputValue(valueInput, "#f97316");
      valueInput.dispatchEvent(new Event("change", { bubbles: true }));
    });

    expect(updates[0]?.content).toEqual({
      type: "rich-text",
      runs: [{ text: "Hello", marks: { color: "#f97316" } }, { text: " world" }],
    });
  });

  it("shows mixed color explicitly and makes the range uniform after choosing a color", async () => {
    await act(async () => {
      mount(richTextElement({
        content: richText([
          { text: "He", marks: { color: "#ef4444" } },
          { text: "llo", marks: { color: "#3b82f6" } },
          { text: " world" },
        ]),
      }));
    });

    await act(async () => {
      selectRange(0, 5);
    });

    expect(inlineColorButton().getAttribute("data-powershow-inline-color-state")).toBe("mixed");

    await act(async () => {
      inlineColorButton().click();
    });

    expect(container.querySelector('[role="status"]')?.textContent).toBe("Mixed");

    await act(async () => {
      setInputValue(colorInput(), "#7c3aed");
      colorInput().dispatchEvent(new Event("change", { bubbles: true }));
    });

    expect(elementState.content).toEqual(richText([
      { text: "Hello", marks: { color: "#7c3aed" } },
      { text: " world" },
    ]));
    expect(inlineColorButton().getAttribute("data-powershow-inline-color-state")).toBe("uniform");
  });

  it("preserves resolved color indication in the paint-bucket control", async () => {
    await act(async () => {
      mount(richTextElement({
        content: richText([{ text: "Hello", marks: { color: "#ef4444" } }]),
      }));
    });

    await act(async () => {
      selectRange(0, 5);
    });

    expect(inlineColorButton().getAttribute("data-powershow-inline-color-state")).toBe("uniform");
    expect(
      inlineColorButton().querySelector('[data-powershow-inline-color-swatch="true"]'),
    ).not.toBeNull();
    expect(inlineColorButton().querySelector("svg path")?.getAttribute("fill"))
      .not.toBe("currentColor");
  });

  it("derives the color control from the current uniform selection", async () => {
    await act(async () => {
      mount(richTextElement({
        content: richText([
          { text: "red", marks: { color: "#ef4444" } },
          { text: "blue", marks: { color: "#3b82f6" } },
        ]),
      }));
    });

    await act(async () => {
      selectRange(0, 3);
    });

    await act(async () => {
      inlineColorButton().click();
    });

    expect(colorInput().value).toBe("#ef4444");

    await act(async () => {
      selectRange(3, 7);
    });

    expect(colorInput().value).toBe("#3b82f6");
  });

  it("does not retain a uniform color as the canonical value for a mixed selection", async () => {
    await act(async () => {
      mount(richTextElement({
        content: richText([
          { text: "red", marks: { color: "#ef4444" } },
          { text: "blue", marks: { color: "#3b82f6" } },
        ]),
      }));
    });

    await act(async () => {
      selectRange(0, 3);
    });

    await act(async () => {
      inlineColorButton().click();
    });

    expect(colorInput().value).toBe("#ef4444");

    await act(async () => {
      selectRange(0, 7);
    });

    expect(inlineColorButton().getAttribute("data-powershow-inline-color-state")).toBe("mixed");
    expect(colorInput().value).toBe("#f8fafc");
  });

  it("clears color immediately without retaining a selection color", async () => {
    await act(async () => {
      mount(richTextElement({
        content: richText([{ text: "Hello", marks: { color: "#ef4444" } }]),
      }));
    });

    await act(async () => {
      selectRange(0, 5);
    });

    await act(async () => {
      inlineColorButton().click();
    });

    const clearColor = Array.from(container.querySelectorAll("button")).find(
      (button) => button.textContent === "Clear color",
    );

    await act(async () => {
      clearColor?.click();
    });

    expect(elementState.content).toBe("Hello");
    expect(inlineColorButton().getAttribute("data-powershow-inline-color-state")).toBe("none");
  });

  it("normalizes a remembered selection when content becomes shorter", async () => {
    await act(async () => {
      mount(richTextElement());
    });

    await act(async () => {
      selectRange(0, 11);
    });

    await act(async () => {
      rerenderWithElement(richTextElement({ content: "Hello" }));
    });

    expect(inlineButton("bold").disabled).toBe(false);
    expect(inlineButton("bold").getAttribute("aria-pressed")).toBe("false");

    await act(async () => {
      inlineButton("bold").click();
    });

    expect(elementState.content).toEqual({
      type: "rich-text",
      runs: [{ text: "Hello", marks: { bold: true } }],
    });
  });

  it("clamps stale formatting transforms to the current content length", async () => {
    await act(async () => {
      mount(richTextElement());
    });

    await act(async () => {
      selectRange(3, 11);
    });

    await act(async () => {
      rerenderWithElement(richTextElement({ content: "Hello" }));
    });

    await act(async () => {
      inlineButton("italic").click();
    });

    expect(elementState.content).toEqual({
      type: "rich-text",
      runs: [
        { text: "Hel" },
        { text: "lo", marks: { italic: true } },
      ],
    });
  });

  it("disables selection formatting when a content shrink makes the range empty", async () => {
    await act(async () => {
      mount(richTextElement());
    });

    await act(async () => {
      selectRange(6, 11);
    });

    await act(async () => {
      rerenderWithElement(richTextElement({ content: "Hi" }));
    });

    expect(inlineButton("bold").disabled).toBe(true);
    expect(inlineColorButton().disabled).toBe(true);
    expect(clearFormattingButton().disabled).toBe(true);
    expect(inlineColorButton().getAttribute("data-powershow-inline-color-state")).toBe("none");
  });

  it("clears all inline formatting without changing element typography", async () => {
    await act(async () => {
      mount(richTextElement({
        typography: { fontSize: 32 },
        content: richText([
          { text: "Hello", marks: { bold: true, italic: true, underline: true, code: true, color: "#7c3aed" } },
          { text: " world" },
        ]),
      }));
    });

    await act(async () => {
      selectRange(0, 5);
    });

    await act(async () => {
      clearFormattingButton().click();
    });

    expect(elementState.content).toBe("Hello world");
    expect(elementState.typography).toEqual({ fontSize: 32 });
    expect(inlineButton("bold").getAttribute("aria-pressed")).toBe("false");
    expect(inlineColorButton().getAttribute("data-powershow-inline-color-state")).toBe("none");
  });

  it("preserves marks when typing inside rich content", async () => {
    await act(async () => {
      mount(
        richTextElement({
          content: richText([
            { text: "Dar " },
            { text: "instruções", marks: { bold: true } },
            { text: " para um computador" },
          ]),
        }),
      );
    });

    await act(async () => {
      setTextareaValue(textarea(), "Dar instruçXões para um computador");
    });

    expect(updates).toHaveLength(1);
    expect(updates[0]?.content).toEqual({
      type: "rich-text",
      runs: [
        { text: "Dar " },
        { text: "instruçXões", marks: { bold: true } },
        { text: " para um computador" },
      ],
    });
  });

  it("keeps the variant and link controls available", async () => {
    await act(async () => {
      mount(richTextElement());
    });

    expect(variantSelect().value).toBe("body");
    expect(linkUrlInput().value).toBe("");
    expect(linkTargetSelect().value).toBe("same");
  });

  it("renders the Text Inspector sections in the canonical order", async () => {
    await act(async () => {
      mount(richTextElement());
    });

    const sectionTitles = Array.from(
      container.querySelectorAll("details > summary > span:first-child"),
    ).map((title) => title.textContent);

    expect(sectionTitles).toEqual([
      "Content",
      "Typography",
      "Appearance",
      "Effects",
      "Placement",
      "Interaction",
    ]);

    const variantSection = variantSelect().closest("details");
    expect(variantSection?.querySelector("summary")?.textContent).toContain(
      "Typography",
    );

    const appearanceSection = Array.from(
      container.querySelectorAll("details"),
    ).find((section) =>
      section.querySelector("summary")?.textContent?.includes("Appearance"),
    );
    expect(
      appearanceSection?.querySelector('[class*="appearanceSubheading"]'),
    ).toBeNull();
  });

  it("uses the existing Placement section for Flow and Absolute text layout", async () => {
    await act(async () => {
      mount(richTextElement());
    });

    const placementSection = Array.from(container.querySelectorAll("details")).find(
      (section) => section.querySelector("summary")?.textContent === "Placement",
    );
    expect(placementSection).not.toBeUndefined();
    expect(container.querySelector<HTMLSelectElement>("#element-canonical-position-mode")?.value)
      .toBe("flow");
    expect(container.querySelector("#element-canonical-top")).toBeNull();

    await act(async () => {
      const mode = container.querySelector<HTMLSelectElement>("#element-canonical-position-mode");
      if (!mode) throw new Error("text placement mode not found");
      mode.value = "absolute";
      mode.dispatchEvent(new Event("change", { bubbles: true }));
    });

    expect(elementState.layout?.position).toBe("absolute");
    expect(container.querySelector("#element-canonical-top")).not.toBeNull();
    expect(container.querySelector("#element-canonical-left")).not.toBeNull();

    await act(async () => {
      const bringToFront = Array.from(container.querySelectorAll("button")).find(
        (button) => button.textContent === "Bring to front",
      );
      if (!bringToFront) throw new Error("bring-to-front control not found");
      bringToFront.click();
    });

    expect(layerMoves).toEqual([1]);

    await act(async () => {
      const mode = container.querySelector<HTMLSelectElement>("#element-canonical-position-mode");
      if (!mode) throw new Error("text placement mode not found");
      mode.value = "flow";
      mode.dispatchEvent(new Event("change", { bubbles: true }));
    });

    expect(elementState.layout).toEqual({});
    expect(container.querySelector("#element-canonical-top")).toBeNull();
    expect(
      Array.from(container.querySelectorAll("details")).map(
        (section) => section.querySelector("summary")?.textContent,
      ).slice(-2),
    ).toEqual(["Placement", "Interaction"]);
  });

  it("changes the canonical text variant from Typography", async () => {
    let updated: TextElement | undefined;

    await act(async () => {
      root.render(
        <StudioI18nProvider>
          <TextInspector
            element={richTextElement()}
            onUpdate={(update) => {
              const next = update(richTextElement());
              if (next.type === "text") {
                updated = next;
              }
            }}
            fontResources={[]}
          />
        </StudioI18nProvider>,
      );
    });

    await act(async () => {
      const select = variantSelect();
      select.value = "title";
      select.dispatchEvent(new Event("change", { bubbles: true }));
    });

    expect(updated?.variant).toBe("title");
  });

  it("keeps presentation fonts and unregistered family fallback in Typography", async () => {
    let updated: TextElement | undefined;

    await act(async () => {
      root.render(
        <StudioI18nProvider>
          <TextInspector
            element={richTextElement({
              typography: { fontFamily: "Legacy Family" },
            })}
            onUpdate={(update) => {
              const next = update(richTextElement({
                typography: { fontFamily: "Legacy Family" },
              }));
              if (next.type === "text") {
                updated = next;
              }
            }}
            fontResources={[
              { id: "font-1", family: "Presentation Font" },
            ]}
          />
        </StudioI18nProvider>,
      );
    });

    const fontFamily = container.querySelector<HTMLSelectElement>(
      "#text-font-family",
    );
    expect(fontFamily?.value).toBe("Legacy Family");
    expect(fontFamily?.querySelector("option[value='Presentation Font']"))
      .not.toBeNull();

    await act(async () => {
      if (!fontFamily) {
        throw new Error("text-font-family select not found");
      }

      fontFamily.value = "Presentation Font";
      fontFamily.dispatchEvent(new Event("change", { bubbles: true }));
    });

    expect(updated?.typography?.fontFamily).toBe("Presentation Font");
  });
});
