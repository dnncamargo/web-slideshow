// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { PresentationSchema, type Presentation } from "@powershow/document-schema";
import { HistoryPanel } from "../src/features/editor/clipboard-panel";
import type { HistoryActionMeta } from "../src/features/editor/editor-history-state";
import { EditorWorkspace } from "../src/features/editor/editor-workspace";
import { StudioI18nProvider, useStudioI18n } from "../src/features/i18n/studio-i18n-context";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

function presentation(): Presentation {
  return PresentationSchema.parse({
    schemaVersion: 1,
    id: "history-panel",
    title: "History panel",
    slides: [{
      id: "slide-1",
      title: "Slide 1",
      elements: [],
    }],
  });
}

function key(keyValue: string, options: KeyboardEventInit = {}): KeyboardEvent {
  return new KeyboardEvent("keydown", {
    key: keyValue,
    bubbles: true,
    cancelable: true,
    ...options,
  });
}

function buttonByText(container: HTMLElement, text: string): HTMLButtonElement {
  const button = Array.from(container.querySelectorAll<HTMLButtonElement>("button"))
    .find((candidate) => candidate.textContent?.includes(text));

  if (!button) throw new Error(`Button not found: ${text}`);
  return button;
}

function HistoryPanelHarness({
  pastActions,
  futureActions,
}: {
  pastActions: readonly HistoryActionMeta[];
  futureActions: readonly HistoryActionMeta[];
}) {
  const { t } = useStudioI18n();

  return (
    <HistoryPanel
      pastActions={pastActions}
      futureActions={futureActions}
      emptyLabel={t("editor.historyEmpty")}
      appliedLabel={t("editor.historyApplied")}
      redoLabel={t("editor.historyRedo")}
      translate={t}
    />
  );
}

describe("CP4F12A HistoryPanel", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    document.body.innerHTML = "";
  });

  it("renders metadata-only actions in past and future order with readable labels", async () => {
    const pastActions: HistoryActionMeta[] = [
      { kind: "future.example", labelKey: "history.future.unknown" },
      { kind: "slide.add", labelKey: "history.slide.add" },
      {
        kind: "element.add",
        labelKey: "history.element.add",
        labelParams: { elementType: "image" },
      },
      {
        kind: "canvas.drag",
        labelKey: "history.element.setting",
        labelParams: { setting: "canvas.drag" },
      },
      {
        kind: "palette.definition",
        labelKey: "history.element.setting",
        labelParams: { setting: "palette.definition" },
      },
      {
        kind: "customLibrary.apply",
        labelKey: "history.element.setting",
        labelParams: { setting: "customLibrary.apply" },
      },
    ];
    const futureActions: HistoryActionMeta[] = [
      { kind: "element.delete", labelKey: "history.element.delete", labelParams: { elementType: "text" } },
      { kind: "slide.move", labelKey: "history.slide.move" },
    ];

    await act(async () => {
      root.render(
        <StudioI18nProvider>
          <HistoryPanelHarness pastActions={pastActions} futureActions={futureActions} />
        </StudioI18nProvider>,
      );
    });

    const sections = Array.from(container.querySelectorAll<HTMLElement>("section"));
    expect(sections.map((section) => section.getAttribute("aria-label"))).toEqual(["Applied", "Redo"]);
    expect(Array.from(sections[0]!.querySelectorAll("li"), (item) => item.textContent)).toEqual([
      "Change: Custom library apply",
      "Change: Palette definition",
      "Change: Canvas drag",
      "Add Image",
      "Add slide",
      "Future example",
    ]);
    expect(Array.from(sections[1]!.querySelectorAll("li"), (item) => item.textContent)).toEqual([
      "Delete Text",
      "Move slide",
    ]);
    expect(container.querySelectorAll("button")).toHaveLength(0);
  });

  it("shows the empty state only when both history directions are empty", async () => {
    const futureActions: HistoryActionMeta[] = [{ kind: "slide.add", labelKey: "history.slide.add" }];

    await act(async () => {
      root.render(
        <StudioI18nProvider>
          <HistoryPanelHarness pastActions={[]} futureActions={futureActions} />
        </StudioI18nProvider>,
      );
    });

    expect(container.textContent).toContain("Redo");
    expect(container.textContent).toContain("Add slide");
    expect(container.textContent).not.toContain("History is not populated yet.");

    await act(async () => {
      root.render(
        <StudioI18nProvider>
          <HistoryPanelHarness pastActions={[]} futureActions={[]} />
        </StudioI18nProvider>,
      );
    });

    expect(container.textContent).toContain("History is not populated yet.");
  });

  it("renders live Workspace history through applied, undo, future, and redo", async () => {
    await act(async () => {
      root.render(
        <StudioI18nProvider>
          <EditorWorkspace initialPresentation={presentation()} />
        </StudioI18nProvider>,
      );
    });

    await act(async () => buttonByText(container, "History").click());
    expect(container.textContent).toContain("History is not populated yet.");

    await act(async () => buttonByText(container, "New slide").click());
    await act(async () => buttonByText(container, "+ New").click());

    expect(container.textContent).toContain("Applied");
    expect(container.textContent).toContain("Add slide");
    expect(container.textContent).not.toContain("History is not populated yet.");

    await act(async () => window.dispatchEvent(key("z", { ctrlKey: true })));
    expect(container.textContent).toContain("Redo");
    expect(container.textContent).toContain("Add slide");
    expect(container.textContent).not.toContain("History is not populated yet.");

    await act(async () => window.dispatchEvent(key("z", { ctrlKey: true, shiftKey: true })));
    expect(container.textContent).toContain("Applied");
    expect(container.textContent).toContain("Add slide");
  });
});
