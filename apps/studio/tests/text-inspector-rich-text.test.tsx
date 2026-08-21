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
          fontResourceControls={{
            fontResources: [],
            onAddFontFace: () => {},
            onRemoveFontFace: () => {},
            isFontFamilyInUse: () => false,
          }}
        />
      </StudioI18nProvider>,
    );
  }

  function mount(initial: TextElement) {
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

  function clearColorButton(): HTMLButtonElement {
    const button = container.querySelector<HTMLButtonElement>(
      '[data-powershow-inline-format-clear="true"]',
    );

    if (!button) {
      throw new Error("clear color button not found");
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

  it("applies bold to the selected range", async () => {
    await act(async () => {
      mount(richTextElement());
    });

    await act(async () => {
      selectRange(0, 5);
    });

    await act(async () => {
      inlineButton("bold").click();
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

    await act(async () => {
      inlineButton("bold").click();
    });

    expect(updates).toHaveLength(1);
    expect(updates[0]?.content).toBe("Hello world");
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

  it("clears color while preserving other marks", async () => {
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
      clearColorButton().click();
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
    expect(clearColorButton().disabled).toBe(true);
    expect(colorInput().disabled).toBe(true);
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
});
