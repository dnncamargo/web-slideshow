// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { CodeElement, Gradient } from "@powershow/document-schema";
import { CodeInspector } from "../src/features/editor/inspector/code-inspector";
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
});
