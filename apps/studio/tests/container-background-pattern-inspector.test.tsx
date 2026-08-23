// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import type { ContainerElement, PowerShowElement, TextElement } from "@powershow/document-schema";

import { ContainerInspector } from "../src/features/editor/inspector/container-inspector";
import { TextInspector } from "../src/features/editor/inspector/text-inspector";
import { StudioI18nProvider } from "../src/features/i18n/studio-i18n-context";
import type { FontResourceControls } from "../src/features/editor/inspector/inspector-types";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

const FONT_RESOURCE_CONTROLS: FontResourceControls = {
  fontResources: [],
  onAddFontFace: () => undefined,
  onRemoveFontFace: () => undefined,
  isFontFamilyInUse: () => false,
};

function containerElement(overrides: Partial<ContainerElement> = {}): ContainerElement {
  return {
    type: "container",
    id: "container-pattern",
    hidden: false,
    direction: "column",
    children: [],
    ...overrides,
  };
}

function textElement(): TextElement {
  return {
    type: "text",
    id: "text-pattern",
    hidden: false,
    variant: "body",
    content: "Text",
  };
}

function setValue(element: HTMLInputElement | HTMLTextAreaElement, value: string): void {
  const prototype = element.tagName === "TEXTAREA"
    ? window.HTMLTextAreaElement.prototype
    : window.HTMLInputElement.prototype;
  const setter = Object.getOwnPropertyDescriptor(prototype, "value")?.set;
  setter?.call(element, value);
  element.dispatchEvent(new Event("input", { bubbles: true }));
}

function changeSelect(select: HTMLSelectElement, value: string): void {
  select.value = value;
  select.dispatchEvent(new Event("change", { bubbles: true }));
}

describe("Container background pattern inspector", () => {
  let host: HTMLDivElement;
  let root: Root;
  let state: PowerShowElement;
  let updates: PowerShowElement[];

  function renderInspector(): void {
    root.render(
      <StudioI18nProvider>
        {state.type === "container" ? (
          <ContainerInspector
            element={state}
            onUpdate={(update) => {
              state = update(state);
              updates.push(state);
              renderInspector();
            }}
          />
        ) : (
          <TextInspector
            element={state as TextElement}
            fontResourceControls={FONT_RESOURCE_CONTROLS}
            onUpdate={(update) => {
              if (state.type !== "text") {
                return;
              }

              state = update(state);
              updates.push(state);
              renderInspector();
            }}
          />
        )}
      </StudioI18nProvider>,
    );
  }

  function mount(element: PowerShowElement): void {
    state = element;
    updates = [];
    renderInspector();
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

  it("exposes Pattern in Container Appearance but not Text", async () => {
    await act(async () => mount(containerElement()));
    expect(host.querySelector("#container-background-pattern")).not.toBeNull();

    await act(async () => mount(textElement()));
    expect(host.querySelector("#container-background-pattern")).toBeNull();
  });

  it.each([
    ["grid", "linear-gradient"],
    ["fine-grid", "linear-gradient"],
    ["dots", "radial-gradient"],
    ["offset-dots", "radial-gradient"],
    ["diagonal-lines", "repeating-linear-gradient"],
  ])("selecting %s writes canonical Pattern data", async (mode, imageKind) => {
    await act(async () => mount(containerElement()));
    const select = host.querySelector<HTMLSelectElement>("#container-background-pattern");
    expect(select).not.toBeNull();

    await act(async () => changeSelect(select!, mode));

    expect(updates).toHaveLength(1);
    expect(state).toMatchObject({ type: "container", style: { backgroundPattern: { image: expect.stringContaining(imageKind) } } });
    expect(state).not.toHaveProperty("preset");
    expect(state).not.toHaveProperty("patternId");
  });

  it("Pattern selection clears Gradient and preserves base background", async () => {
    await act(async () => mount(containerElement({
      style: {
        background: "#0f172a",
        backgroundGradient: {
          type: "linear",
          stops: [{ color: "#000", position: 0 }, { color: "#fff", position: 100 }],
        },
      },
    })));

    await act(async () => changeSelect(host.querySelector("#container-background-pattern")!, "grid"));

    expect(state.style?.background).toBe("#0f172a");
    expect(state.style?.backgroundGradient).toBeUndefined();
    expect(state.style?.backgroundPattern).toBeDefined();
  });

  it("Gradient selection clears an existing Pattern", async () => {
    await act(async () => mount(containerElement({
      style: { backgroundPattern: { image: "linear-gradient(#000, #fff)" } },
    })));

    await act(async () => changeSelect(host.querySelector("#container-gradient-type")!, "linear"));

    expect(state.style?.backgroundPattern).toBeUndefined();
    expect(state.style?.backgroundGradient?.type).toBe("linear");
  });

  it("None clears only Pattern", async () => {
    await act(async () => mount(containerElement({ style: { background: "#000", opacity: 0.6, backgroundPattern: { image: "linear-gradient(#000, #fff)" }, borderRadius: 8 } })));
    await act(async () => changeSelect(host.querySelector("#container-background-pattern")!, "none"));

    expect(state.style).toMatchObject({ background: "#000", opacity: 0.6, borderRadius: 8 });
    expect(state.style?.backgroundPattern).toBeUndefined();
  });

  it("typing Custom CSS performs zero canonical writes", async () => {
    await act(async () => mount(containerElement()));
    await act(async () => changeSelect(host.querySelector("#container-background-pattern")!, "custom"));
    await act(async () => setValue(host.querySelector("#container-custom-pattern-css")!, "background-image: linear-gradient(#000, #fff);"));
    expect(updates).toHaveLength(0);
  });

  it("successfully applying Custom CSS performs one update and leaves element opacity alone", async () => {
    await act(async () => mount(containerElement({ style: { opacity: 0.8, background: "#111" } })));
    await act(async () => changeSelect(host.querySelector("#container-background-pattern")!, "custom"));
    await act(async () => setValue(host.querySelector("#container-custom-pattern-css")!, "background-color: #0f172a; background-image: linear-gradient(#000, #fff); opacity: 0.25;"));
    await act(async () => host.querySelector<HTMLButtonElement>("#container-apply-background-pattern")?.click());

    expect(updates).toHaveLength(1);
    expect(state.style).toMatchObject({ background: "#0f172a", opacity: 0.8, backgroundPattern: { opacity: 0.25 } });
    expect(state.style?.backgroundGradient).toBeUndefined();
  });

  it("invalid Custom CSS performs zero writes and shows an error", async () => {
    await act(async () => mount(containerElement()));
    await act(async () => changeSelect(host.querySelector("#container-background-pattern")!, "custom"));
    await act(async () => setValue(host.querySelector("#container-custom-pattern-css")!, "display: grid;"));
    await act(async () => host.querySelector<HTMLButtonElement>("#container-apply-background-pattern")?.click());

    expect(updates).toHaveLength(0);
    expect(host.querySelector('[role="alert"]')).not.toBeNull();
  });

  it("hydrates existing custom Pattern without a write and preserves a dirty draft across unrelated edits", async () => {
    await act(async () => mount(containerElement({ style: { backgroundPattern: { image: "linear-gradient(#000, #fff)", size: "12px" } } })));
    const textarea = host.querySelector<HTMLTextAreaElement>("#container-custom-pattern-css");
    expect(textarea?.value).toContain("background-size: 12px;");
    expect(updates).toHaveLength(0);

    await act(async () => setValue(textarea!, "background-image: linear-gradient(#123, #456);"));
    expect(updates).toHaveLength(0);

    await act(async () => {
      state = containerElement({ style: { backgroundPattern: { image: "linear-gradient(#000, #fff)", size: "12px" }, background: "#fff" } });
      renderInspector();
    });

    expect(host.querySelector<HTMLTextAreaElement>("#container-custom-pattern-css")?.value).toBe("background-image: linear-gradient(#123, #456);");
  });
});
