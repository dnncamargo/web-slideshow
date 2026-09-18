// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  PresentationSchema,
  type Presentation,
  type TerminalElement,
} from "@powershow/document-schema";

import { AuthoringHistoryContext, type AuthoringHistoryContextValue } from "../src/features/editor/authoring-history-context";
import type { HistoryActionMeta } from "../src/features/editor/editor-history-state";
import { EditorWorkspace } from "../src/features/editor/editor-workspace";
import { TerminalInspector } from "../src/features/editor/inspector/terminal-inspector";
import { StudioI18nProvider } from "../src/features/i18n/studio-i18n-context";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

const RICH_TEXT_B = {
  type: "rich-text" as const,
  runs: [{ text: "B", marks: { bold: true, italic: true, underline: true } }],
};

function terminalElement(lines: TerminalElement["lines"]): TerminalElement {
  return {
    type: "terminal",
    id: "cp4d4-terminal",
    hidden: true,
    title: { type: "rich-text", runs: [{ text: "Terminal", marks: { bold: true } }] },
    layout: { width: 640, height: 360 },
    style: { background: { color: "#101820" }, commandColor: "#ffffff" },
    typography: { fontSize: 18, lineHeight: 1.4, letterSpacing: 0.1 },
    titleStyle: { color: "#00ff88" },
    titleTypography: { fontSize: 20, fontWeight: 700 },
    effect: { opacity: 0.75 },
    lines,
  };
}

function presentation(element: TerminalElement): Presentation {
  return PresentationSchema.parse({
    schemaVersion: 1,
    id: "cp4d4-terminal-line-structure-history",
    title: "CP4D4 Terminal line structure history",
    slides: [{
      id: "slide-1",
      title: "Slide 1",
      elements: [{ ...element, hidden: false }],
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

function changeSelect(select: HTMLSelectElement, value: string): void {
  const setter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value")?.set;
  if (!setter) throw new Error("expected HTMLSelectElement.value setter");
  setter.call(select, value);
  select.dispatchEvent(new Event("change", { bubbles: true }));
}

function setTextAreaValue(textarea: HTMLTextAreaElement, value: string): void {
  const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")?.set;
  if (!setter) throw new Error("expected HTMLTextAreaElement.value setter");
  setter.call(textarea, value);
  textarea.dispatchEvent(new Event("input", { bubbles: true }));
}

describe("CP4D4 Terminal line structure history", () => {
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

  function addButton(): HTMLButtonElement {
    const button = Array.from(host.querySelectorAll<HTMLButtonElement>("button"))
      .find((candidate) => candidate.textContent?.includes("Add line"));
    if (!button) throw new Error("Terminal add button was not rendered");
    return button;
  }

  function removeButton(index: number): HTMLButtonElement {
    const buttons = host.querySelectorAll<HTMLButtonElement>('button[title="Remove line"]');
    const button = buttons[index];
    if (!button) throw new Error(`Terminal remove button ${index} was not rendered`);
    return button;
  }

  function lineType(index: number): HTMLSelectElement {
    const select = host.querySelector<HTMLSelectElement>(
      `#terminal-cp4d4-terminal-line-${index}-type`,
    );
    if (!select) throw new Error(`Terminal line type ${index} was not rendered`);
    return select;
  }

  function lineContent(index: number): HTMLTextAreaElement {
    const textarea = host.querySelector<HTMLTextAreaElement>(
      `#terminal-cp4d4-terminal-line-${index}-content`,
    );
    if (!textarea) throw new Error(`Terminal line content ${index} was not rendered`);
    return textarea;
  }

  async function mountWorkspace(element: TerminalElement): Promise<void> {
    await act(async () => root.render(
      <StudioI18nProvider>
        <EditorWorkspace initialPresentation={presentation(element)} />
      </StudioI18nProvider>,
    ));
    const canvasElement = host.querySelector<HTMLElement>('[data-powershow-id="cp4d4-terminal"]');
    if (!canvasElement) throw new Error("Terminal was not rendered");
    await act(async () => canvasElement.dispatchEvent(new Event("pointerdown", { bubbles: true })));
  }

  async function undo(): Promise<void> {
    await act(async () => window.dispatchEvent(key("z", { ctrlKey: true })));
  }

  async function redo(): Promise<void> {
    await act(async () => window.dispatchEvent(key("z", { ctrlKey: true, shiftKey: true })));
  }

  async function renderStandalone(
    initial: TerminalElement,
    history?: AuthoringHistoryContextValue,
  ): Promise<{ getState: () => TerminalElement; metas: HistoryActionMeta[] }> {
    let state = initial;
    const metas: HistoryActionMeta[] = [];
    const render = () => root.render(
      <StudioI18nProvider>
        {history ? (
          <AuthoringHistoryContext.Provider value={history}>
            <TerminalInspector
              element={state}
              onUpdate={(update) => {
                const next = update(state);
                if (next.type === "terminal") state = next;
                render();
              }}
            />
          </AuthoringHistoryContext.Provider>
        ) : (
          <TerminalInspector
            element={state}
            onUpdate={(update) => {
              const next = update(state);
              if (next.type === "terminal") state = next;
              render();
            }}
          />
        )}
      </StudioI18nProvider>,
    );
    if (history) {
      history.discrete = (meta, callback) => {
        metas.push(meta);
        callback();
      };
    }
    await act(async () => render());
    return { getState: () => state, metas };
  }

  it("emits exact Add and Remove metadata, appends, removes by index, and preserves Terminal fields", async () => {
    const initial = terminalElement([
      { type: "command", content: "A" },
      { type: "output", content: RICH_TEXT_B },
      { type: "error", content: "C" },
    ]);
    const history: AuthoringHistoryContextValue = {
      begin: () => undefined,
      update: (_key, callback) => callback(),
      finish: () => undefined,
      discrete: () => undefined,
    };
    const mounted = await renderStandalone(initial, history);
    await act(async () => addButton().click());

    expect(mounted.metas).toEqual([{
      kind: "terminal.add",
      labelKey: "history.element.setting",
      labelParams: { setting: "terminal.add" },
    }]);
    expect(mounted.getState().lines).toEqual([
      ...initial.lines,
      { type: "command", content: "New command" },
    ]);
    expect(mounted.getState().id).toBe(initial.id);
    expect(mounted.getState().hidden).toBe(initial.hidden);
    expect(mounted.getState().title).toEqual(initial.title);
    expect(mounted.getState().layout).toEqual(initial.layout);
    expect(mounted.getState().style).toEqual(initial.style);
    expect(mounted.getState().typography).toEqual(initial.typography);
    expect(mounted.getState().titleStyle).toEqual(initial.titleStyle);
    expect(mounted.getState().titleTypography).toEqual(initial.titleTypography);
    expect(mounted.getState().effect).toEqual(initial.effect);

    await act(async () => removeButton(1).click());
    expect(mounted.metas).toEqual([
      {
        kind: "terminal.add",
        labelKey: "history.element.setting",
        labelParams: { setting: "terminal.add" },
      },
      {
        kind: "terminal.remove",
        labelKey: "history.element.setting",
        labelParams: { setting: "terminal.remove" },
      },
    ]);
    expect(mounted.getState().lines).toEqual([
      { type: "command", content: "A" },
      { type: "error", content: "C" },
      { type: "command", content: "New command" },
    ]);
    expect(mounted.getState().lines[1]?.content).toEqual("C");
  });

  it("works without the History provider and supports add-to-empty and remove-to-empty", async () => {
    const mounted = await renderStandalone(terminalElement([{ type: "comment", content: "only" }]));
    await act(async () => removeButton(0).click());
    expect(mounted.getState().lines).toEqual([]);
    await act(async () => addButton().click());
    expect(mounted.getState().lines).toEqual([{ type: "command", content: "New command" }]);
  });

  it("restores exact RichText content and empty state through remove undo/redo", async () => {
    const lines = [
      { type: "command" as const, content: "A" },
      { type: "output" as const, content: RICH_TEXT_B },
      { type: "error" as const, content: "C" },
    ];
    await mountWorkspace(terminalElement(lines));

    await act(async () => removeButton(1).click());
    expect(lineContent(0).value).toBe("A");
    expect(lineContent(1).value).toBe("C");
    await undo();
    expect(lineType(1).value).toBe("output");
    expect(lineContent(1).value).toBe("B");
    await redo();
    expect(lineContent(1).value).toBe("C");

    await undo();
    await undo();
    await act(async () => removeButton(2).click());
    await act(async () => removeButton(1).click());
    await act(async () => removeButton(0).click());
    expect(host.querySelectorAll('textarea[id*="-content"]')).toHaveLength(0);
    await undo();
    expect(lineContent(0).value).toBe("A");
  });

  it("separates text edit from Add and restores edits independently", async () => {
    await mountWorkspace(terminalElement([{ type: "command", content: "original" }]));
    const textarea = lineContent(0);
    await act(async () => {
      textarea.focus();
      setTextAreaValue(textarea, "edited");
      textarea.blur();
    });
    await act(async () => addButton().click());

    await undo();
    expect(lineContent(0).value).toBe("edited");
    expect(host.querySelectorAll('textarea[id*="-content"]')).toHaveLength(1);
    await undo();
    expect(lineContent(0).value).toBe("original");
    await redo();
    expect(lineContent(0).value).toBe("edited");
    await redo();
    expect(host.querySelectorAll('textarea[id*="-content"]')).toHaveLength(2);
  });

  it("separates text edit and lineType history from Remove", async () => {
    await mountWorkspace(terminalElement([
      { type: "command", content: "A" },
      { type: "command", content: "B" },
    ]));
    const first = lineContent(0);
    await act(async () => {
      first.focus();
      setTextAreaValue(first, "A edited");
      first.blur();
    });
    await act(async () => changeSelect(lineType(1), "output"));
    await act(async () => removeButton(1).click());

    await undo();
    expect(lineContent(0).value).toBe("A edited");
    expect(lineType(1).value).toBe("output");
    await undo();
    expect(lineContent(0).value).toBe("A edited");
    await undo();
    expect(lineContent(0).value).toBe("A");
    await redo();
    expect(lineContent(0).value).toBe("A edited");
  });

  it("keeps Add, Remove, and consecutive structural actions independent", async () => {
    await mountWorkspace(terminalElement([{ type: "command", content: "A" }]));
    await act(async () => addButton().click());
    await act(async () => addButton().click());
    expect(host.querySelectorAll('textarea[id*="-content"]')).toHaveLength(3);
    await undo();
    expect(host.querySelectorAll('textarea[id*="-content"]')).toHaveLength(2);
    await undo();
    expect(host.querySelectorAll('textarea[id*="-content"]')).toHaveLength(1);
    await redo();
    expect(host.querySelectorAll('textarea[id*="-content"]')).toHaveLength(2);

    await act(async () => removeButton(1).click());
    await undo();
    expect(lineContent(1).value).toBe("New command");
    await undo();
    expect(host.querySelectorAll('textarea[id*="-content"]')).toHaveLength(1);
  });
});
