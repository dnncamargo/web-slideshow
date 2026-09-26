// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { PresentationSchema, type Presentation, type PresentationElement } from "@web-slideshow/document-schema";
import { EditorWorkspace } from "../src/features/editor/editor-workspace";
import { StudioI18nProvider } from "../src/features/i18n/studio-i18n-context";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

const forms: Array<{ name: string; element: PresentationElement; target: string; mode?: string }> = [
  { name: "Code", target: "code", element: { id: "target", type: "code", hidden: false, code: "const x = 1", language: "typescript", showLineNumbers: true, highlightedLines: [1], style: { color: "#111" } } },
  { name: "Terminal", target: "terminal", element: { id: "target", type: "terminal", hidden: false, title: "Shell", lines: [{ type: "output", content: "ready" }], style: { outputColor: "#111" } } },
  { name: "Simple Table omitted", target: "table", mode: "simple", element: { id: "target", type: "table", hidden: false, columns: [{ key: "value", label: "Value" }], rows: [{ value: "one" }], style: { color: "#111" } } },
  { name: "Structured Table", target: "table", mode: "structured", element: { id: "target", type: "table", mode: "structured", hidden: false, showHeader: true, columns: [], rows: [], style: { headerBackground: "#111" } } },
  { name: "Divider", target: "divider", element: { id: "target", type: "divider", hidden: false, orientation: "vertical", style: { background: { color: "#111" } } } },
];

function initial(form: typeof forms[number]): Presentation {
  return PresentationSchema.parse({ schemaVersion: 1, id: "lsx3b1-create", title: "LSX3B1", slides: [{ id: "slide", title: "Slide", elements: [form.element] }] });
}

describe("LSX3B1 create Linked Style from selected target", () => {
  let host: HTMLDivElement; let root: Root;
  beforeEach(() => { host = document.createElement("div"); document.body.appendChild(host); root = createRoot(host); });
  afterEach(async () => { await act(async () => root.unmount()); document.body.innerHTML = ""; });

  async function mount(presentation: Presentation, saved: Presentation[]): Promise<void> {
    await act(async () => root.render(<StudioI18nProvider><EditorWorkspace initialPresentation={presentation} onSave={async (snapshot) => { saved.push(structuredClone(snapshot)); }} /></StudioI18nProvider>));
    const target = host.querySelector<HTMLElement>('[data-presentation-id="target"]'); if (!target) throw new Error("target was not rendered");
    await act(async () => target.dispatchEvent(new Event("pointerdown", { bubbles: true })));
  }
  async function create(name: string): Promise<void> {
    const resources = Array.from(host.querySelectorAll<HTMLButtonElement>("button")).find((button) => button.textContent?.trim() === "Custom Resources");
    if (!resources) throw new Error("Custom Resources was not rendered");
    await act(async () => resources.click());
    const add = Array.from(host.querySelectorAll<HTMLButtonElement>("button")).find((button) => button.textContent?.trim() === "Add to Linked Styles");
    if (!add) throw new Error("Add to Linked Styles was not rendered");
    await act(async () => add.click());
    const input = Array.from(host.querySelectorAll<HTMLInputElement>("input")).find((candidate) => candidate.closest("label")?.textContent?.toLowerCase().includes("style name"));
    if (!input) throw new Error("style name input was not rendered");
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set; if (!setter) throw new Error("input setter was not found");
    await act(async () => { setter.call(input, name); input.dispatchEvent(new Event("input", { bubbles: true })); input.dispatchEvent(new Event("change", { bubbles: true })); });
    const submit = Array.from(host.querySelectorAll<HTMLButtonElement>("button")).find((button) => button.textContent?.trim() === "Add to Linked Styles");
    if (!submit) throw new Error("create button was not rendered");
    await act(async () => submit.click());
  }
  async function save(saved: Presentation[]): Promise<Presentation> {
    const button = Array.from(host.querySelectorAll<HTMLButtonElement>("button")).find((candidate) => candidate.textContent?.trim() === "Save"); if (!button) throw new Error("Save was not rendered");
    await act(async () => button.click()); const snapshot = saved.at(-1); if (!snapshot) throw new Error("save did not run"); return snapshot;
  }

  it.each(forms)("creates, undoes, and redoes the $name form", async (form) => {
    const source = initial(form); const saved: Presentation[] = []; await mount(source, saved); await create(`${form.name} style`);
    const changed = await save(saved); const style = changed.linkedStyles?.[0]; const element = changed.slides[0]!.elements[0]!;
    expect(style).toMatchObject({ target: form.target, name: `${form.name} style` });
    if (form.mode) expect(style).toHaveProperty("mode", form.mode);
    expect(element).toHaveProperty("linkedStyleId", style?.id);
    if (form.name === "Simple Table omitted") expect(element).not.toHaveProperty("mode");
    expect(element).toMatchObject({ id: form.element.id, type: form.element.type });
    if (form.name === "Code") expect(element).toMatchObject({ code: "const x = 1", language: "typescript", showLineNumbers: true, highlightedLines: [1] });
    if (form.name === "Terminal") expect(element).toMatchObject({ title: "Shell", lines: [{ type: "output", content: "ready" }] });
    if (form.name === "Simple Table omitted") expect(element).toMatchObject({ columns: [{ key: "value", label: "Value" }], rows: [{ value: "one" }] });
    if (form.name === "Structured Table") expect(element).toMatchObject({ mode: "structured", showHeader: true, columns: [], rows: [] });
    if (form.name === "Divider") expect(element).toMatchObject({ orientation: "vertical" });
    await act(async () => window.dispatchEvent(new KeyboardEvent("keydown", { key: "z", ctrlKey: true, bubbles: true, cancelable: true })));
    expect(await save(saved)).toEqual(source);
    await act(async () => window.dispatchEvent(new KeyboardEvent("keydown", { key: "z", ctrlKey: true, shiftKey: true, bubbles: true, cancelable: true })));
    expect(await save(saved)).toEqual(changed);
  });
});
