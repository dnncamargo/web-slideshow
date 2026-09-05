// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { CodeElement, Gradient, TerminalElement } from "@powershow/document-schema";
import { CodeInspector } from "../src/features/editor/inspector/code-inspector";
import { TerminalInspector } from "../src/features/editor/inspector/terminal-inspector";
import { StudioI18nProvider } from "../src/features/i18n/studio-i18n-context";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

const gradient: Gradient = {
  type: "linear",
  angle: 135,
  stops: [
    { color: "#7c3aed", position: 0 },
    { color: "#06b6d4", position: 100 },
  ],
};

function codeElement(overrides: Partial<CodeElement> = {}): CodeElement {
  return {
    type: "code",
    id: "canonical-code",
    hidden: false,
    code: "const value = 1;",
    language: "typescript",
    showLineNumbers: true,
    highlightedLines: [],
    ...overrides,
  };
}

function terminalElement(overrides: Partial<TerminalElement> = {}): TerminalElement {
  return {
    type: "terminal",
    id: "canonical-terminal",
    hidden: false,
    lines: [],
    ...overrides,
  };
}

function changeInput(input: HTMLInputElement, value: string): void {
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value")?.set;
  setter?.call(input, value);
  input.dispatchEvent(new Event("input", { bubbles: true }));
  input.dispatchEvent(new Event("change", { bubbles: true }));
}

function changeSelect(select: HTMLSelectElement, value: string): void {
  select.value = value;
  select.dispatchEvent(new Event("change", { bubbles: true }));
}

function changeTextarea(textarea: HTMLTextAreaElement, value: string): void {
  const setter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, "value")?.set;
  setter?.call(textarea, value);
  textarea.dispatchEvent(new Event("input", { bubbles: true }));
  textarea.dispatchEvent(new Event("change", { bubbles: true }));
}

describe("canonical data Appearance controls", () => {
  let host: HTMLDivElement;
  let root: Root;
  let state: CodeElement;

  function renderInspector(): void {
    root.render(
      <StudioI18nProvider>
        <CodeInspector
          element={state}
          fontResources={[{ id: "fira-code", family: "Fira Code" }]}
          onUpdate={(update) => {
            const next = update(state);
            state = next.type === "code" ? next : state;
            renderInspector();
          }}
        />
      </StudioI18nProvider>,
    );
  }

  beforeEach(() => {
    host = document.createElement("div");
    document.body.appendChild(host);
    root = createRoot(host);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    document.body.innerHTML = "";
  });

  it("clears only background color when a gradient is present", async () => {
    state = codeElement({ style: { background: { color: "#111111", gradient } } });
    await act(async () => renderInspector());

    const clear = host.querySelector<HTMLInputElement>("#code-background")?.parentElement?.parentElement?.querySelector<HTMLButtonElement>("button");
    expect(clear).toBeDefined();
    await act(async () => clear?.click());

    expect(state.style?.background?.color).toBeUndefined();
    expect(state.style?.background?.gradient).toEqual(gradient);
  });

  it("adapts RichText Code source through the existing textarea", async () => {
    state = codeElement({
      code: { type: "rich-text", runs: [{ text: "  const", marks: { bold: true } }, { text: " value = 1;\nnext" }] },
    });
    await act(async () => renderInspector());

    const source = host.querySelector<HTMLTextAreaElement>("#code-source");
    expect(source?.value).toBe("  const value = 1;\nnext");
    expect(source?.value).not.toContain("[object Object]");

    await act(async () => changeTextarea(source!, "  const value = 2;\nnext"));
    expect(state.code).toEqual({ type: "rich-text", runs: [{ text: "  const", marks: { bold: true } }, { text: " value = 2;\nnext" }] });
  });

  it("preserves the sibling while changing or clearing either background property", async () => {
    state = codeElement({ style: { background: { color: "#111111", gradient } } });
    await act(async () => renderInspector());

    await act(async () => changeInput(host.querySelector("#code-background-value")!, "#222222"));
    expect(state.style?.background?.color).toBe("#222222");
    expect(state.style?.background?.gradient).toEqual(gradient);

    await act(async () => changeSelect(host.querySelector("#code-background-gradient-type")!, "none"));
    expect(state.style?.background?.gradient).toBeUndefined();
    expect(state.style?.background?.color).toBe("#222222");

    await act(async () => host.querySelector<HTMLInputElement>("#code-background")?.parentElement?.parentElement?.querySelector<HTMLButtonElement>("button")?.click());
    expect(state.style?.background).toBeUndefined();
  });

  it("writes canonical effect and border addresses through the real Code Inspector", async () => {
    state = codeElement();
    await act(async () => renderInspector());

    await act(async () => changeInput(host.querySelector("#code-opacity")!, "75"));
    await act(async () => changeSelect(host.querySelector("#code-shadow-mode")!, "outer"));
    await act(async () => changeSelect(host.querySelector("#code-border-style")!, "solid"));
    await act(async () => changeSelect(host.querySelector("#code-border-paint")!, "gradient"));

    expect(state.effect?.opacity).toBe(0.75);
    expect(state.effect?.shadow).toBeDefined();
    expect(state.style?.border?.gradient).toBeDefined();
    expect(state.style).not.toHaveProperty("backgroundGradient");
    expect(state.style).not.toHaveProperty("opacity");
    expect(state.style).not.toHaveProperty("shadow");
  });

  it("exposes only the Code typography controls and writes their canonical fields", async () => {
    state = codeElement();
    await act(async () => renderInspector());

    expect(host.querySelector("#code-font-family")).not.toBeNull();
    expect(host.querySelector("#code-font-size")).not.toBeNull();
    expect(host.querySelector("#code-line-height")).not.toBeNull();
    expect(host.querySelector("#code-letter-spacing")).not.toBeNull();
    expect(host.querySelector("#code-font-weight")).toBeNull();
    expect(host.querySelector("#code-font-style")).toBeNull();
    expect(host.querySelector("#code-text-align")).toBeNull();
    expect(host.querySelector("#code-text-transform")).toBeNull();
    expect(host.querySelector("#code-white-space")).toBeNull();

    await act(async () => changeSelect(host.querySelector("#code-font-family")!, "Fira Code"));
    await act(async () => changeSelect(host.querySelector("#code-font-size-unit")!, "px"));
    await act(async () => changeInput(host.querySelector("#code-font-size")!, "18"));
    await act(async () => changeInput(host.querySelector("#code-line-height")!, "1.5"));
    await act(async () => changeInput(host.querySelector("#code-letter-spacing")!, "0.1"));

    expect(state.typography).toEqual({
      fontFamily: "Fira Code",
      fontSize: 18,
      lineHeight: 1.5,
      letterSpacing: "0.1em",
    });
  });

  it("writes and resets Code text color without persisting the theme color", async () => {
    state = codeElement();
    await act(async () => renderInspector());

    await act(async () => changeInput(host.querySelector("#code-color")!, "#ff0000"));
    expect(state.style?.color).toBe("#ff0000");

    const reset = host.querySelector<HTMLInputElement>("#code-color")?.parentElement?.parentElement?.querySelector<HTMLButtonElement>("button");
    await act(async () => reset?.click());
    expect(state.style?.color).toBeUndefined();
  });

  it("resets each authored Code typography field while preserving its siblings", async () => {
    state = codeElement();
    await act(async () => renderInspector());

    await act(async () => changeSelect(host.querySelector("#code-font-family")!, "Fira Code"));
    await act(async () => changeSelect(host.querySelector("#code-font-size-unit")!, "px"));
    await act(async () => changeInput(host.querySelector("#code-font-size")!, "18"));
    await act(async () => changeInput(host.querySelector("#code-line-height")!, "1.5"));
    await act(async () => changeInput(host.querySelector("#code-letter-spacing")!, "0.1"));

    expect(state.typography).toEqual({
      fontFamily: "Fira Code",
      fontSize: 18,
      lineHeight: 1.5,
      letterSpacing: "0.1em",
    });

    await act(async () => changeSelect(host.querySelector("#code-font-family")!, ""));
    expect(state.typography?.fontFamily).toBeUndefined();
    expect(state.typography?.fontSize).toBe(18);
    expect(state.typography?.lineHeight).toBe(1.5);
    expect(state.typography?.letterSpacing).toBe("0.1em");

    const clickReset = async (id: string): Promise<void> => {
      const input = host.querySelector<HTMLInputElement>(id);
      const reset = input?.parentElement?.parentElement?.querySelector<HTMLButtonElement>("button");
      expect(reset).not.toBeNull();
      await act(async () => reset?.click());
    };

    await clickReset("#code-font-size");
    expect(state.typography?.fontSize).toBeUndefined();
    expect(state.typography?.lineHeight).toBe(1.5);
    expect(state.typography?.letterSpacing).toBe("0.1em");

    await clickReset("#code-line-height");
    expect(state.typography?.lineHeight).toBeUndefined();
    expect(state.typography?.letterSpacing).toBe("0.1em");

    await clickReset("#code-letter-spacing");
    expect(state.typography?.letterSpacing).toBeUndefined();
  });
});

describe("Terminal authoring controls", () => {
  let host: HTMLDivElement;
  let root: Root;
  let state: TerminalElement;

  function renderInspector(): void {
    root.render(
      <StudioI18nProvider>
        <TerminalInspector
          element={state}
          fontResources={[{ id: "fira-code", family: "Fira Code" }]}
          onUpdate={(update) => {
            const next = update(state);
            state = next.type === "terminal" ? next : state;
            renderInspector();
          }}
        />
      </StudioI18nProvider>,
    );
  }

  beforeEach(() => {
    host = document.createElement("div");
    document.body.appendChild(host);
    root = createRoot(host);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    document.body.innerHTML = "";
  });

  it("adapts RichText titles and lines through the existing plain controls", async () => {
    state = terminalElement({
      title: { type: "rich-text", runs: [{ text: "Terminal", marks: { bold: true } }] },
      lines: [{ type: "error", content: { type: "rich-text", runs: [{ text: "failure", marks: { italic: true } }] } }],
    });
    await act(async () => renderInspector());

    const title = host.querySelector<HTMLInputElement>("#terminal-title");
    const line = host.querySelector<HTMLTextAreaElement>('textarea[id*="line-0-content"]');
    expect(title?.value).toBe("Terminal");
    expect(line?.value).toBe("failure");

    await act(async () => changeInput(title!, "Renamed"));
    await act(async () => changeTextarea(line!, "fixed"));

    expect(state.title).toEqual({ type: "rich-text", runs: [{ text: "Renamed", marks: { bold: true } }] });
    expect(state.lines[0]?.type).toBe("error");
    expect(state.lines[0]?.content).toEqual({ type: "rich-text", runs: [{ text: "fixed", marks: { italic: true } }] });

    await act(async () => changeInput(host.querySelector<HTMLInputElement>("#terminal-title")!, ""));
    expect(state.title).toBeUndefined();
  });

  it("exposes only the four Terminal typography controls and resets fields independently", async () => {
    state = terminalElement();
    await act(async () => renderInspector());

    expect(host.querySelector("#terminal-font-family")).not.toBeNull();
    expect(host.querySelector("#terminal-font-size")).not.toBeNull();
    expect(host.querySelector("#terminal-line-height")).not.toBeNull();
    expect(host.querySelector("#terminal-letter-spacing")).not.toBeNull();
    expect(host.querySelector("#terminal-font-weight")).toBeNull();
    expect(host.querySelector("#terminal-font-style")).toBeNull();
    expect(host.querySelector("#terminal-text-align")).toBeNull();
    expect(host.querySelector("#terminal-text-transform")).toBeNull();
    expect(host.querySelector("#terminal-white-space")).toBeNull();

    await act(async () => changeSelect(host.querySelector("#terminal-font-family")!, "Fira Code"));
    await act(async () => changeSelect(host.querySelector("#terminal-font-size-unit")!, "px"));
    await act(async () => changeInput(host.querySelector("#terminal-font-size")!, "18"));
    await act(async () => changeInput(host.querySelector("#terminal-line-height")!, "1.5"));
    await act(async () => changeInput(host.querySelector("#terminal-letter-spacing")!, "0.1"));

    expect(state.typography).toEqual({
      fontFamily: "Fira Code",
      fontSize: 18,
      lineHeight: 1.5,
      letterSpacing: "0.1em",
    });

    await act(async () => changeSelect(host.querySelector("#terminal-font-family")!, ""));
    expect(state.typography?.fontFamily).toBeUndefined();
    expect(state.typography?.fontSize).toBe(18);
    expect(state.typography?.lineHeight).toBe(1.5);
    expect(state.typography?.letterSpacing).toBe("0.1em");

    const clickReset = async (id: string): Promise<void> => {
      const input = host.querySelector<HTMLInputElement>(id);
      const reset = input?.parentElement?.parentElement?.querySelector<HTMLButtonElement>("button");
      expect(reset).not.toBeNull();
      await act(async () => reset?.click());
    };

    await clickReset("#terminal-font-size");
    expect(state.typography?.fontFamily).toBeUndefined();
    expect(state.typography?.fontSize).toBeUndefined();
    expect(state.typography?.lineHeight).toBe(1.5);
    expect(state.typography?.letterSpacing).toBe("0.1em");

    await clickReset("#terminal-line-height");
    expect(state.typography?.lineHeight).toBeUndefined();
    expect(state.typography?.letterSpacing).toBe("0.1em");

    await clickReset("#terminal-letter-spacing");
    expect(state.typography?.letterSpacing).toBeUndefined();
    expect(state.typography?.fontFamily).toBeUndefined();
  });

  it("writes and resets the five Terminal semantic colors independently", async () => {
    state = terminalElement({
      style: {
        background: { color: "#111111" },
        borderRadius: 8,
      },
    });
    await act(async () => renderInspector());

    const colors = ["commandColor", "promptColor", "outputColor", "commentColor", "errorColor"] as const;
    for (const [index, property] of colors.entries()) {
      await act(async () => changeInput(host.querySelector(`#terminal-${property}`)!, `#00000${index + 1}`));
      expect(state.style?.[property]).toBe(`#00000${index + 1}`);
    }
    expect(state.style?.background?.color).toBe("#111111");
    expect(state.style?.borderRadius).toBe(8);

    const reset = (property: string) => host.querySelector<HTMLInputElement>(`#terminal-${property}`)?.parentElement?.parentElement?.querySelector<HTMLButtonElement>("button");
    await act(async () => reset("commandColor")?.click());
    expect(state.style?.commandColor).toBeUndefined();
    expect(state.style?.promptColor).toBe("#000002");
    expect(state.style?.background?.color).toBe("#111111");

    await act(async () => reset("promptColor")?.click());
    expect(state.style?.promptColor).toBeUndefined();
    expect(state.style?.outputColor).toBe("#000003");
    expect(state.style?.borderRadius).toBe(8);

    await act(async () => reset("outputColor")?.click());
    expect(state.style?.outputColor).toBeUndefined();
    expect(state.style?.commentColor).toBe("#000004");
    expect(state.style?.background?.color).toBe("#111111");
    expect(state.style?.borderRadius).toBe(8);

    await act(async () => reset("commentColor")?.click());
    expect(state.style?.commentColor).toBeUndefined();
    expect(state.style?.errorColor).toBe("#000005");
    expect(state.style?.background?.color).toBe("#111111");
    expect(state.style?.borderRadius).toBe(8);

    await act(async () => reset("errorColor")?.click());
    expect(state.style?.errorColor).toBeUndefined();
    expect(state.style?.background?.color).toBe("#111111");
    expect(state.style?.borderRadius).toBe(8);
  });
});
