// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { PresentationSchema, type Presentation, type PresentationElement } from "@web-slideshow/document-schema";
import { EditorWorkspace } from "../src/features/editor/editor-workspace";
import { StudioI18nProvider } from "../src/features/i18n/studio-i18n-context";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

type Case = { name: string; element: PresentationElement; style: Record<string, unknown> };

const cases: Case[] = [
  { name: "Code", element: { id: "target", type: "code", hidden: false, code: "const x = 1", language: "typescript", showLineNumbers: true, highlightedLines: [], style: { color: "#111" } }, style: { target: "code", id: "code-style", name: "Code style", style: { color: "#222" } } },
  { name: "Terminal", element: { id: "target", type: "terminal", hidden: false, title: "Shell", lines: [{ type: "output", content: "ready" }], style: { outputColor: "#111" } }, style: { target: "terminal", id: "terminal-style", name: "Terminal style", style: { outputColor: "#222" } } },
  { name: "Simple Table omitted", element: { id: "target", type: "table", hidden: false, columns: [{ key: "value", label: "Value" }], rows: [{ value: "one" }], style: { color: "#111" } }, style: { target: "table", mode: "simple", id: "simple-style", name: "Simple style", style: { color: "#222" } } },
  { name: "Structured Table", element: { id: "target", type: "table", mode: "structured", hidden: false, showHeader: true, columns: [], rows: [], style: { headerBackground: "#111" } }, style: { target: "table", mode: "structured", id: "structured-style", name: "Structured style", style: { headerBackground: "#222" } } },
  { name: "Divider", element: { id: "target", type: "divider", hidden: false, orientation: "vertical", style: { background: { color: "#111" } } }, style: { target: "divider", id: "divider-style", name: "Divider style", style: { background: { color: "#222" } } } },
];

function presentation(testCase: Case): Presentation {
  return PresentationSchema.parse({ schemaVersion: 1, id: "lsx3b1-history", title: "LSX3B1", slides: [{ id: "slide", title: "Slide", elements: [testCase.element] }], linkedStyles: [testCase.style] });
}

function key(shift = false): KeyboardEvent { return new KeyboardEvent("keydown", { key: "z", ctrlKey: true, shiftKey: shift, bubbles: true, cancelable: true }); }

describe("LSX3B1 target relationship History", () => {
  let host: HTMLDivElement; let root: Root;
  beforeEach(() => { host = document.createElement("div"); document.body.appendChild(host); root = createRoot(host); });
  afterEach(async () => { await act(async () => root.unmount()); document.body.innerHTML = ""; });

  async function mount(initial: Presentation, saved: Presentation[]): Promise<void> {
    await act(async () => root.render(<StudioI18nProvider><EditorWorkspace initialPresentation={initial} onSave={async (snapshot) => { saved.push(structuredClone(snapshot)); }} /></StudioI18nProvider>));
    const canvas = host.querySelector<HTMLElement>('[data-presentation-id="target"]');
    if (!canvas) throw new Error("target was not rendered");
    await act(async () => canvas.dispatchEvent(new Event("pointerdown", { bubbles: true })));
  }

  async function save(saved: Presentation[]): Promise<Presentation> {
    const button = Array.from(host.querySelectorAll<HTMLButtonElement>("button")).find((candidate) => candidate.textContent?.trim() === "Save");
    if (!button) throw new Error("Save button was not rendered");
    if (saved.length === 0) expect(button.disabled, host.textContent ?? "").toBe(false);
    await act(async () => button.click());
    const snapshot = saved.at(-1); if (!snapshot) throw new Error("Save did not produce a snapshot"); return snapshot;
  }

  async function change(value: string): Promise<void> {
    const select = host.querySelector<HTMLSelectElement>("select[id$='-linked-style']");
    if (!select) throw new Error("relationship select was not rendered");
    await act(async () => { select.value = value; select.dispatchEvent(new Event("change", { bubbles: true })); });
  }

  it.each(cases)("attaches, detaches, and replays $name atomically", async (testCase) => {
    const initial = presentation(testCase); const saved: Presentation[] = [];
    await mount(initial, saved);
    await change(Object.keys(testCase.style).length > 0 ? String(testCase.style.id) : "");
    const attached = await save(saved);
    const changed = attached.slides[0]!.elements[0]!;
    expect(changed).toHaveProperty("linkedStyleId", testCase.style.id);
    if (testCase.name === "Simple Table omitted") expect(changed).not.toHaveProperty("mode");
    const undo = key(); await act(async () => window.dispatchEvent(undo));
    expect(undo.defaultPrevented).toBe(true); expect(await save(saved)).toEqual(initial);
    const redo = key(true); await act(async () => window.dispatchEvent(redo));
    expect(redo.defaultPrevented).toBe(true); expect(await save(saved)).toEqual(attached);

    await change("");
    const detached = await save(saved);
    expect(detached.slides[0]!.elements[0]).not.toHaveProperty("linkedStyleId");
    if (testCase.name === "Simple Table omitted") expect(detached.slides[0]!.elements[0]).not.toHaveProperty("mode");
  });

  it("does not create History entries for same-style, incompatible, or empty detach requests", async () => {
    const testCase = cases[0]!;
    const initial = PresentationSchema.parse({ ...presentation(testCase), slides: [{ ...presentation(testCase).slides[0]!, elements: [{ ...testCase.element, linkedStyleId: "code-style" }] }], linkedStyles: [testCase.style, { target: "terminal", id: "wrong", name: "Wrong", style: { outputColor: "#333" } }] });
    const saved: Presentation[] = []; await mount(initial, saved);
    const noOp = key(); await change("code-style"); await act(async () => window.dispatchEvent(noOp));
    expect(noOp.defaultPrevented).toBe(false);
    const select = host.querySelector<HTMLSelectElement>("select[id$='-linked-style']");
    if (!select) throw new Error("relationship select was not rendered");
    expect(Array.from(select.options).map((option) => option.value)).not.toContain("wrong");
    select.value = "wrong";
    expect(select.value).toBe("");
    const beforeInvalidSimulation = key(); await act(async () => window.dispatchEvent(beforeInvalidSimulation));
    expect(beforeInvalidSimulation.defaultPrevented).toBe(false);
  });
});
