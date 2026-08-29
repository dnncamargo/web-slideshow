// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import type { ContainerElement, PowerShowElement } from "@powershow/document-schema";

import { ContainerInspector } from "../src/features/editor/inspector/container-inspector";
import { StudioI18nProvider } from "../src/features/i18n/studio-i18n-context";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

function containerElement(overflow?: "visible" | "hidden" | "auto"): ContainerElement {
  return {
    type: "container",
    id: "container-overflow",
    hidden: false,
    children: [],
    layout: {
      width: "80%",
      height: 300,
      padding: 24,
      position: "absolute",
      top: 10,
      left: 20,
      ...(overflow ? { overflow } : {}),
      children: {
        mode: "flow",
        direction: "row",
        gap: 16,
        distribution: "space-between",
        verticalAlign: "center",
      },
    },
  };
}

function changeSelect(select: HTMLSelectElement, value: string): void {
  select.value = value;
  select.dispatchEvent(new Event("change", { bubbles: true }));
}

describe("Container overflow inspector", () => {
  let host: HTMLDivElement;
  let root: Root;
  let state: PowerShowElement;

  function renderInspector(): void {
    root.render(
      <StudioI18nProvider>
        {state.type === "container" && (
          <ContainerInspector
            element={state}
            onUpdate={(update) => {
              state = update(state);
              renderInspector();
            }}
            onContainerFitModeChange={() => true}
          />
        )}
      </StudioI18nProvider>,
    );
  }

  function mount(overflow?: "visible" | "hidden" | "auto"): HTMLSelectElement {
    state = containerElement(overflow);
    act(renderInspector);
    const select = host.querySelector<HTMLSelectElement>("#container-overflow");
    if (!select) throw new Error("Container overflow select not found");
    return select;
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

  it("renders the canonical overflow choices and reflects authored values", () => {
    expect(mount().value).toBe("");
    expect(Array.from(host.querySelectorAll("#container-overflow option"), (option) => option.textContent)).toEqual([
      "Default (visible)",
      "Visible",
      "Hidden",
      "Auto",
    ]);
    expect(mount("visible").value).toBe("visible");
    expect(mount("hidden").value).toBe("hidden");
    expect(mount("auto").value).toBe("auto");
  });

  it.each([
    ["hidden", "hidden"],
    ["auto", "auto"],
    ["visible", "visible"],
  ] as const)("authors %s on container.layout.overflow", (value, expected) => {
    const select = mount();
    act(() => changeSelect(select, value));

    expect(state).toMatchObject({ layout: { overflow: expected } });
    expect(state.type).toBe("container");
    expect((state as ContainerElement).layout?.children).toMatchObject({
      mode: "flow",
      direction: "row",
      gap: 16,
      distribution: "space-between",
      verticalAlign: "center",
    });
  });

  it("removes the authored overflow when Default is selected and preserves layout", () => {
    const select = mount("hidden");
    act(() => changeSelect(select, ""));

    expect(state.type).toBe("container");
    const layout = (state as ContainerElement).layout;
    expect(layout?.overflow).toBeUndefined();
    expect(layout).toMatchObject({
      width: "80%",
      height: 300,
      padding: 24,
      position: "absolute",
      top: 10,
      left: 20,
    });
    expect(layout?.children).toMatchObject({
      mode: "flow",
      direction: "row",
      gap: 16,
      distribution: "space-between",
      verticalAlign: "center",
    });
  });
});
