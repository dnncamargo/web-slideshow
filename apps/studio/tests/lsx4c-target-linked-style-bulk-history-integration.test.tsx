// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { PresentationSchema, type Presentation, type PresentationElement } from "@web-slideshow/document-schema";

import { EditorWorkspace } from "../src/features/editor/editor-workspace";
import { StudioI18nProvider } from "../src/features/i18n/studio-i18n-context";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

const STYLE_ID = "lsx4c-code-style";
const OTHER_STYLE_ID = "lsx4c-other-style";
const repositories = { listPalettes: async () => [], listFonts: async () => [] } as never;

function code(id: string, color: string, extra: Record<string, unknown> = {}): PresentationElement {
  return { id, type: "code", hidden: false, code: "const answer = 42", language: "ts", showLineNumbers: false, highlightedLines: [], style: { color, className: `${id}-local` }, ...extra };
}

function initialPresentation(): Presentation {
  return PresentationSchema.parse({
    schemaVersion: 1,
    id: "lsx4c-target-history",
    title: "LSX4C target history",
    linkedStyles: [
      { target: "code", id: STYLE_ID, name: "Code Style", style: { color: "#123456" } },
      { target: "code", id: OTHER_STYLE_ID, name: "Other Style", style: { color: "#654321" } },
    ],
    slides: [
      { id: "ordinary", title: "Ordinary", elements: [
        { id: "nested-parent", type: "container", hidden: false, children: [code("nested-match", "#123456")] },
        code("ordinary-match", "#123456"),
        code("nonmatch", "#abcdef"),
        code("already-same", "#123456", { linkedStyleId: STYLE_ID }),
        code("already-other", "#123456", { linkedStyleId: OTHER_STYLE_ID }),
      ] },
      { id: "root-slide", title: "Root Slide", rootDefinitionId: "root-1", elements: [], localRootChildren: [{ targetContainerId: "root", children: [code("local-match", "#123456")] }] },
    ],
    rootDefinitions: [{ id: "root-1", name: "Root", localChildTargetIds: ["root"], root: {
      id: "root", type: "container", hidden: false, children: [code("root-match", "#123456")],
    } }],
  });
}

function definitionEditPresentation(): Presentation {
  return PresentationSchema.parse({
    schemaVersion: 1,
    id: "lsx4c-current-match-set",
    title: "LSX4C current match set",
    linkedStyles: [{ target: "code", id: STYLE_ID, name: "Code Style", style: { color: "#123456" }, effect: { opacity: 0.2 } }],
    slides: [{ id: "slide", title: "Slide", elements: [
      code("candidate-a", "#123456", { effect: { opacity: 0.2 } }),
      code("candidate-b", "#123456", { effect: { opacity: 0.8 } }),
    ] }],
    rootDefinitions: [{ id: "root-1", name: "Root", localChildTargetIds: [], root: { id: "root", type: "container", hidden: false, children: [] } }],
  });
}

function findElement(elements: readonly PresentationElement[], id: string): PresentationElement | undefined {
  for (const element of elements) {
    if (element.id === id) return element;
    if (element.type === "container") {
      const nested = findElement(element.children, id);
      if (nested) return nested;
    }
  }
  return undefined;
}

function findCanonical(document: Presentation, id: string): PresentationElement {
  for (const slide of document.slides) {
    const ordinary = findElement(slide.elements, id);
    if (ordinary) return ordinary;
    for (const entry of slide.localRootChildren ?? []) {
      const local = findElement(entry.children, id);
      if (local) return local;
    }
  }
  for (const definition of document.rootDefinitions ?? []) {
    const root = findElement([definition.root], id);
    if (root) return root;
  }
  throw new Error(`Element not found: ${id}`);
}

describe("LSX4C target linked-style bulk history", () => {
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

  async function mount(initial: Presentation): Promise<void> {
    await act(async () => root.render(<StudioI18nProvider><EditorWorkspace initialPresentation={initial} initialAuthoringTarget={{ kind: "root-definition", rootDefinitionId: "root-1" }} onSave={async (snapshot) => { saved.push(structuredClone(snapshot)); }} customLibraryPaletteRepository={repositories} customLibraryFontRepository={repositories} /></StudioI18nProvider>));
  }

  async function openRow(): Promise<HTMLElement> {
    const resources = Array.from(host.querySelectorAll<HTMLButtonElement>("button")).find((button) => button.textContent?.trim() === "Custom Resources");
    if (!resources) throw new Error("Custom Resources was not rendered");
    await act(async () => resources.click());
    const linkedStyles = Array.from(host.querySelectorAll<HTMLDetailsElement>("details")).find((details) => details.querySelector("summary")?.textContent?.includes("Linked Styles"));
    if (!linkedStyles) throw new Error("Linked Styles was not rendered");
    if (!linkedStyles.open) await act(async () => linkedStyles.querySelector("summary")?.dispatchEvent(new MouseEvent("click", { bubbles: true })));
    const row = host.querySelector<HTMLElement>(`[data-linked-style-id="${STYLE_ID}"]`);
    if (!row) throw new Error("Code resource was not rendered");
    await act(async () => row.querySelector<HTMLButtonElement>(":scope > button")?.click());
    return row;
  }

  function attachButton(row: HTMLElement): HTMLButtonElement {
    const reuse = row.querySelector<HTMLElement>("[data-linked-style-section='reuse']");
    const button = Array.from(reuse?.querySelectorAll<HTMLButtonElement>("button") ?? []).find((candidate) => candidate.textContent?.trim().startsWith("Attach "));
    if (!button) throw new Error("Attach button was not rendered");
    return button;
  }

  async function save(): Promise<Presentation> {
    const button = Array.from(host.querySelectorAll<HTMLButtonElement>("button")).find((candidate) => candidate.textContent?.trim() === "Save");
    if (!button) throw new Error("Save was not rendered");
    await act(async () => button.click());
    const snapshot = saved.at(-1);
    if (!snapshot) throw new Error("Save produced no snapshot");
    return snapshot;
  }

  async function undo(): Promise<void> {
    await act(async () => window.dispatchEvent(new KeyboardEvent("keydown", { key: "z", ctrlKey: true, bubbles: true, cancelable: true })));
  }

  async function redo(): Promise<void> {
    await act(async () => window.dispatchEvent(new KeyboardEvent("keydown", { key: "z", ctrlKey: true, shiftKey: true, bubbles: true, cancelable: true })));
  }

  function setInputValue(input: HTMLInputElement, value: string): void {
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
    if (!setter) throw new Error("Input setter unavailable");
    setter.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
  }

  it("attaches current matches across all owners as one atomic action and preserves selection", async () => {
    const initial = initialPresentation();
    const initialSnapshot = structuredClone(initial);
    await mount(initial);
    await act(async () => host.querySelector<HTMLElement>('[data-presentation-id="root-match"]')?.dispatchEvent(new Event("pointerdown", { bubbles: true })));
    expect(host.querySelector<HTMLElement>('[data-presentation-id="root-match"]')?.classList.contains("studio-editor-selected")).toBe(true);

    const row = await openRow();
    expect(row.textContent).toContain("Matching 4 elements");
    expect(row.textContent).toContain("Used by 1 element");
    expect(attachButton(row).textContent).toContain("Attach 4");
    await act(async () => attachButton(row).click());

    const postBulk = await save();
    expect(postBulk.linkedStyles).toEqual(initialSnapshot.linkedStyles);
    for (const id of ["ordinary-match", "nested-match", "local-match", "root-match"]) expect(findCanonical(postBulk, id)).toMatchObject({ linkedStyleId: STYLE_ID });
    for (const id of ["nonmatch", "already-same", "already-other"]) expect(findCanonical(postBulk, id)).toEqual(findCanonical(initialSnapshot, id));
    expect(host.querySelector<HTMLElement>('[data-presentation-id="root-match"]')?.classList.contains("studio-editor-selected")).toBe(true);
    expect(row.textContent).toContain("Matching 0 elements");
    expect(row.textContent).toContain("Used by 5 elements");

    await undo();
    expect(await save()).toEqual(initialSnapshot);
    expect(host.querySelector<HTMLElement>('[data-presentation-id="root-match"]')?.classList.contains("studio-editor-selected")).toBe(true);
    await redo();
    expect(await save()).toEqual(postBulk);
    expect(host.querySelector<HTMLElement>('[data-presentation-id="root-match"]')?.classList.contains("studio-editor-selected")).toBe(true);
  });

  it("recomputes matching after a Resources definition edit before attaching", async () => {
    const initial = definitionEditPresentation();
    const initialSnapshot = structuredClone(initial);
    await mount(initial);
    const row = await openRow();
    expect(row.textContent).toContain("Matching 1 element");
    expect(row.textContent).toContain("Attach 1");

    const opacity = row.querySelector<HTMLInputElement>("[data-linked-style-property='effect.opacity'] input");
    if (!opacity) throw new Error("Opacity editor was not rendered");
    await act(async () => { opacity.focus(); setInputValue(opacity, "80"); opacity.blur(); });
    expect(row.textContent).toContain("Matching 1 element");
    expect(row.textContent).toContain("Attach 1");
    expect(findCanonical(initial, "candidate-a")).not.toHaveProperty("linkedStyleId");

    await act(async () => attachButton(row).click());
    const final = await save();
    expect(findCanonical(final, "candidate-a")).not.toHaveProperty("linkedStyleId");
    expect(findCanonical(final, "candidate-b")).toMatchObject({ linkedStyleId: STYLE_ID });

    await undo();
    const afterBulkUndo = await save();
    expect(findCanonical(afterBulkUndo, "candidate-a")).not.toHaveProperty("linkedStyleId");
    expect(findCanonical(afterBulkUndo, "candidate-b")).not.toHaveProperty("linkedStyleId");
    expect(afterBulkUndo.linkedStyles?.[0]).toMatchObject({ effect: { opacity: 0.8 } });
    await undo();
    expect(await save()).toEqual(initialSnapshot);
    await redo();
    await redo();
    expect(await save()).toEqual(final);
  });
});
