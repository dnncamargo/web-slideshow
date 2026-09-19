// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  PresentationSchema,
  type FontFaceResource,
  type Presentation,
} from "@web-slideshow/document-schema";

import type {
  CustomLibraryItemRecord,
  CustomLibraryRepository,
} from "../src/features/custom-library/custom-library-repository";
import { EditorWorkspace } from "../src/features/editor/editor-workspace";
import { StudioI18nProvider } from "../src/features/i18n/studio-i18n-context";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

const face: FontFaceResource = {
  weight: 400,
  style: "normal",
  subset: "latin",
  source: { type: "url", url: "https://example.com/f11.woff2", format: "woff2" },
};

const dependencyRichItem: CustomLibraryItemRecord = {
  id: "dependency-rich-item",
  item: {
    name: "Dependency-rich container",
    root: {
      type: "container",
      properties: [{ path: "linkedStyleId", value: "container-style" }],
      children: [{
        type: "text",
        properties: [
          { path: "content", value: "Applied with dependencies" },
          { path: "variant", value: "custom-style" },
          { path: "typography.fontFamily", value: "F11 Sans" },
        ],
      }],
    },
    dependencies: {
      fonts: [{ family: "F11 Sans", faces: [face] }],
      textStyles: [{
        id: "custom-style",
        name: "Custom style",
        role: "body",
        typography: { fontSize: "28px" },
      }],
      linkedStyles: [{
        id: "container-style",
        name: "Container style",
        layout: { padding: 12 },
      }],
    },
  },
};

const textItem: CustomLibraryItemRecord = {
  id: "text-item",
  item: {
    name: "Text preset",
    root: { type: "text", properties: [{ path: "content", value: "Applied text" }] },
  },
};

const imageItem: CustomLibraryItemRecord = {
  id: "image-item",
  item: { name: "Image preset", root: { type: "image", properties: [] } },
};

function initialPresentation(elements: Presentation["slides"][number]["elements"] = []): Presentation {
  return PresentationSchema.parse({
    schemaVersion: 1,
    id: "cp4f11-custom-library-history",
    title: "CP4F11 custom library history",
    slides: [{ id: "slide-1", title: "Slide 1", elements }],
    textStyles: [{ id: "custom-style", name: "Local style", role: "title" }],
    linkedStyles: [{ id: "container-style", name: "Local style", layout: { padding: 2 } }],
  });
}

function repository(items: CustomLibraryItemRecord[]): CustomLibraryRepository {
  return {
    saveItem: vi.fn(async () => "saved"),
    listItems: vi.fn(async () => items),
    getItem: vi.fn(async () => null),
    deleteItem: vi.fn(async () => undefined),
  };
}

function key(value: string, options: KeyboardEventInit = {}): KeyboardEvent {
  return new KeyboardEvent("keydown", { key: value, bubbles: true, cancelable: true, ...options });
}

describe("CP4F11 Custom Library apply history", () => {
  let host: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    vi.useFakeTimers();
    host = document.createElement("div");
    document.body.appendChild(host);
    root = createRoot(host);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    vi.useRealTimers();
    document.body.innerHTML = "";
  });

  async function mount(
    presentation: Presentation,
    items: CustomLibraryItemRecord[],
    saved: Presentation[],
  ): Promise<void> {
    await act(async () => {
      root.render(
        <StudioI18nProvider>
          <EditorWorkspace
            initialPresentation={presentation}
            customLibraryRepository={repository(items)}
            onSave={async (next) => { saved.push(structuredClone(next)); }}
          />
        </StudioI18nProvider>,
      );
    });
  }

  async function openElements(): Promise<void> {
    const button = Array.from(host.querySelectorAll<HTMLButtonElement>("button"))
      .find((candidate) => candidate.textContent?.trim() === "Elements");
    if (!button) throw new Error("Elements tab not found");
    await act(async () => button.click());
  }

  async function openPicker(): Promise<void> {
    const browse = host.querySelector<HTMLButtonElement>("[data-custom-library-browse]");
    if (browse) {
      await act(async () => browse.click());
    } else {
      const resources = Array.from(host.querySelectorAll<HTMLButtonElement>("button"))
        .find((candidate) => candidate.textContent?.trim().includes("Custom Resources"));
      if (!resources) throw new Error("Custom Resources toggle not found");
      await act(async () => resources.click());
    }
    const addSavedElement = Array.from(host.querySelectorAll<HTMLButtonElement>("button"))
      .find((candidate) => candidate.textContent?.trim() === "+ Add saved element");
    if (addSavedElement) {
      await act(async () => addSavedElement.click());
    }
    await act(async () => undefined);
  }

  async function applyItem(name: string): Promise<void> {
    const item = Array.from(host.querySelectorAll<HTMLButtonElement>("[class*='customLibraryApplyItem']"))
      .find((candidate) => candidate.textContent?.includes(name));
    if (!item) throw new Error(`Custom Library item not found: ${name}`);
    await act(async () => item.click());
    const apply = Array.from(host.querySelectorAll<HTMLButtonElement>("button"))
      .find((candidate) => candidate.textContent?.trim() === "Apply to selected");
    if (!apply) throw new Error("Apply button not found");
    await act(async () => apply.click());
  }

  async function saveSnapshot(saved: Presentation[]): Promise<Presentation> {
    await act(async () => {
      vi.advanceTimersByTime(1600);
      await Promise.resolve();
    });
    const snapshot = saved.at(-1);
    if (!snapshot) throw new Error("Expected autosave snapshot");
    return snapshot;
  }

  async function selectTreeElement(label: string): Promise<void> {
    const element = Array.from(host.querySelectorAll<HTMLButtonElement>("[class*='elementTreeSelect']"))
      .find((candidate) => candidate.textContent?.includes(label));
    if (!element) throw new Error(`Element tree entry not found: ${label}`);
    await act(async () => element.click());
  }

  it("applies through the real picker as one exact dependency-rich Undo/Redo action", async () => {
    const before = initialPresentation();
    const beforeItem = structuredClone(dependencyRichItem);
    const saved: Presentation[] = [];
    await mount(before, [dependencyRichItem], saved);

    await openElements();
    await openPicker();
    await applyItem("Dependency-rich container");

    const after = await saveSnapshot(saved);
    expect(after).not.toEqual(before);
    expect(after.textStyles).toEqual([
      { id: "custom-style", name: "Local style", role: "title" },
      { id: "custom-style-2", name: "Custom style", role: "body", typography: { fontSize: "28px" } },
    ]);
    expect(after.linkedStyles).toEqual([
      { id: "container-style", name: "Local style", layout: { padding: 2 } },
      { id: "container-style-2", name: "Container style", layout: { padding: 12 } },
    ]);
    expect(after.resources?.fonts).toEqual([{ id: "f11-sans", family: "F11 Sans", faces: [face] }]);
    const applied = after.slides[0]?.elements[0];
    expect(applied?.type).toBe("container");
    expect(applied?.type === "container" && applied.linkedStyleId).toBe("container-style-2");
    expect(applied?.type === "container" && applied.children[0]).toMatchObject({
      type: "text",
      content: "Applied with dependencies",
      variant: "custom-style-2",
      typography: { fontFamily: "F11 Sans" },
    });
    expect(dependencyRichItem).toEqual(beforeItem);
    expect(host.textContent).toContain(`Container · ${applied?.id}`);

    const undo = key("z", { ctrlKey: true });
    await act(async () => window.dispatchEvent(undo));
    expect(undo.defaultPrevented).toBe(true);
    expect(await saveSnapshot(saved)).toEqual(before);

    const redo = key("z", { ctrlKey: true, shiftKey: true });
    await act(async () => window.dispatchEvent(redo));
    expect(redo.defaultPrevented).toBe(true);
    expect(await saveSnapshot(saved)).toEqual(after);
  });

  it("keeps same-type merge and different-type sibling placement inside one History boundary", async () => {
    const beforeMerge = initialPresentation([{
      type: "text",
      id: "target-text",
      hidden: false,
      variant: "body",
      content: "Before",
    }]);
    const savedMerge: Presentation[] = [];
    await mount(beforeMerge, [textItem], savedMerge);
    await openElements();
    await selectTreeElement("Text — Before");
    await openPicker();
    await applyItem("Text preset");

    const afterMerge = await saveSnapshot(savedMerge);
    expect(afterMerge.slides[0]?.elements).toHaveLength(1);
    expect(afterMerge.slides[0]?.elements[0]).toMatchObject({ id: "target-text", content: "Applied text" });
    const undoMerge = key("z", { ctrlKey: true });
    await act(async () => window.dispatchEvent(undoMerge));
    expect(await saveSnapshot(savedMerge)).toEqual(beforeMerge);
    const redoMerge = key("z", { ctrlKey: true, shiftKey: true });
    await act(async () => window.dispatchEvent(redoMerge));
    expect(await saveSnapshot(savedMerge)).toEqual(afterMerge);

    await act(async () => root.unmount());
    host.innerHTML = "";
    root = createRoot(host);

    const beforeSibling = initialPresentation([{
      type: "text",
      id: "source-text",
      hidden: false,
      variant: "body",
      content: "Source",
    }]);
    const savedSibling: Presentation[] = [];
    await mount(beforeSibling, [imageItem], savedSibling);
    await openElements();
    await selectTreeElement("Text — Source");
    await openPicker();
    await applyItem("Image preset");

    const afterSibling = await saveSnapshot(savedSibling);
    const siblingElements = afterSibling.slides[0]?.elements ?? [];
    expect(siblingElements).toHaveLength(2);
    expect(siblingElements[0]?.id).toBe("source-text");
    expect(siblingElements[1]?.type).toBe("image");
    expect(host.textContent).toContain(`Image · ${siblingElements[1]?.id}`);
    const undoSibling = key("z", { ctrlKey: true });
    await act(async () => window.dispatchEvent(undoSibling));
    expect(await saveSnapshot(savedSibling)).toEqual(beforeSibling);
    const redoSibling = key("z", { ctrlKey: true, shiftKey: true });
    await act(async () => window.dispatchEvent(redoSibling));
    expect(await saveSnapshot(savedSibling)).toEqual(afterSibling);
  });

  it("does not create History for a failed picker Apply", async () => {
    const conflictingFace: FontFaceResource = {
      ...face,
      source: { type: "url", url: "https://example.com/conflict.woff2", format: "woff2" },
    };
    const before = PresentationSchema.parse({
      ...initialPresentation(),
      resources: { fonts: [{ id: "local-f11", family: "F11 Sans", faces: [conflictingFace] }] },
    });
    const saved: Presentation[] = [];
    await mount(before, [dependencyRichItem], saved);
    await openElements();
    await openPicker();
    await applyItem("Dependency-rich container");

    expect(host.textContent).toContain("Could not apply Custom Library item.");
    expect(await Promise.resolve(saved.at(-1))).toBeUndefined();
    const undo = key("z", { ctrlKey: true });
    await act(async () => window.dispatchEvent(undo));
    expect(undo.defaultPrevented).toBe(false);
    expect(saved).toHaveLength(0);
  });
});
