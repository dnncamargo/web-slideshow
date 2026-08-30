// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { PowerShowElementSchema, PresentationSchema, type ContainerElement, type PowerShowElement, type Presentation } from "@powershow/document-schema";

import { ContainerInspector } from "../src/features/editor/inspector/container-inspector";
import { StudioI18nProvider } from "../src/features/i18n/studio-i18n-context";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

const gradient = {
  type: "linear" as const,
  stops: [{ color: "#000", position: 0 }, { color: "#fff", position: 100 }],
};
const pattern = { image: "radial-gradient(circle, #000 1px, transparent 1px)", size: "12px", repeat: "repeat" as const };

function containerElement(overrides: Partial<ContainerElement> = {}): ContainerElement {
  return { type: "container", id: "container-appearance", hidden: false, children: [], ...overrides };
}

function changeSelect(select: HTMLSelectElement, value: string): void {
  select.value = value;
  select.dispatchEvent(new Event("change", { bubbles: true }));
}

function changeInput(input: HTMLInputElement, value: string): void {
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value")?.set;
  setter?.call(input, value);
  input.dispatchEvent(new Event("input", { bubbles: true }));
  input.dispatchEvent(new Event("change", { bubbles: true }));
}

describe("Container canonical appearance and effects inspector", () => {
  let host: HTMLDivElement;
  let root: Root;
  let state: PowerShowElement;
  let updates: PowerShowElement[];
  let linkedPresentation: Presentation | undefined;

  function renderInspector(): void {
    root.render(
      <StudioI18nProvider>
        <ContainerInspector
          element={state as ContainerElement}
          presentation={linkedPresentation}
          onUpdate={(update) => {
            state = update(state);
            updates.push(state);
            renderInspector();
          }}
          onContainerFitModeChange={() => true}
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
    linkedPresentation = undefined;
    document.body.innerHTML = "";
  });

  it("renders Appearance and Effects without Typography", async () => {
    state = containerElement();
    updates = [];
    await act(async () => renderInspector());
    expect(host.textContent).toContain("Appearance");
    expect(host.textContent).toContain("Effects");
    expect(host.querySelector("#container-color")).not.toBeNull();
    expect(host.querySelector("#container-shadow-mode")).not.toBeNull();
    expect(host.textContent).not.toContain("Font family");
  });

  it("writes nested background values and preserves coexistence", async () => {
    state = containerElement({ style: { color: "#fff", background: { color: "#111", gradient, pattern } } });
    updates = [];
    await act(async () => renderInspector());

    await act(async () => changeInput(host.querySelector("#container-background-value")!, "#222222"));
    expect(state.style?.background?.color).toBe("#222222");
    expect(state.style?.background).not.toBeTypeOf("string");

    await act(async () => changeSelect(host.querySelector("#container-background-pattern")!, "none"));
    expect(state.style?.background).toMatchObject({ color: "#222222", gradient });
    expect(state.style?.background?.pattern).toBeUndefined();

    await act(async () => changeSelect(host.querySelector("#container-background-pattern")!, "grid"));
    expect(state.style?.background?.gradient).toEqual(gradient);
    expect(state.style?.background?.pattern).toBeDefined();

    await act(async () => changeSelect(host.querySelector("#container-gradient-type")!, "radial"));
    expect(state.style?.background?.color).toBe("#222222");
    expect(state.style?.background?.pattern).toBeDefined();
    expect(state.style?.background?.pattern).toBeDefined();
    expect(state.style).not.toHaveProperty("backgroundGradient");
    expect(state.style).not.toHaveProperty("backgroundPattern");
  });

  it("writes color, border, rounded corners, opacity and shadow to canonical locations", async () => {
    state = containerElement();
    updates = [];
    await act(async () => renderInspector());

    await act(async () => changeInput(host.querySelector("#container-opacity")!, "75"));
    await act(async () => changeSelect(host.querySelector("#container-shadow-mode")!, "outer"));
    await act(async () => changeSelect(host.querySelector("#container-border-style")!, "solid"));
    await act(async () => changeInput(host.querySelector("#container-border-radius")!, "12"));

    expect(state.effect?.opacity).toBe(0.75);
    expect(state.effect?.shadow).toBeDefined();
    expect(state.style?.border).toBeDefined();
    expect(state.style?.borderRadius).toBe(12);
    expect(state.style).not.toHaveProperty("opacity");
    expect(state.style).not.toHaveProperty("shadow");
    expect(PowerShowElementSchema.safeParse(state).success).toBe(true);
  });

  it("clears opacity and shadow independently", async () => {
    state = containerElement({ effect: { opacity: 0.5, shadow: { x: 0, y: 4, blur: 8, color: "#000" } } });
    updates = [];
    await act(async () => renderInspector());

    await act(async () => changeInput(host.querySelector("#container-opacity")!, ""));
    expect(state.effect?.opacity).toBeUndefined();
    expect(state.effect?.shadow).toBeDefined();

    await act(async () => changeSelect(host.querySelector("#container-shadow-mode")!, "none"));
    expect(state.effect?.opacity).toBeUndefined();
    expect(state.effect?.shadow).toBeUndefined();
  });

  it("clones a Linked atomic Shadow and resets only the local override", async () => {
    state = containerElement();
    updates = [];
    const presentation = PresentationSchema.parse({ schemaVersion: 1, id: "p", title: "P", slides: [{ id: "s", title: "S", elements: [] }], linkedStyles: [{ id: "linked", name: "Linked", effect: { shadow: { x: 20, y: 30, blur: 50, color: "#ff0000" } } }] });
    linkedPresentation = presentation;
    state = { ...state, linkedStyleId: "linked" };
    await act(async () => renderInspector());
    await act(async () => changeInput(host.querySelector("#container-shadow-blur")!, "60"));
    expect(state.effect?.shadow).toEqual({ x: 20, y: 30, blur: 60, color: "#ff0000" });
    expect(presentation.linkedStyles?.[0]?.effect?.shadow).toEqual({ x: 20, y: 30, blur: 50, color: "#ff0000" });
    expect((host.querySelector("#container-shadow-mode") as HTMLSelectElement).querySelector("option[value=none]")).toHaveProperty("disabled", true);
    const reset = Array.from(host.querySelectorAll("button")).find((button) => button.textContent === "Reset");
    expect(reset).toBeDefined();
    await act(async () => reset?.click());
    expect(state.effect?.shadow).toBeUndefined();
  });

  it("keeps radius authorship separate from effective Linked radius", async () => {
    const presentation = PresentationSchema.parse({ schemaVersion: 1, id: "p", title: "P", slides: [{ id: "s", title: "S", elements: [] }], linkedStyles: [{ id: "linked", name: "Linked", style: { borderRadius: 16 } }] });
    linkedPresentation = presentation;
    state = containerElement({ linkedStyleId: "linked" });
    updates = [];
    await act(async () => renderInspector());
    expect((host.querySelector("#container-border-radius") as HTMLInputElement).value).toBe("16");
    expect(host.textContent).toContain("Linked");
    await act(async () => changeInput(host.querySelector("#container-border-radius")!, "24"));
    expect(state.style?.borderRadius).toBe(24);
    expect(presentation.linkedStyles?.[0]?.style?.borderRadius).toBe(16);
    const reset = Array.from(host.querySelectorAll("button")).find((button) => button.textContent === "Reset");
    await act(async () => reset?.click());
    expect(state.style?.borderRadius).toBeUndefined();
  });

  it("preserves a Linked string radius unit through local edit and Reset", async () => {
    linkedPresentation = PresentationSchema.parse({ schemaVersion: 1, id: "p", title: "P", slides: [{ id: "s", title: "S", elements: [] }], linkedStyles: [{ id: "linked", name: "Linked", style: { borderRadius: "1rem" } }] });
    state = containerElement({ linkedStyleId: "linked" });
    updates = [];
    await act(async () => renderInspector());
    expect((host.querySelector("#container-border-radius") as HTMLInputElement).value).toBe("1");
    expect((host.querySelector("#container-border-radius-unit") as HTMLSelectElement).value).toBe("rem");
    await act(async () => changeInput(host.querySelector("#container-border-radius")!, "24"));
    expect(state.style?.borderRadius).toBe("24rem");
    expect(linkedPresentation.linkedStyles?.[0]?.style?.borderRadius).toBe("1rem");
    const reset = host.querySelector("#container-border-radius")?.parentElement?.parentElement?.querySelector("button");
    await act(async () => (reset as HTMLButtonElement)?.click());
    expect(state.style?.borderRadius).toBeUndefined();
  });
});
