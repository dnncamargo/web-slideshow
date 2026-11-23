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
  return PresentationSchema.parse({ schemaVersion: 1, id: "math-history-presentation", title: "Math history", palette: { colors: [{ id: "accent", name: "Accent", value: "#abcdef" }] }, slides: [{ id: "slide", title: "Slide", elements: [{ id: MATH_ID, type: "math", format: "latex", source, hidden: false }] }] });
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
  function setInput(input: HTMLInputElement, value: string) { const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set; setter?.call(input, value); input.dispatchEvent(new Event("input", { bubbles: true })); }

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

  it("undoes and redoes Math typography, palette color, dimensions, and placement through shared history", async () => {
    await mount(); await selectMath();

    const selectValue = async (id: string, value: string) => {
      const select = host.querySelector<HTMLSelectElement>(`#${id}`);
      if (!select) throw new Error(`${id} control missing`);
      await act(async () => { select.value = value; select.dispatchEvent(new Event("change", { bubbles: true })); });
    };
    await selectValue("math-font-weight", "700");
    expect(host.querySelector<HTMLSelectElement>("#math-font-weight")?.value).toBe("700");
    await undo(); expect(host.querySelector<HTMLSelectElement>("#math-font-weight")?.value).toBe("");
    await redo(); expect(host.querySelector<HTMLSelectElement>("#math-font-weight")?.value).toBe("700");

    const fontStyle = host.querySelector<HTMLSelectElement>("#math-font-style");
    if (!fontStyle) throw new Error("Math font style control missing");
    await act(async () => { fontStyle.value = "italic"; fontStyle.dispatchEvent(new Event("change", { bubbles: true })); });
    expect(host.querySelector<HTMLSelectElement>("#math-font-style")?.value).toBe("italic");
    await undo(); expect(host.querySelector<HTMLSelectElement>("#math-font-style")?.value).toBe("");
    await redo(); expect(host.querySelector<HTMLSelectElement>("#math-font-style")?.value).toBe("italic");

    const fontSize = host.querySelector<HTMLInputElement>("#math-font-size");
    if (!fontSize) throw new Error("Math font size control missing");
    await act(async () => { fontSize.focus(); setInput(fontSize, "28"); fontSize.blur(); });
    expect(host.querySelector<HTMLInputElement>("#math-font-size")?.value).toBe("28");
    await undo(); expect(host.querySelector<HTMLInputElement>("#math-font-size")?.value).toBe("");
    await redo(); expect(host.querySelector<HTMLInputElement>("#math-font-size")?.value).toBe("28");

    const lineHeight = host.querySelector<HTMLInputElement>("#math-line-height");
    if (!lineHeight) throw new Error("Math line-height control missing");
    await act(async () => { lineHeight.focus(); setInput(lineHeight, "1.7"); lineHeight.blur(); });
    expect(host.querySelector<HTMLInputElement>("#math-line-height")?.value).toBe("1.7");
    await undo(); expect(host.querySelector<HTMLInputElement>("#math-line-height")?.value).toBe("");
    await redo(); expect(host.querySelector<HTMLInputElement>("#math-line-height")?.value).toBe("1.7");

    const paletteButton = Array.from(host.querySelectorAll<HTMLButtonElement>("button[aria-expanded]"))
      .find(button => button.textContent?.trim() === "Use palette");
    if (!paletteButton) throw new Error("Math palette button missing");
    await act(async () => paletteButton.click());
    const accent = host.querySelector<HTMLButtonElement>("button[aria-label='Apply palette color Accent']");
    if (!accent) throw new Error("Accent palette entry missing");
    await act(async () => accent.click());
    expect(host.textContent).toContain("Linked to presentation palette");
    await undo(); expect(host.textContent).not.toContain("Linked to presentation palette");
    await redo(); expect(host.textContent).toContain("Linked to presentation palette");

    const width = host.querySelector<HTMLInputElement>("#element-width");
    if (!width) throw new Error("Math width input missing");
    await act(async () => { width.focus(); setInput(width, "50"); width.blur(); });
    expect(host.querySelector<HTMLInputElement>("#element-width")?.value).toBe("50");
    await undo(); expect(host.querySelector<HTMLInputElement>("#element-width")?.value).toBe("0");
    await redo(); expect(host.querySelector<HTMLInputElement>("#element-width")?.value).toBe("50");

    const height = host.querySelector<HTMLInputElement>("#element-height");
    if (!height) throw new Error("Math height input missing");
    await act(async () => { height.focus(); setInput(height, "120"); height.blur(); });
    expect(host.querySelector<HTMLInputElement>("#element-height")?.value).toBe("120");
    await undo(); expect(host.querySelector<HTMLInputElement>("#element-height")?.value).toBe("0");
    await redo(); expect(host.querySelector<HTMLInputElement>("#element-height")?.value).toBe("120");

    await selectValue("element-canonical-position-mode", "absolute");
    expect(host.querySelector<HTMLSelectElement>("#element-canonical-position-mode")?.value).toBe("absolute");
    await undo(); expect(host.querySelector<HTMLSelectElement>("#element-canonical-position-mode")?.value).toBe("flow");
    await redo(); expect(host.querySelector<HTMLSelectElement>("#element-canonical-position-mode")?.value).toBe("absolute");
    const top = host.querySelector<HTMLInputElement>("#element-canonical-top");
    if (!top) throw new Error("Math top coordinate missing");
    await act(async () => { top.focus(); setInput(top, "24"); top.blur(); });
    expect(host.querySelector<HTMLInputElement>("#element-canonical-top")?.value).toBe("24");
    await undo(); expect(host.querySelector<HTMLInputElement>("#element-canonical-top")?.value).toBe("");
    await redo(); expect(host.querySelector<HTMLInputElement>("#element-canonical-top")?.value).toBe("24");
  });

  it("undoes and redoes Math padding, fill mode, gradient edits, background, border, and radius", async () => {
    await mount(); await selectMath();
    const selectValue = async (id: string, value: string) => {
      const select = host.querySelector<HTMLSelectElement>(`#${id}`);
      if (!select) throw new Error(`${id} control missing`);
      await act(async () => { select.value = value; select.dispatchEvent(new Event("change", { bubbles: true })); });
    };
    const editNumber = async (id: string, value: string) => {
      const input = host.querySelector<HTMLInputElement>(`#${id}`);
      if (!input) throw new Error(`${id} control missing`);
      await act(async () => { input.focus(); setInput(input, value); input.blur(); });
    };

    await editNumber("math-padding", "16");
    expect(host.querySelector<HTMLInputElement>("#math-padding")?.value).toBe("16");
    await undo(); expect(host.querySelector<HTMLInputElement>("#math-padding")?.value).toBe("");
    await redo(); expect(host.querySelector<HTMLInputElement>("#math-padding")?.value).toBe("16");
    await editNumber("math-paddingTop", "5");
    expect(host.querySelector<HTMLInputElement>("#math-paddingTop")?.value).toBe("5");
    await undo(); expect(host.querySelector<HTMLInputElement>("#math-paddingTop")?.value).toBe("");
    await redo(); expect(host.querySelector<HTMLInputElement>("#math-paddingTop")?.value).toBe("5");

    await selectValue("math-fill-mode", "gradient");
    expect(host.querySelector<HTMLSelectElement>("#math-fill-mode")?.value).toBe("gradient");
    await undo(); expect(host.querySelector<HTMLSelectElement>("#math-fill-mode")?.value).toBe("color");
    await redo(); expect(host.querySelector<HTMLSelectElement>("#math-fill-mode")?.value).toBe("gradient");

    await editNumber("math-fill-gradient-angle", "90");
    expect(host.querySelector<HTMLInputElement>("#math-fill-gradient-angle")?.value).toBe("90");
    await undo(); expect(host.querySelector<HTMLInputElement>("#math-fill-gradient-angle")?.value).toBe("135");
    await redo(); expect(host.querySelector<HTMLInputElement>("#math-fill-gradient-angle")?.value).toBe("90");

    const backgroundPalette = host.querySelector<HTMLButtonElement>('button[aria-controls="math-background-color-palette-chooser"]');
    if (!backgroundPalette) throw new Error("Math background palette control missing");
    await act(async () => backgroundPalette.click());
    const accent = host.querySelector<HTMLButtonElement>('button[aria-label="Apply palette color Accent"]');
    if (!accent) throw new Error("Accent palette entry missing");
    await act(async () => accent.click());
    expect(host.textContent).toContain("Linked to presentation palette");
    await undo(); expect(host.textContent).not.toContain("Linked to presentation palette");
    await redo(); expect(host.textContent).toContain("Linked to presentation palette");

    await selectValue("math-background-gradient-type", "linear");
    expect(host.querySelector<HTMLSelectElement>("#math-background-gradient-type")?.value).toBe("linear");
    await undo(); expect(host.querySelector<HTMLSelectElement>("#math-background-gradient-type")?.value).toBe("none");
    await redo(); expect(host.querySelector<HTMLSelectElement>("#math-background-gradient-type")?.value).toBe("linear");

    await selectValue("math-border-style", "solid");
    expect(host.querySelector<HTMLSelectElement>("#math-border-style")?.value).toBe("solid");
    await undo(); expect(host.querySelector<HTMLSelectElement>("#math-border-style")?.value).toBe("none");
    await redo(); expect(host.querySelector<HTMLSelectElement>("#math-border-style")?.value).toBe("solid");

    const borderPalette = host.querySelector<HTMLButtonElement>('button[aria-controls="math-border-color-palette-chooser"]');
    if (!borderPalette) throw new Error("Math border palette control missing");
    await act(async () => borderPalette.click());
    const borderAccent = host.querySelector<HTMLButtonElement>('button[aria-label="Apply palette color Accent"]');
    if (!borderAccent) throw new Error("Accent border palette entry missing");
    await act(async () => borderAccent.click());
    expect(host.querySelector<HTMLInputElement>("#math-border-color-value")?.value).toBe("#abcdef");
    await undo(); expect(host.querySelector<HTMLInputElement>("#math-border-color-value")?.value).toBe("#94a3b8");
    await redo(); expect(host.querySelector<HTMLInputElement>("#math-border-color-value")?.value).toBe("#abcdef");

    await selectValue("math-border-paint", "gradient");
    expect(host.querySelector<HTMLSelectElement>("#math-border-paint")?.value).toBe("gradient");
    await undo(); expect(host.querySelector<HTMLSelectElement>("#math-border-paint")?.value).toBe("color");
    await redo(); expect(host.querySelector<HTMLSelectElement>("#math-border-paint")?.value).toBe("gradient");

    await editNumber("math-border-width", "4");
    expect(host.querySelector<HTMLInputElement>("#math-border-width")?.value).toBe("4");
    await undo(); expect(host.querySelector<HTMLInputElement>("#math-border-width")?.value).toBe("1");
    await redo(); expect(host.querySelector<HTMLInputElement>("#math-border-width")?.value).toBe("4");

    await editNumber("math-border-radius", "12");
    expect(host.querySelector<HTMLInputElement>("#math-border-radius")?.value).toBe("12");
    await undo(); expect(host.querySelector<HTMLInputElement>("#math-border-radius")?.value).toBe("0");
    await redo(); expect(host.querySelector<HTMLInputElement>("#math-border-radius")?.value).toBe("12");
  });

  it("records Math opacity, shadow, and glow as independent history actions", async () => {
    await mount(); await selectMath();
    const opacity = host.querySelector<HTMLInputElement>("#math-opacity");
    if (!opacity) throw new Error("Math opacity control missing");
    await act(async () => { opacity.focus(); setInput(opacity, "40"); opacity.blur(); });
    expect(host.querySelector<HTMLInputElement>("#math-opacity")?.value).toBe("40");
    await undo(); expect(host.querySelector<HTMLInputElement>("#math-opacity")?.value).toBe("100");
    await redo(); expect(host.querySelector<HTMLInputElement>("#math-opacity")?.value).toBe("40");

    const selectValue = async (id: string, value: string) => {
      const select = host.querySelector<HTMLSelectElement>(`#${id}`);
      if (!select) throw new Error(`${id} control missing`);
      await act(async () => { select.value = value; select.dispatchEvent(new Event("change", { bubbles: true })); });
    };
    const editNumber = async (id: string, value: string) => {
      const input = host.querySelector<HTMLInputElement>(`#${id}`);
      if (!input) throw new Error(`${id} control missing`);
      await act(async () => { input.focus(); setInput(input, value); input.blur(); });
    };
    await selectValue("math-shadow-mode", "outer");
    expect(host.querySelector<HTMLSelectElement>("#math-shadow-mode")?.value).toBe("outer");
    await undo(); expect(host.querySelector<HTMLSelectElement>("#math-shadow-mode")?.value).toBe("none");
    await redo(); expect(host.querySelector<HTMLSelectElement>("#math-shadow-mode")?.value).toBe("outer");
    await editNumber("math-shadow-x", "3");
    expect(host.querySelector<HTMLInputElement>("#math-shadow-x")?.value).toBe("3");
    await undo(); expect(host.querySelector<HTMLInputElement>("#math-shadow-x")?.value).toBe("0");
    await redo(); expect(host.querySelector<HTMLInputElement>("#math-shadow-x")?.value).toBe("3");
    await selectValue("math-glow-mode", "glow");
    expect(host.querySelector<HTMLSelectElement>("#math-glow-mode")?.value).toBe("glow");
    await undo(); expect(host.querySelector<HTMLSelectElement>("#math-glow-mode")?.value).toBe("none");
    await redo(); expect(host.querySelector<HTMLSelectElement>("#math-glow-mode")?.value).toBe("glow");
    await editNumber("math-glow-blur", "18");
    expect(host.querySelector<HTMLInputElement>("#math-glow-blur")?.value).toBe("18");
    await undo(); expect(host.querySelector<HTMLInputElement>("#math-glow-blur")?.value).toBe("12");
    await redo(); expect(host.querySelector<HTMLInputElement>("#math-glow-blur")?.value).toBe("18");
    expect(host.querySelector<HTMLInputElement>("#math-opacity")?.value).toBe("40");
    expect(host.querySelector<HTMLSelectElement>("#math-shadow-mode")?.value).toBe("outer");
  });

  it("records Math URL, target, and link removal in shared Undo/Redo history", async () => {
    await mount(); await selectMath();
    const url = host.querySelector<HTMLInputElement>("#math-link-url");
    const target = host.querySelector<HTMLSelectElement>("#math-link-target");
    if (!url || !target) throw new Error("Math Interaction controls missing");
    await act(async () => { url.focus(); setInput(url, "javascript:alert(1)"); url.blur(); });
    expect(host.querySelector('[data-presentation-math-preview] a')).toBeNull();
    expect(sourceInput().value).toBe("x^2");

    const invalidMessage = Array.from(host.querySelectorAll("small")).find(node => node.textContent?.includes("valid HTTP or HTTPS URL"));
    expect(invalidMessage).toBeDefined();
    expect((await undo()).defaultPrevented).toBe(false);

    await act(async () => { const input = host.querySelector<HTMLInputElement>("#math-link-url")!; input.focus(); setInput(input, "https://example.com/math?a=1&b=2"); input.blur(); });
    const linkedAnchor = host.querySelector<HTMLAnchorElement>("[data-presentation-math-preview] a[data-presentation-link='true']");
    expect(linkedAnchor?.getAttribute("href")).toBe("https://example.com/math?a=1&b=2");
    await undo(); expect(host.querySelector("[data-presentation-math-preview] a")).toBeNull();
    await redo(); expect(host.querySelector("[data-presentation-math-preview] a")).not.toBeNull();

    await act(async () => { const currentTarget = host.querySelector<HTMLSelectElement>("#math-link-target")!; currentTarget.value = "new"; currentTarget.dispatchEvent(new Event("change", { bubbles: true })); });
    expect(host.querySelector<HTMLAnchorElement>("[data-presentation-math-preview] a")?.target).toBe("_blank");
    await undo(); expect(host.querySelector<HTMLAnchorElement>("[data-presentation-math-preview] a")?.target).toBe("");
    await redo(); expect(host.querySelector<HTMLAnchorElement>("[data-presentation-math-preview] a")?.target).toBe("_blank");

    const remove = Array.from(host.querySelectorAll<HTMLButtonElement>("button")).find(button => button.textContent?.includes("Remove link"));
    if (!remove) throw new Error("Math remove-link control missing");
    await act(async () => remove.click());
    expect(host.querySelector("[data-presentation-math-preview] a")).toBeNull();
    await undo(); expect(host.querySelector<HTMLAnchorElement>("[data-presentation-math-preview] a")?.target).toBe("_blank");
    await redo(); expect(host.querySelector("[data-presentation-math-preview] a")).toBeNull();
    expect(sourceInput().value).toBe("x^2");
  });
});
