// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it } from "vitest";
import type { BlocksElement } from "@powershow/document-schema";
import { BlocksInspector } from "../src/features/editor/inspector/blocks-inspector";
import { BlocksContentSection } from "../src/features/editor/inspector/sections/blocks-content-section";
import { PresentationColorPaletteProvider } from "../src/features/editor/inspector/sections/presentation-color-palette";
import type { ElementInspectorUpdate } from "../src/features/editor/inspector/inspector-types";
import { StudioI18nProvider } from "../src/features/i18n/studio-i18n-context";

const element = (source = "\\statement(move)", style?: BlocksElement["style"]): BlocksElement => ({ id: "blocks", type: "blocks", hidden: false, source, style });

describe("Blocks source Inspector", () => {
  it("exposes one controlled source textarea and writes its value", async () => {
    const host = document.createElement("div");
    document.body.appendChild(host);
    const root = createRoot(host);
    let current: BlocksElement = element();
    const onUpdate: ElementInspectorUpdate = (update) => { current = update(current) as BlocksElement; };
    await act(async () => root.render(<StudioI18nProvider><BlocksContentSection element={current} onUpdate={onUpdate} /></StudioI18nProvider>));
    const textarea = host.querySelector("textarea");
    expect(textarea?.value).toBe("\\statement(move)");
    if (!textarea) throw new Error("source textarea missing");
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")?.set?.call(textarea, "\\scope(Repeat");
      textarea.dispatchEvent(new Event("input", { bubbles: true }));
      textarea.dispatchEvent(new Event("change", { bubbles: true }));
    });
    expect(current.source).toBe("\\scope(Repeat");
    await act(async () => root.render(<StudioI18nProvider><BlocksContentSection element={current} onUpdate={onUpdate} /></StudioI18nProvider>));
    expect(host.querySelector('[data-powershow-blocks-syntax="invalid"]')).not.toBeNull();
    await act(async () => root.unmount());
    host.remove();
  });

  it("does not expose recursive BlockItem controls", async () => {
    const host = document.createElement("div");
    document.body.appendChild(host);
    const root = createRoot(host);
    await act(async () => root.render(<StudioI18nProvider><BlocksContentSection element={element()} onUpdate={() => {}} /></StudioI18nProvider>));
    expect(host.querySelectorAll("button, select")).toHaveLength(0);
    expect(host.textContent).toContain("Blocks source");
    expect(host.querySelector('[data-powershow-blocks-syntax="valid"]')).not.toBeNull();
    await act(async () => root.unmount());
    host.remove();
  });

  it("reports line and column, then returns to valid after repeated canonical edits", async () => {
    const host = document.createElement("div");
    document.body.appendChild(host);
    const root = createRoot(host);
    let current = element("\\statement(one)\n\\statement(two)");
    const onUpdate: ElementInspectorUpdate = (update) => { current = update(current) as BlocksElement; };
    const render = async () => act(async () => root.render(<StudioI18nProvider><BlocksContentSection element={current} onUpdate={onUpdate} /></StudioI18nProvider>));
    await render();
    const textarea = host.querySelector<HTMLTextAreaElement>("textarea");
    if (!textarea) throw new Error("source textarea missing");
    const edit = async (source: string) => act(async () => {
      Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")?.set?.call(textarea, source);
      textarea.dispatchEvent(new Event("change", { bubbles: true }));
      await Promise.resolve();
    });
    await edit("\\statement(one)\n\\scope(Two");
    await render();
    expect(host.querySelector('[data-powershow-blocks-syntax="invalid"]')?.textContent).toContain("Line 2, column 11");
    expect(host.textContent).toContain('Expected ")" to close "\\scope".');
    await edit("\\statement(one)\n\\statement(two)");
    await render();
    expect(host.querySelector('[data-powershow-blocks-syntax="valid"]')).not.toBeNull();
    expect(current.source).toBe("\\statement(one)\n\\statement(two)");
    await act(async () => root.unmount());
    host.remove();
  });

  it("exposes exactly three Blocks color controls and updates/resets only their fields", async () => {
    const host = document.createElement("div");
    document.body.appendChild(host);
    const root = createRoot(host);
    let current = element("\\statement(one)", { className: "keep", scopeColor: "#222222", logicColor: "#333333" });
    const render = async () => act(async () => root.render(<StudioI18nProvider><PresentationColorPaletteProvider colors={[{ id: "accent", name: "Accent", value: "#abcdef" }]}><BlocksInspector element={current} onUpdate={(update) => { current = update(current) as BlocksElement; void render(); }} /></PresentationColorPaletteProvider></StudioI18nProvider>));
    await render();
    expect(host.querySelectorAll("#blocks-statement-color, #blocks-scope-color, #blocks-logic-color")).toHaveLength(3);
    expect(host.querySelector("#blocks-statement-color")).not.toBeNull();
    expect((host.querySelector<HTMLInputElement>("#blocks-statement-color")!).value).toBe("#4c97ff");
    const statementControl = host.querySelector("#blocks-statement-color")?.parentElement?.parentElement;
    await act(async () => statementControl?.querySelector<HTMLButtonElement>("button[aria-expanded]")?.click());
    await act(async () => statementControl?.querySelector<HTMLButtonElement>('button[aria-label*="Accent"]')?.click());
    expect(current.style?.statementColor).toEqual({ kind: "palette", colorId: "accent" });
    const statementValue = host.querySelector<HTMLInputElement>("#blocks-statement-color-value");
    if (!statementValue) throw new Error("statement color input missing");
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set?.call(statementValue, "#123456");
    await act(async () => statementValue.dispatchEvent(new Event("change", { bubbles: true })));
    expect(current.style?.statementColor).toBe("#123456");
    expect(current.style?.scopeColor).toBe("#222222");
    expect(current.style?.logicColor).toBe("#333333");
    await act(async () => host.querySelector("#blocks-statement-color")?.parentElement?.parentElement?.querySelector<HTMLButtonElement>("button:last-of-type")?.click());
    expect(current.style?.statementColor).toBeUndefined();
    expect(current.style?.scopeColor).toBe("#222222");
    expect(current.style?.className).toBe("keep");
    await act(async () => root.unmount());
    host.remove();
  });
});
