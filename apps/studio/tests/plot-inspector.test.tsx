// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import type { PlotElement } from "@powershow/document-schema";

import { PlotInspector } from "../src/features/editor/inspector/plot-inspector";
import { StudioI18nProvider } from "../src/features/i18n/studio-i18n-context";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

describe("Plot source Inspector", () => {
  let host: HTMLDivElement;
  let root: Root;
  let current: PlotElement;

  beforeEach(() => {
    host = document.createElement("div");
    document.body.appendChild(host);
    root = createRoot(host);
    current = { id: "plot-1", type: "chart", hidden: false, source: "y = x^2" };
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    document.body.innerHTML = "";
  });

  function renderInspector(): void {
    root.render(
      <StudioI18nProvider>
        <PlotInspector
          element={current}
          onUpdate={(update) => {
            const next = update(current);
            current = next.type === "chart" ? next : current;
            renderInspector();
          }}
        />
      </StudioI18nProvider>,
    );
  }

  function changeSource(source: string): void {
    const textarea = host.querySelector<HTMLTextAreaElement>("#plot-source");
    if (!textarea) throw new Error("Plot source textarea not found");
    Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")?.set?.call(textarea, source);
    textarea.dispatchEvent(new Event("change", { bubbles: true }));
  }

  function changeFitToAxes(checked: boolean): void {
    const checkbox = host.querySelector<HTMLInputElement>("#plot-fit-to-axes");
    if (!checkbox) throw new Error("Plot fit-to-axes checkbox not found");
    if (checkbox.checked !== checked) {
      checkbox.click();
    }
  }

  it.each([
    [undefined, true],
    [true, true],
    [false, false],
  ] as const)("renders fit-to-axes %j as checked=%j", async (fitToAxes, checked) => {
    current = {
      id: "plot-1",
      type: "chart",
      hidden: false,
      source: "y = x^2",
      ...(fitToAxes === undefined ? {} : { fitToAxes }),
    };

    await act(async () => renderInspector());

    expect(host.querySelector<HTMLInputElement>("#plot-fit-to-axes")?.checked).toBe(checked);
  });

  it("toggles fitToAxes without changing source", async () => {
    await act(async () => renderInspector());

    const checkbox = host.querySelector<HTMLInputElement>("#plot-fit-to-axes");
    expect(checkbox?.checked).toBe(true);

    await act(async () => changeFitToAxes(false));
    expect(current).toEqual({ id: "plot-1", type: "chart", hidden: false, source: "y = x^2", fitToAxes: false });

    await act(async () => changeFitToAxes(true));
    expect(current).toEqual({ id: "plot-1", type: "chart", hidden: false, source: "y = x^2", fitToAxes: true });

    await act(async () => changeSource("y = sin(x)"));
    expect(current.fitToAxes).toBe(true);
  });

  it("edits only canonical source, preserving multiline and empty values", async () => {
    await act(async () => renderInspector());

    const textarea = host.querySelector<HTMLTextAreaElement>("#plot-source");
    expect(textarea?.value).toBe("y = x^2");
    expect(textarea?.maxLength).toBe(4096);
    expect(textarea?.getAttribute("spellcheck")).toBe("false");

    await act(async () => changeSource("y = sin(x)"));
    expect(current.source).toBe("y = sin(x)");
    expect(current).toEqual({ id: "plot-1", type: "chart", hidden: false, source: "y = sin(x)" });

    const multiline = "y = sin(x)\ny = x^2";
    await act(async () => changeSource(multiline));
    expect(current.source).toBe(multiline);

    await act(async () => changeSource(""));
    expect(current.source).toBe("");
  });
});
