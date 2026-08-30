// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { PresentationSchema, type ContainerElement, type Presentation } from "@powershow/document-schema";
import { ContainerInspector } from "../src/features/editor/inspector/container-inspector";
import { StudioI18nProvider } from "../src/features/i18n/studio-i18n-context";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

function changeSelect(select: HTMLSelectElement, value: string) {
  select.value = value;
  select.dispatchEvent(new Event("change", { bubbles: true }));
}

describe("Linked Container layout override UI", () => {
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

  function resetFor(id: string) {
    return host.querySelector(`#${id}`)?.closest("label")?.nextElementSibling?.querySelector("button") as HTMLButtonElement | null;
  }

  it("persists and resets an explicit flow override over Linked stack", () => {
    presentation = PresentationSchema.parse({ schemaVersion: 1, id: "p", title: "P", slides: [{ id: "s", title: "S", elements: [] }], linkedStyles: [{ id: "linked", name: "Linked", layout: { children: { mode: "stack" } } }] });
    state = { id: "c", type: "container", hidden: false, linkedStyleId: "linked", children: [] };
    act(render);
    act(() => changeSelect(host.querySelector("#container-layout-mode")!, "flow"));
    expect(state.layout?.children?.mode).toBe("flow");
    expect(host.textContent).toContain("Local override");
    act(() => resetFor("container-layout-mode")?.click());
    expect(state.layout?.children?.mode).toBeUndefined();
  });

  it("persists and resets explicit direction and packed distribution overrides", () => {
    presentation = PresentationSchema.parse({ schemaVersion: 1, id: "p", title: "P", slides: [{ id: "s", title: "S", elements: [] }], linkedStyles: [{ id: "linked", name: "Linked", layout: { children: { direction: "row", distribution: "space-between" } } }] });
    state = { id: "c", type: "container", hidden: false, linkedStyleId: "linked", children: [] };
    act(render);
    act(() => changeSelect(host.querySelector("#container-direction")!, "column"));
    act(() => changeSelect(host.querySelector("#container-distribution")!, "packed"));
    expect(state.layout?.children?.direction).toBe("column");
    expect(state.layout?.children?.distribution).toBe("packed");
    act(() => resetFor("container-direction")?.click());
    expect(state.layout?.children?.direction).toBeUndefined();
    act(() => resetFor("container-distribution")?.click());
    expect(state.layout?.children?.distribution).toBeUndefined();
    expect(presentation.linkedStyles?.[0]?.layout?.children?.distribution).toBe("space-between");
  });
});
