// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  PresentationSchema,
  type PlotElement,
  type PlotVisualStyle,
  type Presentation,
} from "@powershow/document-schema";

import {
  AuthoringHistoryContext,
  type AuthoringHistoryContextValue,
} from "../src/features/editor/authoring-history-context";
import { EditorWorkspace } from "../src/features/editor/editor-workspace";
import { PlotInspector } from "../src/features/editor/inspector/plot-inspector";
import { StudioI18nProvider } from "../src/features/i18n/studio-i18n-context";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

const PLOT_ID = "cp4c3c-plot";

function plotElement(overrides: Partial<Omit<PlotElement, "id" | "type" | "hidden">> = {}): PlotElement {
  return {
    id: PLOT_ID,
    type: "plot",
    hidden: false,
    source: "y = x^2",
    ...overrides,
  };
}

function presentation(element = plotElement()): Presentation {
  return PresentationSchema.parse({
    schemaVersion: 1,
    id: "cp4c3c-plot-axis-history",
    title: "CP4C3C Plot axis history",
    slides: [{
      id: "slide-1",
      title: "Slide 1",
      elements: [element],
    }],
  });
}

function key(value: string, options: KeyboardEventInit = {}): KeyboardEvent {
  return new KeyboardEvent("keydown", {
    key: value,
    bubbles: true,
    cancelable: true,
    ...options,
  });
}

function setInputValue(control: HTMLInputElement | HTMLTextAreaElement, value: string): void {
  const prototype = control instanceof HTMLTextAreaElement
    ? HTMLTextAreaElement.prototype
    : HTMLInputElement.prototype;
  const setter = Object.getOwnPropertyDescriptor(prototype, "value")?.set;
  if (!setter) throw new Error("expected text control value setter");
  setter.call(control, value);
  control.dispatchEvent(new Event("input", { bubbles: true }));
}

function forceInputValue(control: HTMLInputElement, value: string): void {
  Object.defineProperty(control, "value", {
    configurable: true,
    enumerable: true,
    writable: true,
    value,
  });
  control.dispatchEvent(new Event("input", { bubbles: true }));
}

describe("CP4C3C Plot axis stroke width and opacity history", () => {
  let host: HTMLDivElement;
  let root: Root;
  let current: PlotElement;
  let updateCount: number;
  let metas: Array<{ kind: string; labelKey: string }>;
  let historyValue: AuthoringHistoryContextValue | null;

  beforeEach(() => {
    host = document.createElement("div");
    document.body.appendChild(host);
    root = createRoot(host);
    current = plotElement();
    updateCount = 0;
    metas = [];
    historyValue = null;
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    document.body.innerHTML = "";
  });

  function renderDirectTree(): void {
    const inspector = (
      <PlotInspector
        element={current}
        onUpdate={(update) => {
          updateCount += 1;
          current = update(current) as PlotElement;
          renderDirectTree();
        }}
      />
    );
    root.render(
      <StudioI18nProvider>
        {historyValue === null ? inspector : (
          <AuthoringHistoryContext.Provider value={historyValue}>
            {inspector}
          </AuthoringHistoryContext.Provider>
        )}
      </StudioI18nProvider>,
    );
  }

  async function mountDirect(
    initial = plotElement(),
    withHistory = false,
  ): Promise<void> {
    current = initial;
    updateCount = 0;
    metas = [];
    historyValue = withHistory
      ? {
        begin: () => undefined,
        update: (_key, callback) => callback(),
        finish: () => undefined,
        discrete: (meta, callback) => {
          metas.push(meta);
          callback();
        },
      }
      : null;
    await act(async () => renderDirectTree());
  }

  async function mountWorkspace(initial = presentation()): Promise<void> {
    await act(async () => root.render(
      <StudioI18nProvider>
        <EditorWorkspace initialPresentation={initial} />
      </StudioI18nProvider>,
    ));
  }

  function input(id: "plot-axis-stroke-width" | "plot-axis-opacity"): HTMLInputElement {
    const control = host.querySelector<HTMLInputElement>(`#${id}`);
    if (!control) throw new Error(`${id} was not rendered`);
    return control;
  }

  function textarea(id: "plot-source"): HTMLTextAreaElement {
    const control = host.querySelector<HTMLTextAreaElement>(`#${id}`);
    if (!control) throw new Error(`${id} was not rendered`);
    return control;
  }

  async function editDirect(
    id: "plot-axis-stroke-width" | "plot-axis-opacity",
    value: string,
    force = false,
  ): Promise<void> {
    const control = input(id);
    await act(async () => {
      control.focus();
      if (force) forceInputValue(control, value);
      else setInputValue(control, value);
      control.blur();
    });
  }

  async function editWorkspace(
    id: "plot-axis-stroke-width" | "plot-axis-opacity",
    value: string,
  ): Promise<void> {
    const control = input(id);
    await act(async () => {
      control.focus();
      setInputValue(control, value);
      control.blur();
    });
  }

  async function selectPlot(): Promise<void> {
    const element = host.querySelector<HTMLElement>(`[data-powershow-id="${PLOT_ID}"]`);
    if (!element) throw new Error("Plot element was not rendered");
    await act(async () => element.dispatchEvent(new Event("pointerdown", { bubbles: true })));
  }

  async function undo(): Promise<KeyboardEvent> {
    const event = key("z", { ctrlKey: true });
    await act(async () => window.dispatchEvent(event));
    return event;
  }

  async function redo(): Promise<KeyboardEvent> {
    const event = key("z", { ctrlKey: true, shiftKey: true });
    await act(async () => window.dispatchEvent(event));
    return event;
  }

  it("hydrates both drafts from canonical axes values", async () => {
    await mountDirect(plotElement({ style: { axes: { strokeWidth: 2, opacity: 0.5 } } }));

    expect(input("plot-axis-stroke-width").value).toBe("2");
    expect(input("plot-axis-opacity").value).toBe("50");
    expect(updateCount).toBe(0);
  });

  it("keeps stroke typing local, with Enter and Escape also leaving it uncommitted", async () => {
    await mountDirect(plotElement({ style: { axes: { strokeWidth: 2 } } }), true);
    const control = input("plot-axis-stroke-width");

    await act(async () => {
      control.focus();
      setInputValue(control, "3");
      control.dispatchEvent(key("Enter"));
      control.dispatchEvent(key("Escape"));
    });

    expect(control.value).toBe("3");
    expect(current.style?.axes?.strokeWidth).toBe(2);
    expect(updateCount).toBe(0);
    expect(metas).toEqual([]);

    await act(async () => control.blur());
    expect(current.style?.axes?.strokeWidth).toBe(3);
  });

  it("records a real stroke blur with number.change metadata and one update", async () => {
    await mountDirect(plotElement({ style: { axes: { strokeWidth: 2 } } }), true);

    await editDirect("plot-axis-stroke-width", "3");

    expect(current.style?.axes?.strokeWidth).toBe(3);
    expect(updateCount).toBe(1);
    expect(metas).toEqual([{ kind: "number.change", labelKey: "history.number.change" }]);
  });

  it("replays one stroke-width action through undo and redo", async () => {
    await mountWorkspace(presentation(plotElement({ style: { axes: { strokeWidth: 2 } } })));
    await selectPlot();

    await editWorkspace("plot-axis-stroke-width", "3");
    expect(input("plot-axis-stroke-width").value).toBe("3");

    const undoEvent = await undo();
    expect(undoEvent.defaultPrevented).toBe(true);
    expect(input("plot-axis-stroke-width").value).toBe("2");

    const redoEvent = await redo();
    expect(redoEvent.defaultPrevented).toBe(true);
    expect(input("plot-axis-stroke-width").value).toBe("3");
  });

  it("treats stroke 2.0 as a same-canonical no-op", async () => {
    await mountDirect(plotElement({ style: { axes: { strokeWidth: 2 } } }), true);

    await editDirect("plot-axis-stroke-width", "2.0");

    expect(current.style).toEqual({ axes: { strokeWidth: 2 } });
    expect(input("plot-axis-stroke-width").value).toBe("2.0");
    expect(updateCount).toBe(0);
    expect(metas).toEqual([]);
  });

  it("keeps invalid stroke drafts typed without canonical writes or history", async () => {
    for (const value of ["0", "-1", "abc", "Infinity"]) {
      await mountDirect(plotElement({ style: { axes: { strokeWidth: 2 } } }), true);
      await editDirect("plot-axis-stroke-width", value);

      expect(current.style).toEqual({ axes: { strokeWidth: 2 } });
      expect(input("plot-axis-stroke-width").value).toBe(value);
      expect(updateCount).toBe(0);
      expect(metas).toEqual([]);
    }
  });

  it("clears stroke while preserving axis siblings through undo and redo", async () => {
    await mountWorkspace(presentation(plotElement({
      style: { axes: { color: "#ff0000", strokeWidth: 2, opacity: 0.5 } },
    })));
    await selectPlot();

    await editWorkspace("plot-axis-stroke-width", "");
    expect(input("plot-axis-stroke-width").value).toBe("");
    expect(input("plot-axis-opacity").value).toBe("50");
    expect(host.querySelector<HTMLInputElement>("#plot-axis-color-value")?.value).toBe("#ff0000");

    await undo();
    expect(input("plot-axis-stroke-width").value).toBe("2");
    expect(input("plot-axis-opacity").value).toBe("50");
    expect(host.querySelector<HTMLInputElement>("#plot-axis-color-value")?.value).toBe("#ff0000");

    await redo();
    expect(input("plot-axis-stroke-width").value).toBe("");
    expect(input("plot-axis-opacity").value).toBe("50");
  });

  it("collapses a stroke-only style to undefined and restores it through undo and redo", async () => {
    await mountWorkspace(presentation(plotElement({ style: { axes: { strokeWidth: 2 } } })));
    await selectPlot();

    await editWorkspace("plot-axis-stroke-width", "");
    expect(input("plot-axis-stroke-width").value).toBe("");
    expect(input("plot-axis-opacity").value).toBe("");

    await undo();
    expect(input("plot-axis-stroke-width").value).toBe("2");
    await redo();
    expect(input("plot-axis-stroke-width").value).toBe("");
  });

  it("does not create history when stroke is already absent", async () => {
    await mountDirect(plotElement({ style: { axes: { color: "#ff0000" } } }), true);

    await editDirect("plot-axis-stroke-width", "");

    expect(current.style).toEqual({ axes: { color: "#ff0000" } });
    expect(updateCount).toBe(0);
    expect(metas).toEqual([]);
  });

  it("keeps opacity typing local until blur", async () => {
    await mountDirect(plotElement({ style: { axes: { opacity: 0.5 } } }), true);
    const control = input("plot-axis-opacity");

    await act(async () => {
      control.focus();
      setInputValue(control, "75");
    });

    expect(control.value).toBe("75");
    expect(current.style?.axes?.opacity).toBe(0.5);
    expect(updateCount).toBe(0);
    expect(metas).toEqual([]);

    await act(async () => control.blur());
    expect(current.style?.axes?.opacity).toBe(0.75);
  });

  it("records a real opacity blur with number.change metadata", async () => {
    await mountDirect(plotElement({ style: { axes: { opacity: 0.5 } } }), true);

    await editDirect("plot-axis-opacity", "75");

    expect(current.style?.axes?.opacity).toBe(0.75);
    expect(updateCount).toBe(1);
    expect(metas).toEqual([{ kind: "number.change", labelKey: "history.number.change" }]);
  });

  it("replays one opacity action through undo and redo", async () => {
    await mountWorkspace(presentation(plotElement({ style: { axes: { opacity: 0.5 } } })));
    await selectPlot();

    await editWorkspace("plot-axis-opacity", "75");
    expect(input("plot-axis-opacity").value).toBe("75");

    const undoEvent = await undo();
    expect(undoEvent.defaultPrevented).toBe(true);
    expect(input("plot-axis-opacity").value).toBe("50");

    const redoEvent = await redo();
    expect(redoEvent.defaultPrevented).toBe(true);
    expect(input("plot-axis-opacity").value).toBe("75");
  });

  it("preserves authored opacity boundaries 0 and 100", async () => {
    await mountDirect(plotElement({ style: { axes: { color: "#ff0000" } } }), true);

    await editDirect("plot-axis-opacity", "0");
    expect(current.style).toEqual({ axes: { color: "#ff0000", opacity: 0 } });

    await editDirect("plot-axis-opacity", "100");
    expect(current.style).toEqual({ axes: { color: "#ff0000", opacity: 1 } });
  });

  it("treats opacity 50.0 as a same-canonical no-op", async () => {
    await mountDirect(plotElement({ style: { axes: { opacity: 0.5 } } }), true);

    await editDirect("plot-axis-opacity", "50.0");

    expect(current.style).toEqual({ axes: { opacity: 0.5 } });
    expect(input("plot-axis-opacity").value).toBe("50.0");
    expect(updateCount).toBe(0);
    expect(metas).toEqual([]);
  });

  it("keeps invalid opacity drafts typed without canonical writes or history", async () => {
    for (const [value, force] of [["-1", false], ["101", false], ["bad", true]] as const) {
      await mountDirect(plotElement({ style: { axes: { opacity: 0.5 } } }), true);
      await editDirect("plot-axis-opacity", value, force);

      expect(current.style).toEqual({ axes: { opacity: 0.5 } });
      expect(input("plot-axis-opacity").value).toBe(value);
      expect(updateCount).toBe(0);
      expect(metas).toEqual([]);
    }
  });

  it("clears opacity while preserving axis siblings through undo and redo", async () => {
    await mountWorkspace(presentation(plotElement({
      style: { axes: { color: "#ff0000", strokeWidth: 2, opacity: 0.5 } },
    })));
    await selectPlot();

    await editWorkspace("plot-axis-opacity", "");
    expect(input("plot-axis-opacity").value).toBe("");
    expect(input("plot-axis-stroke-width").value).toBe("2");
    expect(host.querySelector<HTMLInputElement>("#plot-axis-color-value")?.value).toBe("#ff0000");

    await undo();
    expect(input("plot-axis-opacity").value).toBe("50");
    expect(input("plot-axis-stroke-width").value).toBe("2");

    await redo();
    expect(input("plot-axis-opacity").value).toBe("");
    expect(input("plot-axis-stroke-width").value).toBe("2");
  });

  it("collapses an opacity-only style to undefined and restores it through undo and redo", async () => {
    await mountWorkspace(presentation(plotElement({ style: { axes: { opacity: 0.5 } } })));
    await selectPlot();

    await editWorkspace("plot-axis-opacity", "");
    expect(input("plot-axis-opacity").value).toBe("");

    await undo();
    expect(input("plot-axis-opacity").value).toBe("50");
    await redo();
    expect(input("plot-axis-opacity").value).toBe("");
  });

  it("keeps stroke and opacity as separate actions", async () => {
    await mountWorkspace(presentation(plotElement({
      style: { axes: { strokeWidth: 2, opacity: 0.5 } },
    })));
    await selectPlot();

    await editWorkspace("plot-axis-stroke-width", "3");
    await editWorkspace("plot-axis-opacity", "75");

    await undo();
    expect(input("plot-axis-stroke-width").value).toBe("3");
    expect(input("plot-axis-opacity").value).toBe("50");
    await undo();
    expect(input("plot-axis-stroke-width").value).toBe("2");
    expect(input("plot-axis-opacity").value).toBe("50");

    await redo();
    expect(input("plot-axis-stroke-width").value).toBe("3");
    expect(input("plot-axis-opacity").value).toBe("50");
    await redo();
    expect(input("plot-axis-opacity").value).toBe("75");
  });

  it("keeps Plot source history separate from a following axis action", async () => {
    await mountWorkspace(presentation(plotElement({ style: { axes: { strokeWidth: 2 } } })));
    await selectPlot();

    const source = textarea("plot-source");
    await act(async () => {
      source.focus();
      setInputValue(source, "y = sin(x)");
      source.blur();
    });
    await editWorkspace("plot-axis-stroke-width", "3");

    await undo();
    expect(textarea("plot-source").value).toBe("y = sin(x)");
    expect(input("plot-axis-stroke-width").value).toBe("2");
    await undo();
    expect(textarea("plot-source").value).toBe("y = x^2");
  });

  it("supports real commits, no-ops, invalid drafts, and pruning without a History provider", async () => {
    await mountDirect(plotElement({
      style: { axes: { color: "#ff0000", strokeWidth: 2, opacity: 0.5 } },
    }));

    await editDirect("plot-axis-stroke-width", "3");
    expect(current.style?.axes?.strokeWidth).toBe(3);
    await editDirect("plot-axis-opacity", "75");
    expect(current.style?.axes?.opacity).toBe(0.75);
    await editDirect("plot-axis-stroke-width", "3.0");
    expect(updateCount).toBe(2);
    await editDirect("plot-axis-stroke-width", "-1");
    expect(current.style?.axes?.strokeWidth).toBe(3);
    expect(input("plot-axis-stroke-width").value).toBe("-1");
    expect(updateCount).toBe(2);
    await editDirect("plot-axis-opacity", "");
    expect(current.style).toEqual({ axes: { color: "#ff0000", strokeWidth: 3 } });
    await editDirect("plot-axis-stroke-width", "");
    expect(current.style).toEqual({ axes: { color: "#ff0000" } });
    expect(metas).toEqual([]);
  });

  it("preserves unrelated Plot fields and style while changing stroke width", async () => {
    const style: PlotVisualStyle = {
      color: "#00aa00",
      background: { color: "#112233" },
      zGradient: { minColor: "#7c3aed", maxColor: "#06b6d4" },
      axes: { color: "#ff00aa", opacity: 0.5, strokeWidth: 2 },
    };
    await mountDirect(plotElement({
      source: "z = x + y",
      fitToAxes: false,
      showAxes: false,
      layout: { width: 320, height: 180 },
      animation: { parameter: "t", from: 0, to: 1, durationMs: 1000 },
      style,
    }), true);

    await editDirect("plot-axis-stroke-width", "3");

    expect(current).toEqual(plotElement({
      source: "z = x + y",
      fitToAxes: false,
      showAxes: false,
      layout: { width: 320, height: 180 },
      animation: { parameter: "t", from: 0, to: 1, durationMs: 1000 },
      style: {
        color: "#00aa00",
        background: { color: "#112233" },
        zGradient: { minColor: "#7c3aed", maxColor: "#06b6d4" },
        axes: { color: "#ff00aa", opacity: 0.5, strokeWidth: 3 },
      },
    }));
  });

  it("records normalization side effects as the same axis action", async () => {
    await mountDirect(plotElement({ style: { background: {}, axes: { strokeWidth: 2 } } }), true);

    await editDirect("plot-axis-stroke-width", "2.0");

    expect(current.style).toEqual({ axes: { strokeWidth: 2 } });
    expect(updateCount).toBe(1);
    expect(metas).toEqual([{ kind: "number.change", labelKey: "history.number.change" }]);
  });
});
