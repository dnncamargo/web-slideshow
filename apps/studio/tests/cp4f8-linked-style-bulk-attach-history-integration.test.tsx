// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  PresentationSchema,
  type ContainerElement,
  type PresentationElement,
  type Presentation,
} from "@web-slideshow/document-schema";

import { EditorWorkspace } from "../src/features/editor/editor-workspace";
import { StudioI18nProvider } from "../src/features/i18n/studio-i18n-context";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

const TARGET_STYLE_ID = "cp4f8-target-style";
const OTHER_STYLE_ID = "cp4f8-other-style";

const TARGET_STYLE = {
  id: TARGET_STYLE_ID,
  name: "Target Container Style",
  layout: { children: { gap: 8 } },
  style: { color: "#123456" },
} as const;

const OTHER_STYLE = {
  id: OTHER_STYLE_ID,
  name: "Other Container Style",
  layout: { children: { gap: 2 } },
} as const;

const repositories = { listPalettes: async () => [], listFonts: async () => [] } as never;

function text(id: string, content: string): PresentationElement {
  return { id, type: "text", hidden: false, variant: "body", content };
}

function container(id: string, overrides: Partial<ContainerElement> = {}): ContainerElement {
  return {
    id,
    type: "container",
    hidden: false,
    layout: { children: { gap: 8 }, margin: 7 },
    style: { className: `${id}-local`, color: "#123456" },
    children: [text(`${id}-text`, "Keep this child")],
    ...overrides,
  };
}

type SlideInput = { id: string; title: string; elements: PresentationElement[] };

function presentation(slides: SlideInput[]): Presentation {
  return PresentationSchema.parse({
    schemaVersion: 1,
    id: "cp4f8-linked-style-bulk-attach-history",
    title: "CP4F8 linked style bulk attach history",
    slides,
    linkedStyles: [TARGET_STYLE, OTHER_STYLE],
  });
}

function key(options: KeyboardEventInit): KeyboardEvent {
  return new KeyboardEvent("keydown", { key: "z", bubbles: true, cancelable: true, ...options });
}

function setInputValue(input: HTMLInputElement, value: string): void {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
  if (!setter) throw new Error("expected HTMLInputElement.value setter");
  setter.call(input, value);
  input.dispatchEvent(new Event("input", { bubbles: true }));
  input.dispatchEvent(new Event("change", { bubbles: true }));
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

function elementFrom(document: Presentation, id: string): PresentationElement {
  for (const slide of document.slides) {
    const element = findElement(slide.elements, id);
    if (element) return element;
  }
  throw new Error(`Element was not found: ${id}`);
}

describe("CP4F8 linked style bulk attach history", () => {
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

  async function mount(initial: Presentation, saved: Presentation[]): Promise<void> {
    await act(async () => root.render(
      <StudioI18nProvider>
        <EditorWorkspace
          initialPresentation={initial}
          onSave={async (snapshot) => { saved.push(structuredClone(snapshot)); }}
          customLibraryPaletteRepository={repositories}
          customLibraryFontRepository={repositories}
        />
      </StudioI18nProvider>,
    ));
  }

  async function selectElement(id: string): Promise<void> {
    const element = host.querySelector<HTMLElement>(`[data-powershow-id="${id}"]`);
    if (!element) throw new Error(`Element was not rendered: ${id}`);
    await act(async () => element.dispatchEvent(new Event("pointerdown", { bubbles: true })));
  }

  async function openLinkedStyleRow(): Promise<HTMLElement> {
    const resourcesButton = Array.from(host.querySelectorAll<HTMLButtonElement>("button"))
      .find((button) => button.textContent?.trim() === "Custom Resources");
    if (!resourcesButton) throw new Error("Custom Resources button was not rendered");
    await act(async () => resourcesButton.click());

    const linkedStyles = Array.from(host.querySelectorAll("details"))
      .find((detail) => detail.querySelector("summary")?.textContent?.includes("Linked Styles"));
    if (!linkedStyles) throw new Error("Linked Styles section was not rendered");
    await act(async () => linkedStyles.querySelector("summary")?.dispatchEvent(new MouseEvent("click", { bubbles: true })));

    const resource = host.querySelector<HTMLElement>(`[data-linked-style-id="${TARGET_STYLE_ID}"]`);
    if (!resource) throw new Error("Target Linked Style resource was not rendered");
    const disclosure = resource.querySelector<HTMLButtonElement>(":scope > button");
    if (!disclosure) throw new Error("Target Linked Style disclosure was not rendered");
    await act(async () => disclosure.click());
    return host.querySelector<HTMLElement>(`[data-linked-style-id="${TARGET_STYLE_ID}"]`)!;
  }

  function attachButton(row: HTMLElement): HTMLButtonElement {
    const reuse = row.querySelector<HTMLElement>("[data-linked-style-section='reuse']");
    if (!reuse) throw new Error("Linked Style reuse section was not rendered");
    const button = Array.from(reuse.querySelectorAll<HTMLButtonElement>("button"))
      .find((candidate) => candidate.textContent?.trim().startsWith("Attach "));
    if (!button) throw new Error("Attach matching button was not rendered");
    return button;
  }

  async function save(saved: Presentation[]): Promise<Presentation> {
    const button = Array.from(host.querySelectorAll<HTMLButtonElement>("button"))
      .find((candidate) => candidate.textContent?.trim() === "Save");
    if (!button) throw new Error("Save button was not rendered");
    await act(async () => button.click());
    const snapshot = saved.at(-1);
    if (!snapshot) throw new Error("Save did not produce a snapshot");
    return snapshot;
  }

  async function undo(): Promise<void> {
    await act(async () => window.dispatchEvent(key({ ctrlKey: true })));
  }

  async function redo(): Promise<void> {
    await act(async () => window.dispatchEvent(key({ ctrlKey: true, shiftKey: true })));
  }

  it("tracks one Resources bulk action for root, nested, and multi-slide matches", async () => {
    const nestedMatch = container("cp4f8-nested-match");
    const initial = presentation([
      { id: "slide-1", title: "Slide 1", elements: [
        container("cp4f8-root-match", { children: [nestedMatch] }),
        container("cp4f8-nonmatch", { layout: { children: { gap: 9 }, margin: 7 } }),
        container("cp4f8-already-target", { linkedStyleId: TARGET_STYLE_ID }),
        container("cp4f8-already-other", { linkedStyleId: OTHER_STYLE_ID }),
      ] },
      { id: "slide-2", title: "Slide 2", elements: [container("cp4f8-second-slide-match")] },
    ]);
    const initialSnapshot = structuredClone(initial);
    const saved: Presentation[] = [];

    await mount(initial, saved);
    await selectElement("cp4f8-root-match");
    const row = await openLinkedStyleRow();
    expect(attachButton(row).textContent).toContain("3");
    await act(async () => attachButton(row).click());

    const postBulk = await save(saved);
    expect(postBulk).not.toEqual(initialSnapshot);
    expect(postBulk.linkedStyles).toEqual(initialSnapshot.linkedStyles);
    expect(elementFrom(postBulk, "cp4f8-root-match")).toMatchObject({ linkedStyleId: TARGET_STYLE_ID, style: { className: "cp4f8-root-match-local" }, layout: { margin: 7 } });
    expect(elementFrom(postBulk, "cp4f8-nested-match")).toMatchObject({ linkedStyleId: TARGET_STYLE_ID, style: { className: "cp4f8-nested-match-local" }, layout: { margin: 7 } });
    expect(elementFrom(postBulk, "cp4f8-second-slide-match")).toMatchObject({ linkedStyleId: TARGET_STYLE_ID, layout: { margin: 7 } });
    expect(elementFrom(postBulk, "cp4f8-root-match")).not.toHaveProperty("layout.children.gap");
    expect(elementFrom(postBulk, "cp4f8-nonmatch")).toEqual(elementFrom(initialSnapshot, "cp4f8-nonmatch"));
    expect(elementFrom(postBulk, "cp4f8-already-target")).toEqual(elementFrom(initialSnapshot, "cp4f8-already-target"));
    expect(elementFrom(postBulk, "cp4f8-already-other")).toEqual(elementFrom(initialSnapshot, "cp4f8-already-other"));
    expect(host.querySelector<HTMLElement>('[data-powershow-id="cp4f8-root-match"]')?.classList.contains("powershow-editor-selected")).toBe(true);

    await undo();
    expect(await save(saved)).toEqual(initialSnapshot);
    expect(host.querySelector<HTMLElement>('[data-powershow-id="cp4f8-root-match"]')?.classList.contains("powershow-editor-selected")).toBe(true);

    await redo();
    expect(await save(saved)).toEqual(postBulk);
    expect(host.querySelector<HTMLElement>('[data-powershow-id="cp4f8-root-match"]')?.classList.contains("powershow-editor-selected")).toBe(true);
  });

  it("recomputes the current match set after a separate definition transaction", async () => {
    const initial = presentation([{
      id: "slide-1",
      title: "Slide 1",
      elements: [
        container("cp4f8-old-match"),
        container("cp4f8-new-match", { layout: { children: { gap: 12 }, margin: 11 } }),
      ],
    }]);
    const initialSnapshot = structuredClone(initial);
    const saved: Presentation[] = [];

    await mount(initial, saved);
    const row = await openLinkedStyleRow();
    const gap = row.querySelector<HTMLInputElement>("[data-linked-style-property='gap'] input[type='number']");
    if (!gap) throw new Error("Linked Style gap input was not rendered");
    await act(async () => {
      gap.focus();
      setInputValue(gap, "12");
      gap.blur();
    });
    const afterDefinition = await save(saved);
    expect(afterDefinition.linkedStyles).toEqual(initialSnapshot.linkedStyles?.map((style) => style.id === TARGET_STYLE_ID ? { ...style, layout: { children: { gap: 12 } } } : style));
    expect(elementFrom(afterDefinition, "cp4f8-old-match")).toEqual(elementFrom(initialSnapshot, "cp4f8-old-match"));
    expect(elementFrom(afterDefinition, "cp4f8-new-match")).toEqual(elementFrom(initialSnapshot, "cp4f8-new-match"));

    const currentRow = host.querySelector<HTMLElement>(`[data-linked-style-id="${TARGET_STYLE_ID}"]`);
    if (!currentRow) throw new Error("Target Linked Style row was not rendered after definition edit");
    const currentAttach = attachButton(currentRow);
    expect(currentAttach.textContent).toContain("1");
    await act(async () => currentAttach.click());
    const afterBulk = await save(saved);
    expect(elementFrom(afterBulk, "cp4f8-old-match")).toEqual(elementFrom(initialSnapshot, "cp4f8-old-match"));
    expect(elementFrom(afterBulk, "cp4f8-new-match")).toMatchObject({ linkedStyleId: TARGET_STYLE_ID, layout: { margin: 11 } });

    await undo();
    expect(await save(saved)).toEqual(afterDefinition);
    await undo();
    expect(await save(saved)).toEqual(initialSnapshot);
    await redo();
    expect(await save(saved)).toEqual(afterDefinition);
    await redo();
    expect(await save(saved)).toEqual(afterBulk);
  });
});
