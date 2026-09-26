// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { PresentationSchema, type LinkedCodeStyle, type LinkedDividerStyle, type LinkedSimpleTableStyle, type LinkedStructuredTableStyle, type LinkedTerminalStyle, type Presentation } from "@web-slideshow/document-schema";
import { renderElement } from "@web-slideshow/renderer";

import { EditorWorkspace } from "../src/features/editor/editor-workspace";
import { createLinkedTargetStylePreview } from "../src/features/editor/resources/custom-resources-workspace";
import { StudioI18nProvider } from "../src/features/i18n/studio-i18n-context";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

const repositories = { listPalettes: async () => [], listFonts: async () => [] } as never;

function presentation(linkedStyles: object[], elements: object[] = []): Presentation {
  return PresentationSchema.parse({
    schemaVersion: 1,
    id: "lsx4b2b-resources",
    title: "LSX4B2B",
    linkedStyles,
    slides: [{ id: "slide", title: "Slide", elements }],
  });
}

function matrixPresentation(): Presentation {
  return presentation([
    { target: "code", id: "code", name: "Code", typography: { fontSize: 16 }, style: { color: "#111111", background: { color: "#222222", gradient: { type: "linear", stops: [{ color: "#000000", position: 0 }, { color: "#ffffff", position: 1 }] } } }, effect: { opacity: 0 } },
    { target: "terminal", id: "terminal", name: "Terminal", typography: { fontSize: 14 }, titleTypography: { fontSize: 18, fontWeight: 700, fontStyle: "italic", textTransform: "uppercase" }, style: { outputColor: "#123456", promptColor: "#234567", commandColor: "#345678", commentColor: "#456789", errorColor: "#56789a", background: { color: "#101010" }, border: { width: 1, style: "solid", color: "#ffffff" } }, effect: { opacity: 0 } },
    { target: "table", mode: "simple", id: "simple", name: "Simple", style: { color: "#111111" }, typography: { fontSize: 14 } },
    { target: "table", mode: "structured", id: "structured", name: "Structured", style: { headerBackground: "#111111", bodyRowAlternateBackground: "#222222", dividerOpacity: 0 }, effect: { opacity: 0 } },
    { target: "divider", id: "divider", name: "Divider", layout: { position: "absolute", width: "80%", height: "2px" }, style: { background: { color: "#111111", gradient: { type: "linear", stops: [{ color: "#000000", position: 0 }, { color: "#ffffff", position: 1 }] } }, borderRadius: "2px" }, effect: { opacity: 0 } },
  ]);
}

function button(host: HTMLElement, text: string): HTMLButtonElement {
  const result = Array.from(host.querySelectorAll<HTMLButtonElement>("button")).find((candidate) => candidate.textContent?.trim() === text || candidate.textContent?.includes(text));
  if (!result) throw new Error(`Button not found: ${text}`);
  return result;
}

function inputValue(input: HTMLInputElement, value: string): void {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
  if (!setter) throw new Error("Input setter unavailable");
  setter.call(input, value);
  input.dispatchEvent(new Event("input", { bubbles: true }));
  input.dispatchEvent(new Event("change", { bubbles: true }));
}

describe("LSX4B2B target Linked Style Resources", () => {
  let host: HTMLDivElement;
  let root: Root;
  let saved: Presentation[];

  beforeEach(() => {
    host = document.createElement("div");
    document.body.appendChild(host);
    root = createRoot(host);
    saved = [];
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    document.body.innerHTML = "";
  });

  async function mount(initial: Presentation, target?: { kind: "root-definition"; rootDefinitionId: string }): Promise<void> {
    await act(async () => root.render(<StudioI18nProvider><EditorWorkspace initialPresentation={initial} {...(target ? { initialAuthoringTarget: target } : {})} onSave={async (snapshot) => { saved.push(structuredClone(snapshot)); }} customLibraryPaletteRepository={repositories} customLibraryFontRepository={repositories} /></StudioI18nProvider>));
  }

  async function openResources(): Promise<void> {
    await act(async () => button(host, "Custom Resources").click());
    const details = Array.from(host.querySelectorAll<HTMLDetailsElement>("details")).find((candidate) => candidate.querySelector("summary")?.textContent?.includes("Linked Styles"));
    if (!details) throw new Error("Linked Styles section not found");
    if (!details.open) await act(async () => details.querySelector("summary")?.dispatchEvent(new MouseEvent("click", { bubbles: true })));
  }

  async function openRow(id: string): Promise<HTMLElement> {
    const row = host.querySelector<HTMLElement>(`[data-linked-style-id='${id}']`);
    if (!row) throw new Error(`Row not found: ${id}`);
    await act(async () => row.querySelector<HTMLButtonElement>(":scope > button")?.click());
    return row;
  }

  async function save(): Promise<Presentation> {
    await act(async () => button(host, "Save").click());
    const result = saved.at(-1);
    if (!result) throw new Error("Save did not produce a snapshot");
    return result;
  }

  async function undo(): Promise<void> {
    await act(async () => window.dispatchEvent(new KeyboardEvent("keydown", { key: "z", ctrlKey: true, bubbles: true, cancelable: true })));
  }

  async function redo(): Promise<void> {
    await act(async () => window.dispatchEvent(new KeyboardEvent("keydown", { key: "z", ctrlKey: true, shiftKey: true, bubbles: true, cancelable: true })));
  }

  it("renders the complete target matrix and only compatible authored groups", async () => {
    await mount(matrixPresentation());
    await openResources();
    const code = await openRow("code");
    expect(code.querySelector("input")).not.toBeNull();
    expect(code.querySelector("[data-linked-style-preview] .presentation-code")).not.toBeNull();
    expect(code.querySelector("[data-linked-style-property='typography.fontSize']")).not.toBeNull();
    expect(code.querySelector("[data-linked-style-property='style.color']")).not.toBeNull();
    expect(code.querySelector("[data-linked-style-property='effect.opacity']")).not.toBeNull();
    expect(code.textContent).toContain("Add property");
    expect(code.querySelector("[data-linked-style-property='style.outputColor']")).toBeNull();

    const terminal = await openRow("terminal");
    expect(terminal.querySelector("[data-linked-style-preview] .presentation-terminal")).not.toBeNull();
    for (const property of ["typography.fontSize", "titleTypography.fontSize", "titleTypography.fontWeight", "titleTypography.fontStyle", "titleTypography.textTransform", "style.outputColor", "style.promptColor"]) expect(terminal.querySelector(`[data-linked-style-property='${property}']`)).not.toBeNull();
    expect(terminal.querySelector("[data-linked-style-property='style.color']")).toBeNull();

    const simple = await openRow("simple");
    expect(simple.querySelector("[data-linked-style-preview] .presentation-table")).not.toBeNull();
    expect(simple.querySelector("[data-linked-style-property='typography.fontSize']")).not.toBeNull();
    expect(simple.querySelector("[data-linked-style-property='style.color']")).not.toBeNull();
    expect(simple.querySelector("[data-linked-style-property='typography.letterSpacing']")).toBeNull();
    expect(simple.querySelector("[data-linked-style-property='style.headerBackground']")).toBeNull();

    const structured = await openRow("structured");
    expect(structured.querySelector("[data-linked-style-preview] .presentation-table")).not.toBeNull();
    for (const property of ["style.headerBackground", "style.bodyRowAlternateBackground", "style.dividerOpacity"]) expect(structured.querySelector(`[data-linked-style-property='${property}']`)).not.toBeNull();
    expect(structured.querySelector("[data-linked-style-section='typography']")).toBeNull();
    expect(structured.querySelector("[data-linked-style-property='style.color']")).toBeNull();

    const divider = await openRow("divider");
    expect(divider.querySelector("[data-linked-style-preview] .presentation-divider")).not.toBeNull();
    for (const property of ["layout.position", "layout.width", "layout.height", "style.background.color", "style.background.gradient", "style.borderRadius", "effect.opacity"]) expect(divider.querySelector(`[data-linked-style-property='${property}']`)).not.toBeNull();
    for (const property of ["layout.margin", "style.border", "effect.shadow", "typography.fontSize"]) expect(divider.querySelector(`[data-linked-style-property='${property}']`)).toBeNull();
  });

  it("creates valid transient previews through the canonical renderer", () => {
    const styles = matrixPresentation().linkedStyles ?? [];
    for (const style of styles) {
      const targetStyle = style as LinkedCodeStyle | LinkedTerminalStyle | LinkedSimpleTableStyle | LinkedStructuredTableStyle | LinkedDividerStyle;
      const preview = createLinkedTargetStylePreview(targetStyle);
      expect("linkedStyleId" in preview && preview.linkedStyleId).toBe(style.id);
      if ("target" in style && style.target === "table") expect(preview.type).toBe("table");
      else if ("target" in style) expect(preview.type).toBe(style.target);
      if ("target" in style && style.target === "table" && preview.type === "table") expect(preview.mode).toBe(style.mode);
      const html = renderElement(preview, { presentation: matrixPresentation() });
      expect(html).toContain("data-presentation-type");
      expect(preview).not.toHaveProperty("style");
      expect(preview).not.toHaveProperty("typography");
      expect(preview).not.toHaveProperty("effect");
    }
  });

  it("preserves falsey opacity values and independent Terminal typography bags", async () => {
    await mount(matrixPresentation());
    await openResources();
    const code = await openRow("code");
    expect(code.querySelector<HTMLInputElement>("[data-linked-style-property='effect.opacity'] input")?.value).toBe("0");
    const structured = await openRow("structured");
    expect(structured.querySelector<HTMLInputElement>("[data-linked-style-property='style.dividerOpacity'] input")?.value).toBe("0");
    const terminal = await openRow("terminal");
    const bodyFontSize = terminal.querySelector<HTMLButtonElement>("[data-linked-style-property='typography.fontSize'] [data-linked-style-property-remove]");
    expect(bodyFontSize).not.toBeNull();
    await act(async () => bodyFontSize?.click());
    expect(terminal.querySelector("[data-linked-style-property='typography.fontSize']")).toBeNull();
    expect(terminal.querySelector("[data-linked-style-property='titleTypography.fontSize']")).not.toBeNull();
  });

  it("rerenders the preview from the changed Presentation definition", async () => {
    const initial = presentation([{ target: "code", id: "code", name: "Code", style: { color: "#111111", borderRadius: "2px" } }]);
    await mount(initial);
    await openResources();
    const row = await openRow("code");
    const preview = () => row.querySelector<HTMLElement>("[data-linked-style-preview] .presentation-code");
    expect(preview()?.getAttribute("style")).toContain("border-radius:2px");
    const radius = row.querySelector<HTMLInputElement>("[data-linked-style-property='style.borderRadius'] input");
    if (!radius) throw new Error("Border radius control was not rendered");
    await act(async () => { inputValue(radius, "8"); });
    expect(preview()?.getAttribute("style")).toContain("border-radius:8px");
  });

  it("adds a property through Resources and propagates ownership across all authoring owners with Undo/Redo", async () => {
    const initial = PresentationSchema.parse({
      schemaVersion: 1, id: "owners", title: "Owners", linkedStyles: [{ target: "code", id: "code", name: "Code", typography: { fontSize: 16 } }],
      slides: [
        { id: "slide", title: "Slide", elements: [{ id: "slide-code", type: "code", hidden: false, code: "slide", linkedStyleId: "code", style: { color: "#aaaaaa", borderRadius: 1 } }] },
        { id: "root-slide", title: "Root", elements: [], rootDefinitionId: "root", localRootChildren: [{ targetContainerId: "receiver", children: [{ id: "local-code", type: "code", hidden: false, code: "local", linkedStyleId: "code", style: { color: "#bbbbbb", borderRadius: 2 } }] }] },
      ],
      rootDefinitions: [{ id: "root", name: "Root", localChildTargetIds: ["receiver"], root: { id: "root-container", type: "container", hidden: false, children: [{ id: "receiver", type: "container", hidden: false, children: [] }, { id: "root-code", type: "code", hidden: false, code: "root", linkedStyleId: "code", style: { color: "#cccccc", borderRadius: 3 } }] } }],
    });
    await mount(initial, { kind: "root-definition", rootDefinitionId: "root" });
    await openResources();
    const row = await openRow("code");
    await act(async () => button(row, "Add property").click());
    const chooser = row.querySelector<HTMLElement>("[data-linked-style-property-chooser]");
    if (!chooser) throw new Error("Target property chooser not rendered");
    await act(async () => button(chooser, "Color").click());
    const changed = await save();
    expect(changed.linkedStyles?.[0]).toMatchObject({ style: { color: expect.any(String) } });
    expect(changed.slides[0]?.elements[0]).toMatchObject({ linkedStyleId: "code", style: { borderRadius: 1 } });
    expect(changed.slides[0]?.elements[0]).not.toHaveProperty("style.color");
    expect(changed.slides[1]?.localRootChildren?.[0]?.children[0]).not.toHaveProperty("style.color");
    expect(changed.rootDefinitions?.[0]?.root.children[1]).not.toHaveProperty("style.color");
    await undo();
    expect(await save()).toEqual(initial);
    await redo();
    expect(await save()).toEqual(changed);
  });

  it("removes a definition property without materializing the linked value and preserves nested members", async () => {
    const initial = presentation([{ target: "code", id: "code", name: "Code", style: { color: "#111111", background: { color: "#222222", gradient: { type: "linear", stops: [{ color: "#000000", position: 0 }, { color: "#ffffff", position: 1 }] } } } }], [{ id: "code-element", type: "code", hidden: false, code: "x", linkedStyleId: "code", style: { color: "#999999", borderRadius: 8 } }]);
    await mount(initial);
    await openResources();
    const row = await openRow("code");
    const removeColor = row.querySelector<HTMLButtonElement>("[data-linked-style-property='style.color'] [data-linked-style-property-remove]");
    expect(removeColor).not.toBeNull();
    await act(async () => { removeColor?.click(); await Promise.resolve(); });
    const changed = await save();
    expect(changed.linkedStyles?.[0]).not.toHaveProperty("style.color");
    expect(changed.linkedStyles?.[0]).toHaveProperty("style.background.color", "#222222");
    expect(changed.linkedStyles?.[0]).toHaveProperty("style.background.gradient");
    expect(changed.slides[0]?.elements[0]).not.toHaveProperty("style.color");
    expect(changed.slides[0]?.elements[0]).toHaveProperty("style.borderRadius", 8);
    await undo();
    expect(await save()).toEqual(initial);
    await redo();
    expect(await save()).toEqual(changed);
  });

  it("enforces last-property and position dependencies in the Resources chooser", async () => {
    await mount(presentation([{ target: "code", id: "code", name: "Code", style: { color: "#111111" } }]));
    await openResources();
    const row = await openRow("code");
    const onlyRemove = row.querySelector<HTMLButtonElement>("[data-linked-style-property='style.color'] [data-linked-style-property-remove]");
    expect(onlyRemove?.disabled).toBe(true);
    await act(async () => button(row, "Add property").click());
    let chooser = row.querySelector<HTMLElement>("[data-linked-style-property-chooser]");
    expect(chooser?.textContent).not.toContain("Top");
    await act(async () => button(chooser!, "Position").click());
    await act(async () => button(row, "Add property").click());
    chooser = row.querySelector<HTMLElement>("[data-linked-style-property-chooser]");
    expect(chooser?.textContent).toContain("Top");
    await act(async () => button(chooser!, "Top").click());
    const liveRow = host.querySelector<HTMLElement>("[data-linked-style-id='code']");
    expect(liveRow?.querySelector("[data-linked-style-property='layout.top']")).not.toBeNull();
    expect(liveRow?.querySelector<HTMLButtonElement>("[data-linked-style-property='layout.position'] [data-linked-style-property-remove]")?.disabled).toBe(true);
  });

  it("renames a target through Resources with exact Undo/Redo identity", async () => {
    const initial = presentation([{ target: "terminal", id: "terminal", name: "Terminal", style: { outputColor: "#111111" } }]);
    await mount(initial);
    await openResources();
    const row = await openRow("terminal");
    const name = row.querySelector<HTMLInputElement>("input[value='Terminal']");
    if (!name) throw new Error("Target name field not found");
    await act(async () => { inputValue(name, " Renamed "); });
    await act(async () => { name.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true })); });
    const changed = await save();
    expect(changed.linkedStyles?.[0]).toMatchObject({ id: "terminal", target: "terminal", name: "Renamed", style: { outputColor: "#111111" } });
    await undo();
    expect(await save()).toEqual(initial);
    await redo();
    expect(await save()).toEqual(changed);
  });
});
