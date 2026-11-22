// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { PresentationSchema } from "@web-slideshow/document-schema";
import { EditorWorkspace } from "../src/features/editor/editor-workspace";
import { StudioI18nProvider } from "../src/features/i18n/studio-i18n-context";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
const MATH_ID = "math-history";
function presentation(source = "x^2") {
  return PresentationSchema.parse({ schemaVersion: 1, id: "math-history-presentation", title: "Math history", slides: [{ id: "slide", title: "Slide", elements: [{ id: MATH_ID, type: "math", format: "latex", source, hidden: false }] }] });
}
function key(value: string, options: KeyboardEventInit = {}) { return new KeyboardEvent("keydown", { key: value, bubbles: true, cancelable: true, ...options }); }

describe("Math workspace history integration", () => {
  let host: HTMLDivElement; let root: Root;
  beforeEach(() => { host = document.createElement("div"); document.body.appendChild(host); root = createRoot(host); });
  afterEach(async () => { await act(async () => root.unmount()); document.body.innerHTML = ""; });
  async function mount(source = "x^2") { await act(async () => root.render(<StudioI18nProvider><EditorWorkspace initialPresentation={presentation(source)} /></StudioI18nProvider>)); }
  async function selectMath() { const item = host.querySelector<HTMLElement>(`[data-presentation-id="${MATH_ID}"]`); if (!item) throw new Error("Math canvas item missing"); await act(async () => item.dispatchEvent(new Event("pointerdown", { bubbles: true }))); }
  function sourceInput() { const input = host.querySelector<HTMLTextAreaElement>("[data-presentation-math-inspector] textarea"); if (!input) throw new Error("Math source input missing"); return input; }
  async function undo() { const event = key("z", { ctrlKey: true }); await act(async () => window.dispatchEvent(event)); return event; }
  async function redo() { const event = key("z", { ctrlKey: true, shiftKey: true }); await act(async () => window.dispatchEvent(event)); return event; }
  function setSource(input: HTMLTextAreaElement, value: string) { const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")?.set; setter?.call(input, value); input.dispatchEvent(new Event("input", { bubbles: true })); }

  it("undoes and redoes an insertion through the workspace shortcut", async () => {
    await mount(); await selectMath(); const input = sourceInput(); input.focus(); input.setSelectionRange(0, 0);
    const button = host.querySelector<HTMLButtonElement>('[aria-label="Fraction"]'); if (!button) throw new Error("fraction tool missing");
    await act(async () => { button.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, cancelable: true })); button.click(); });
    expect(sourceInput().value).toContain(String.raw`\frac`);
    await act(async () => sourceInput().blur());
    expect((await undo()).defaultPrevented).toBe(true); expect(sourceInput().value).toBe("x^2");
    expect((await redo()).defaultPrevented).toBe(true); expect(sourceInput().value).toContain(String.raw`\frac`);
  });

  it("keeps preview diagnostics out of the document history", async () => {
    await mount("\\frac{"); await selectMath();
    expect(host.querySelector('[data-presentation-math-inspector] [role="alert"]')).not.toBeNull();
    expect((await undo()).defaultPrevented).toBe(false);
    expect(sourceInput().value).toBe("\\frac{");
  });

  it("undoes/redoes direct edits and treats consecutive toolbar insertions as two steps", async () => {
    await mount(); await selectMath(); let input = sourceInput(); input.focus();
    await act(async () => { setSource(input, "y+1"); }); await act(async () => input.blur());
    await undo(); expect(sourceInput().value).toBe("x^2"); await redo(); expect(sourceInput().value).toBe("y+1");
    input = sourceInput(); input.focus(); input.setSelectionRange(input.value.length, input.value.length);
    const rootButton = host.querySelector<HTMLButtonElement>('[aria-label="Square root"]')!;
    await act(async () => { rootButton.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, cancelable: true })); rootButton.click(); });
    const category = host.querySelector<HTMLSelectElement>("[data-presentation-math-inspector] select");
    if (!category) throw new Error("Math toolbar category missing");
    await act(async () => { category.value = "operators"; category.dispatchEvent(new Event("change", { bubbles: true })); });
    const sumButton = host.querySelector<HTMLButtonElement>('[aria-label="Summation"]')!;
    await act(async () => { sumButton.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, cancelable: true })); sumButton.click(); });
    await act(async () => sourceInput().blur());
    await undo(); expect(sourceInput().value).not.toContain(String.raw`\sum`);
    await undo(); expect(sourceInput().value).toBe("y+1");
    await redo(); expect(sourceInput().value).toContain(String.raw`\sqrt`);
    await redo(); expect(sourceInput().value).toContain(String.raw`\sum`);
  });
});
