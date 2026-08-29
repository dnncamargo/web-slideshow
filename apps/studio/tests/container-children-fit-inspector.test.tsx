// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { ContainerElement } from "@powershow/document-schema";

import { ContainerInspector } from "../src/features/editor/inspector/container-inspector";
import { translateStudioMessage } from "../src/features/i18n/studio-i18n";
import { StudioI18nProvider } from "../src/features/i18n/studio-i18n-context";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

function container(layout?: ContainerElement["layout"]): ContainerElement {
  return {
    id: "container-fit",
    type: "container",
    hidden: false,
    children: [],
    ...(layout === undefined ? {} : { layout }),
  };
}

function changeSelect(select: HTMLSelectElement, value: string): void {
  select.value = value;
  select.dispatchEvent(new Event("change", { bubbles: true }));
}

describe("Container children fit Inspector", () => {
  let host: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    host = document.createElement("div");
    document.body.appendChild(host);
    root = createRoot(host);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    document.body.innerHTML = "";
  });

  function mount(
    element: ContainerElement,
    callback = vi.fn(() => true),
  ): { select: HTMLSelectElement; callback: ReturnType<typeof vi.fn> } {
    act(() => {
      root.render(
        <StudioI18nProvider>
          <ContainerInspector
            element={element}
            onUpdate={(update) => update(element)}
            onContainerFitModeChange={callback}
          />
        </StudioI18nProvider>,
      );
    });
    const select = host.querySelector<HTMLSelectElement>("#container-children-fit");
    if (!select) throw new Error("Children fit select not found");
    return { select, callback };
  }

  it("renders localized options and reflects the canonical mode", () => {
    expect(mount(container()).select.value).toBe("");
    expect(Array.from(host.querySelectorAll("#container-children-fit option"), (option) => option.textContent)).toEqual([
      "None", "Contain", "Cover", "Fill",
    ]);
    expect(mount(container({ children: { fit: { mode: "cover", sourceWidth: 800, sourceHeight: 400 } } })).select.value).toBe("cover");
  });

  it("reports mode changes and None through the authoring callback", () => {
    const callback = vi.fn(() => true);
    const { select } = mount(container(), callback);
    act(() => changeSelect(select, "contain"));
    act(() => changeSelect(select, ""));

    expect(callback).toHaveBeenNthCalledWith(1, "contain");
    expect(callback).toHaveBeenNthCalledWith(2, null);
  });

  it("shows non-blocking feedback when activation is rejected and clears it on success/None", () => {
    const callback = vi.fn()
      .mockReturnValueOnce(false)
      .mockReturnValueOnce(true)
      .mockReturnValueOnce(true);
    const { select } = mount(container(), callback);
    act(() => changeSelect(select, "contain"));
    expect(host.textContent).toContain("Container must have a measurable content size");
    act(() => changeSelect(select, "fill"));
    expect(host.textContent).not.toContain("Container must have a measurable content size");
    act(() => changeSelect(select, ""));
    expect(host.textContent).not.toContain("Container must have a measurable content size");
  });

  it("clears a rejected activation error when the selected Container changes", () => {
    const callback = vi.fn(() => false);
    const { select } = mount(container(), callback);
    act(() => changeSelect(select, "contain"));
    expect(host.textContent).toContain("Container must have a measurable content size");

    act(() => {
      root.render(
        <StudioI18nProvider>
          <ContainerInspector
            element={{ ...container(), id: "container-b" }}
            onUpdate={(update) => update({ ...container(), id: "container-b" })}
            onContainerFitModeChange={callback}
          />
        </StudioI18nProvider>,
      );
    });

    expect(host.textContent).not.toContain("Container must have a measurable content size");
  });

  it("provides Portuguese translations for the fit controls", () => {
    expect(translateStudioMessage("pt-BR", "inspector.childrenFit")).toBe(
      "Ajuste dos filhos",
    );
    expect(translateStudioMessage("pt-BR", "inspector.childrenFit.cover")).toBe(
      "Cobrir",
    );
  });
});
