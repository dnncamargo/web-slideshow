// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it } from "vitest";
import { MathInspector } from "../src/features/editor/inspector/math-inspector";
import { AuthoringHistoryContext } from "../src/features/editor/authoring-history-context";
import { createElement } from "../src/features/editor/element-operations";
import { StudioI18nProvider } from "../src/features/i18n/studio-i18n-context";
import type { MathElement, PresentationElement } from "@web-slideshow/document-schema";
import type { ElementInspectorUpdate } from "../src/features/editor/inspector/inspector-types";
import { translateStudioMessage } from "../src/features/i18n/studio-i18n";

Object.defineProperty(globalThis, "IS_REACT_ACT_ENVIRONMENT", { configurable: true, value: true });

describe("Math authoring", () => {
  it("creates a canonical editable Math element", () => {
    const element = createElement("math", new Set());
    expect(element).toMatchObject({ type: "math", format: "latex", source: "x^2", hidden: false });
  });
  it("edits source, inserts a fraction around selection, and previews with shared renderer", async () => {
    const host = document.createElement("div"); document.body.appendChild(host); const root = createRoot(host);
    let current: MathElement = { id: "math", type: "math", format: "latex", source: "xy", hidden: false };
    const update: ElementInspectorUpdate = fn => { current = fn(current as PresentationElement) as MathElement; };
    await act(async () => root.render(<StudioI18nProvider><MathInspector element={current} onUpdate={update} /></StudioI18nProvider>));
    const textarea = host.querySelector("textarea"); if (!textarea) throw new Error("Math source input missing");
    textarea.setSelectionRange(0, 2);
    await act(async () => textarea.dispatchEvent(new Event("select", { bubbles: true })));
    const fraction = host.querySelector<HTMLButtonElement>('[aria-label="Fraction"]'); if (!fraction) throw new Error("Fraction control missing");
    await act(async () => fraction.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, cancelable: true })));
    await act(async () => fraction.click());
    expect(current.source).toBe("\\frac{xy}{}");
    await act(async () => root.render(<StudioI18nProvider><MathInspector element={current} onUpdate={update} /></StudioI18nProvider>));
    expect(document.activeElement).toBe(textarea);
    expect(textarea.selectionStart).toBe(current.source.length - 1);
    expect(host.querySelector('[data-presentation-math-preview="true"] math')).not.toBeNull();
    await act(async () => root.unmount()); host.remove();
  });
  it("offers grouped structure, function, relation, operator, set, and multiline tools", async () => {
    const host = document.createElement("div"); document.body.appendChild(host); const root = createRoot(host);
    const element: MathElement = { id: "m", type: "math", format: "latex", source: "", hidden: false };
    await act(async () => root.render(<StudioI18nProvider><MathInspector element={element} onUpdate={() => {}} /></StudioI18nProvider>));
    const category = host.querySelector("select"); if (!category) throw new Error("category select missing");
    expect(category.options).toHaveLength(6);
    for (const value of ["functions", "relations", "operators", "sets", "multiline"] as const) {
      await act(async () => { category.value = value; category.dispatchEvent(new Event("change", { bubbles: true })); });
      expect(host.querySelector('[role="group"]')?.querySelectorAll("button").length).toBeGreaterThan(0);
    }
    await act(async () => root.unmount()); host.remove();
  });
  it("wraps a selection in an exponent and restores the cursor to the input", async () => {
    const host = document.createElement("div"); document.body.appendChild(host); const root = createRoot(host);
    let current: MathElement = { id: "m", type: "math", format: "latex", source: "a+b", hidden: false };
    const update: ElementInspectorUpdate = fn => { current = fn(current as PresentationElement) as MathElement; };
    await act(async () => root.render(<StudioI18nProvider><MathInspector element={current} onUpdate={update} /></StudioI18nProvider>));
    const input = host.querySelector("textarea")!; input.setSelectionRange(2, 3);
    const button = host.querySelector<HTMLButtonElement>('[aria-label="Exponent"]')!;
    await act(async () => button.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, cancelable: true })));
    await act(async () => button.click());
    expect(current.source).toBe("a+^{b}");
    await act(async () => root.render(<StudioI18nProvider><MathInspector element={current} onUpdate={update} /></StudioI18nProvider>));
    expect(document.activeElement).toBe(input);
    expect(input.selectionStart).toBe(current.source.length);
    await act(async () => root.unmount()); host.remove();
  });
  it("localizes Math authoring controls in Portuguese and English", () => {
    expect(translateStudioMessage("pt-BR", "inspector.math.category.structures")).toBe("Estruturas");
    expect(translateStudioMessage("en", "inspector.math.category.structures")).toBe("Structures");
  });
  it("preserves invalid source, enforces the size cap, and repairs preview after editing", async () => {
    const host = document.createElement("div"); document.body.appendChild(host); const root = createRoot(host);
    let current: MathElement = { id: "m", type: "math", format: "latex", source: "\\frac{", hidden: false };
    const update: ElementInspectorUpdate = fn => { current = fn(current as PresentationElement) as MathElement; };
    const history = { begin: () => {}, update: (_key: string, callback: () => void) => callback(), finish: () => {}, discrete: (_meta: unknown, callback: () => void) => callback() };
    const render = () => <StudioI18nProvider><AuthoringHistoryContext.Provider value={history}><MathInspector element={current} onUpdate={update} /></AuthoringHistoryContext.Provider></StudioI18nProvider>;
    await act(async () => root.render(render()));
    expect(host.querySelector('[role="alert"]')).not.toBeNull();
    const textarea = host.querySelector("textarea")!;
    const setValue = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")?.set;
    await act(async () => { setValue?.call(textarea, "\\frac{a}{b}"); textarea.dispatchEvent(new Event("input", { bubbles: true })); });
    expect(current.source).toBe("\\frac{a}{b}");
    await act(async () => root.render(render()));
    expect(host.querySelector('[role="status"]')).not.toBeNull();
    await act(async () => { setValue?.call(textarea, "x".repeat(4097)); textarea.dispatchEvent(new Event("input", { bubbles: true })); });
    expect(current.source.length).toBeLessThanOrEqual(4096);
    await act(async () => root.unmount()); host.remove();
  });
});
