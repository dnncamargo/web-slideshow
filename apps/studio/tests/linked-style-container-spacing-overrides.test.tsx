// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { PresentationSchema, type ContainerElement, type Presentation } from "@powershow/document-schema";
import { ContainerInspector } from "../src/features/editor/inspector/container-inspector";
import { StudioI18nProvider } from "../src/features/i18n/studio-i18n-context";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

function changeInput(input: HTMLInputElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value")?.set;
  setter?.call(input, value);
  input.dispatchEvent(new Event("input", { bubbles: true }));
  input.dispatchEvent(new Event("change", { bubbles: true }));
}

describe("Linked Container spacing override UI", () => {
  let host: HTMLDivElement;
  let root: Root;
  let state: ContainerElement;
  let presentation: Presentation;

  beforeEach(() => {
    host = document.createElement("div");
    document.body.appendChild(host);
    root = createRoot(host);
  });
  afterEach(async () => {
    await act(async () => root.unmount());
    document.body.innerHTML = "";
  });

  function render() {
    root.render(<StudioI18nProvider><ContainerInspector element={state} presentation={presentation} onUpdate={(update) => { state = update(state) as ContainerElement; render(); }} onContainerFitModeChange={() => true} /></StudioI18nProvider>);
  }

  function exercise(field: string, linkedLayout: ContainerElement["layout"], expectedKey: "paddingTop" | "marginRight" | "margin") {
    presentation = PresentationSchema.parse({ schemaVersion: 1, id: "p", title: "P", slides: [{ id: "s", title: "S", elements: [] }], linkedStyles: [{ id: "linked", name: "Linked", layout: linkedLayout }] });
    state = { id: "c", type: "container", hidden: false, linkedStyleId: "linked", children: [] };
    act(render);
    const input = host.querySelector<HTMLInputElement>(`#container-${field}`)!;
    expect(input.value).not.toBe("");
    expect(input.closest("label")?.textContent).toContain("Linked");
    act(() => changeInput(input, "0"));
    expect(state.layout).toHaveProperty(expectedKey, 0);
    expect(state.layout).not.toHaveProperty(expectedKey === "paddingTop" ? "paddingRight" : expectedKey === "marginRight" ? "marginLeft" : "marginTop");
    expect(presentation.linkedStyles?.[0]?.layout).toEqual(linkedLayout);
    expect(input.closest("label")?.textContent).toContain("Local override");
    const reset = input.closest("label")?.querySelector("button");
    expect(reset).not.toBeNull();
    act(() => (reset as HTMLButtonElement).click());
    expect(state.layout?.[expectedKey]).toBeUndefined();
  }

  it("keeps paddingTop metadata scoped and preserves paddingRight Linked-only", () => {
    exercise("padding-top", { paddingTop: 12, paddingRight: 24 }, "paddingTop");
  });
  it("keeps marginRight metadata scoped and preserves sibling Linked values", () => {
    exercise("margin-right", { marginRight: 24, marginLeft: 12 }, "marginRight");
  });
  it("resets margin shorthand without materializing individual margins", () => {
    exercise("margin", { margin: 24 }, "margin");
  });
});
