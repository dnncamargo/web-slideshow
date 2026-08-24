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

    const clear = Array.from(host.querySelectorAll<HTMLButtonElement>("button")).find((button) => button.textContent?.trim() === "Remover" || button.textContent?.trim() === "Clear");
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

    await act(async () => Array.from(host.querySelectorAll<HTMLButtonElement>("button")).find((button) => button.textContent?.trim() === "Remover" || button.textContent?.trim() === "Clear")?.click());
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
});
