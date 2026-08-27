// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import type { ContainerElement, PowerShowElement, TextElement } from "@powershow/document-schema";

import { ContainerInspector } from "../src/features/editor/inspector/container-inspector";
import { TextInspector } from "../src/features/editor/inspector/text-inspector";
import { StudioI18nProvider } from "../src/features/i18n/studio-i18n-context";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

const FONT_RESOURCES: readonly { id: string; family: string }[] = [];

const gradient = {
  type: "linear" as const,
  stops: [{ color: "#000", position: 0 }, { color: "#fff", position: 100 }],
};

function containerElement(overrides: Partial<ContainerElement> = {}): ContainerElement {
  return {
    type: "container",
    id: "container-pattern",
    hidden: false,
    children: [],
    ...overrides,
  };
}

function textElement(): TextElement {
  return { type: "text", id: "text-pattern", hidden: false, variant: "body", content: "Text" };
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

describe("Container canonical background pattern inspector", () => {
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
            fontResources={FONT_RESOURCES}
            onUpdate={(update) => {
              if (state.type !== "text") return;
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

  function currentContainer(): ContainerElement {
    expect(state.type).toBe("container");
    return state as ContainerElement;
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

  it("exposes Pattern for Containers but not Text", async () => {
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
  ])("preset %s writes canonical Pattern data", async (mode, imageKind) => {
    await act(async () => mount(containerElement()));
    await act(async () => changeSelect(host.querySelector("#container-background-pattern")!, mode));

    expect(updates).toHaveLength(1);
    expect(state).toMatchObject({ style: { background: { pattern: { image: expect.stringContaining(imageKind) } } } });
    expect(currentContainer().style).not.toHaveProperty("backgroundPattern");
    expect(currentContainer().style).not.toHaveProperty("backgroundGradient");
  });

  it("preserves color and gradient when adding a Pattern", async () => {
    await act(async () => mount(containerElement({ style: { background: { color: "#0f172a", gradient } } })));
    await act(async () => changeSelect(host.querySelector("#container-background-pattern")!, "grid"));

    expect(currentContainer().style?.background).toMatchObject({ color: "#0f172a", gradient });
    expect(currentContainer().style?.background?.pattern).toBeDefined();
  });

  it("preserves color and Pattern when changing Gradient", async () => {
    const pattern = { image: "linear-gradient(#000, #fff)", size: "12px", repeat: "repeat" as const };
    await act(async () => mount(containerElement({ style: { background: { color: "#0f172a", pattern } } })));
    await act(async () => changeSelect(host.querySelector("#container-gradient-type")!, "linear"));

    expect(currentContainer().style?.background).toMatchObject({ color: "#0f172a", pattern });
    expect(currentContainer().style?.background?.gradient).toBeDefined();
  });

  it("none clears only Pattern", async () => {
    await act(async () => mount(containerElement({
      style: { background: { color: "#000", gradient, pattern: { image: "linear-gradient(#000, #fff)" }, }, borderRadius: 8 },
      effect: { opacity: 0.6 },
    })));
    await act(async () => changeSelect(host.querySelector("#container-background-pattern")!, "none"));

    expect(currentContainer().style?.background).toMatchObject({ color: "#000", gradient });
    expect(currentContainer().style?.background?.pattern).toBeUndefined();
    expect(currentContainer().effect?.opacity).toBe(0.6);
    expect(currentContainer().style?.borderRadius).toBe(8);
  });

  it("typing Custom CSS performs zero canonical writes", async () => {
    await act(async () => mount(containerElement()));
    await act(async () => changeSelect(host.querySelector("#container-background-pattern")!, "custom"));
    await act(async () => setValue(host.querySelector("#container-custom-pattern-css")!, "background-image: linear-gradient(#000, #fff);"));
    expect(updates).toHaveLength(0);
  });

  it("applies Custom CSS canonically and preserves Gradient and element opacity", async () => {
    await act(async () => mount(containerElement({
      style: { background: { color: "#111", gradient } },
      effect: { opacity: 0.8 },
    })));
    await act(async () => changeSelect(host.querySelector("#container-background-pattern")!, "custom"));
    await act(async () => setValue(host.querySelector("#container-custom-pattern-css")!, "background-color: #0f172a; background-image: linear-gradient(#000, #fff); background-size: 12px; background-position: 2px; background-repeat: repeat; opacity: 0.25;"));
    await act(async () => host.querySelector<HTMLButtonElement>("#container-apply-background-pattern")?.click());

    expect(updates).toHaveLength(1);
    expect(currentContainer().style?.background).toMatchObject({ color: "#0f172a", gradient, pattern: { image: "linear-gradient(#000, #fff)", size: "12px", position: "2px", repeat: "repeat", opacity: 0.25 } });
    expect(currentContainer().effect?.opacity).toBe(0.8);
    expect(currentContainer().style).not.toHaveProperty("opacity");
  });

  it("invalid Custom CSS performs zero writes and shows an error", async () => {
    await act(async () => mount(containerElement()));
    await act(async () => changeSelect(host.querySelector("#container-background-pattern")!, "custom"));
    await act(async () => setValue(host.querySelector("#container-custom-pattern-css")!, "display: grid;"));
    await act(async () => host.querySelector<HTMLButtonElement>("#container-apply-background-pattern")?.click());

    expect(updates).toHaveLength(0);
    expect(host.querySelector('[role="alert"]')).not.toBeNull();
  });

  it("hydrates a custom Pattern and preserves a dirty draft across a color rerender", async () => {
    const pattern = { image: "linear-gradient(#000, #fff)", size: "12px", repeat: "repeat" as const };
    await act(async () => mount(containerElement({ style: { background: { color: "#fff", pattern } } })));
    const textarea = host.querySelector<HTMLTextAreaElement>("#container-custom-pattern-css");
    expect(textarea?.value).toContain("background-size: 12px;");
    expect(updates).toHaveLength(0);

    await act(async () => changeSelect(host.querySelector("#container-background-pattern")!, "custom"));
    await act(async () => setValue(textarea!, "background-image: linear-gradient(#123, #456);"));
    expect(updates).toHaveLength(0);

    await act(async () => setValue(host.querySelector("#container-background-value")!, "#eeeeee"));
    expect(updates).toHaveLength(1);
    expect(host.querySelector<HTMLTextAreaElement>("#container-custom-pattern-css")?.value).toBe("background-image: linear-gradient(#123, #456);");
  });
});
