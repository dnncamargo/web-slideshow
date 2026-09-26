// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { PresentationSchema, type CodeElement, type Presentation } from "@web-slideshow/document-schema";
import { StudioI18nProvider } from "../src/features/i18n/studio-i18n-context";
import { AuthoringHistoryContext, type AuthoringHistoryContextValue } from "../src/features/editor/authoring-history-context";
import { CodeInspector } from "../src/features/editor/inspector/code-inspector";
import { ElementInspector } from "../src/features/editor/element-inspector";
import { inspectTargetLinkedStyle } from "../src/features/editor/inspector/linked-style-inspector";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

function historySpies(): AuthoringHistoryContextValue & {
  begin: ReturnType<typeof vi.fn>;
  update: ReturnType<typeof vi.fn>;
  finish: ReturnType<typeof vi.fn>;
  discrete: ReturnType<typeof vi.fn>;
} {
  return {
    begin: vi.fn(),
    update: vi.fn(),
    finish: vi.fn(),
    discrete: vi.fn(),
  };
}

function codeElement(): CodeElement {
  return {
    id: "code-target",
    type: "code",
    hidden: false,
    code: "const value = 1;",
    language: "typescript",
    showLineNumbers: true,
    highlightedLines: [],
    linkedStyleId: "code-owned",
    layout: { position: "absolute", left: 40, width: 240, height: 120 },
  };
}

function presentation(elements: Presentation["slides"][number]["elements"]): Presentation {
  return PresentationSchema.parse({
    schemaVersion: 1,
    id: "lsx3b2-disabled-history",
    title: "Disabled history",
    slides: [{ id: "slide", title: "Slide", elements }],
    linkedStyles: [
      {
        target: "code",
        id: "code-owned",
        name: "Owned code",
        layout: { position: "absolute", top: 24 },
        style: {
          background: {
            gradient: {
              type: "linear",
              angle: 45,
              stops: [{ color: "#111111", position: 0 }, { color: "#eeeeee", position: 100 }],
            },
          },
          border: { width: 3, style: "solid", color: "#123456" },
        },
      },
      {
        target: "divider",
        id: "divider-owned",
        name: "Owned divider",
        style: {
          background: { color: "#123456" },
        },
      },
    ],
  });
}

function dispatchSyntheticNumericInteraction(control: HTMLInputElement): void {
  control.focus();
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
  if (!setter) throw new Error("missing input value setter");
  setter.call(control, `${Number(control.value || 0) + 1}`);
  control.dispatchEvent(new Event("input", { bubbles: true }));
  control.dispatchEvent(new Event("change", { bubbles: true }));
  control.blur();
}

describe("LSX3B2 exact disabled History integration", () => {
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

  it("guards the canonical absolute top edge with the real History context", async () => {
    const initial = presentation([codeElement()]);
    const element = initial.slides[0]!.elements[0]!;
    if (element.type !== "code") throw new Error("expected Code element");
    expect(inspectTargetLinkedStyle(initial, element).getProperty("layout.top").owned).toBe(true);
    const history = historySpies();
    const update = vi.fn();
    await act(async () => root.render(
      <StudioI18nProvider>
        <AuthoringHistoryContext.Provider value={history}>
          <ElementInspector
            element={element}
            onUpdate={update}
            onContainerFitModeChange={() => true}
            fontResources={[]}
            presentation={initial}
            preserveImageProportion={false}
            onPreserveImageProportionChange={() => {}}
            focalEditingImageId={null}
            onFocalEditingImageIdChange={() => {}}
            parent={null}
            layerControls={{ index: 0, count: 1, onMoveTo: () => {} }}
            topicsAuthoringControls={{ onAddTopLevelTopic: () => null, onAddChildTopic: () => null }}
            tableAuthoringControls={{ onAddColumn: () => {}, onRemoveColumn: () => {}, onAddRow: () => {}, onRemoveRow: () => {}, onShowHeaderChange: () => {} }}
          />
        </AuthoringHistoryContext.Provider>
      </StudioI18nProvider>,
    ));

    const top = host.querySelector<HTMLInputElement>("#element-canonical-top");
    if (!top) throw new Error("canonical top control was not rendered");
    expect(top.disabled).toBe(true);
    expect(top.value).toBe("24");

    await act(async () => dispatchSyntheticNumericInteraction(top));
    expect(top.value).toBe("24");
    expect(update).not.toHaveBeenCalled();
    expect(history.begin).not.toHaveBeenCalled();
    expect(history.update).not.toHaveBeenCalled();
    expect(history.finish).not.toHaveBeenCalled();
    expect(history.discrete).not.toHaveBeenCalled();
  });

  it("guards Gradient angle and stop position with the real History context", async () => {
    const element = codeElement();
    const history = historySpies();
    const update = vi.fn();
    await act(async () => root.render(
      <StudioI18nProvider>
        <AuthoringHistoryContext.Provider value={history}>
          <CodeInspector
            element={element}
            onUpdate={update}
            presentation={presentation([element])}
            fontResources={[]}
          />
        </AuthoringHistoryContext.Provider>
      </StudioI18nProvider>,
    ));

    const angle = host.querySelector<HTMLInputElement>("#code-background-gradient-angle");
    const stop = host.querySelector<HTMLInputElement>("#code-background-gradient-stop-0-position");
    if (!angle || !stop) throw new Error("gradient numeric controls were not rendered");
    expect(angle.disabled).toBe(true);
    expect(stop.disabled).toBe(true);
    await act(async () => {
      dispatchSyntheticNumericInteraction(angle);
      dispatchSyntheticNumericInteraction(stop);
    });
    expect(update).not.toHaveBeenCalled();
    expect(history.begin).not.toHaveBeenCalled();
    expect(history.update).not.toHaveBeenCalled();
    expect(history.finish).not.toHaveBeenCalled();
    expect(history.discrete).not.toHaveBeenCalled();
  });

  it("guards Border width with the real History context", async () => {
    const element = codeElement();
    const history = historySpies();
    const update = vi.fn();
    await act(async () => root.render(
      <StudioI18nProvider>
        <AuthoringHistoryContext.Provider value={history}>
          <CodeInspector
            element={element}
            onUpdate={update}
            presentation={presentation([element])}
            fontResources={[]}
          />
        </AuthoringHistoryContext.Provider>
      </StudioI18nProvider>,
    ));

    const width = host.querySelector<HTMLInputElement>("#code-border-width");
    if (!width) throw new Error("border width control was not rendered");
    expect(width.disabled).toBe(true);
    await act(async () => dispatchSyntheticNumericInteraction(width));
    expect(update).not.toHaveBeenCalled();
    expect(history.begin).not.toHaveBeenCalled();
    expect(history.update).not.toHaveBeenCalled();
    expect(history.finish).not.toHaveBeenCalled();
    expect(history.discrete).not.toHaveBeenCalled();
  });

});
