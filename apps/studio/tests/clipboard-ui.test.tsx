// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { PresentationSchema, type Presentation } from "@web-slideshow/document-schema";
import { createBlankPresentation } from "../src/features/persistence/presentation-repository-instance";
import { EditorWorkspace } from "../src/features/editor/editor-workspace";
import { StudioI18nProvider } from "../src/features/i18n/studio-i18n-context";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

function presentation(): Presentation {
  return PresentationSchema.parse({
    schemaVersion: 1,
    id: "clipboard-keyboard",
    title: "Clipboard keyboard",
    slides: [{
      id: "slide-1",
      title: "First",
      elements: [{
        type: "image",
        id: "image-1",
        hidden: false,
        src: "/image.png",
        alt: "Example",
        layout: { position: "absolute", left: 40, top: 40, width: 200, height: 120 },
      }],
    }],
  });
}

function rootBackedPresentation(): Presentation {
  return PresentationSchema.parse({
    ...presentation(),
    id: "clipboard-root-backed",
    slides: [{
      ...presentation().slides[0],
      rootDefinitionId: "root-1",
      elements: [],
    }],
    rootDefinitions: [{
      id: "root-1",
      name: "Teaching master",
      root: {
        type: "container",
        id: "root-container",
        hidden: false,
        children: [{
          type: "text",
          id: "root-text",
          hidden: false,
          variant: "body",
          content: "Master content",
        }],
      },
    }],
  });
}

describe("Editor Clipboard panel foundation", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    document.body.innerHTML = "";
  });

  it("keeps all four views in one tab strip and arrows only scroll it", () => {
    act(() => {
      root.render(
        <StudioI18nProvider>
          <EditorWorkspace initialPresentation={createBlankPresentation("clipboard-ui")} />
        </StudioI18nProvider>,
      );
    });

    const tabs = ["Inspector", "Elements", "Clipboard", "History"].map((label) => {
      const tab = Array.from(container.querySelectorAll<HTMLButtonElement>("button"))
        .find((button) => button.textContent?.trim() === label);
      if (!tab) throw new Error("expected the " + label + " tab");
      return tab;
    });
    expect(tabs).toHaveLength(4);

    for (const tab of tabs) {
      act(() => tab.click());
      expect(tab.getAttribute("aria-pressed")).toBe("true");
    }
    expect(container.textContent).toContain("History is not populated yet.");

    const leftArrow = container.querySelector<HTMLButtonElement>(
      'button[aria-label="Scroll editor tabs left"]',
    );
    const rightArrow = container.querySelector<HTMLButtonElement>(
      'button[aria-label="Scroll editor tabs right"]',
    );
    if (!leftArrow || !rightArrow) throw new Error("expected both tab scroll controls");
    expect(container.querySelectorAll('button[aria-label^="Scroll editor tabs"]').length).toBe(2);

    act(() => leftArrow.click());
    act(() => rightArrow.click());
    expect(tabs[3]?.getAttribute("aria-pressed")).toBe("true");
    expect(container.textContent).not.toContain("Primary editor views");
    expect(container.textContent).not.toContain("Clipboard and history views");
  });

  it("wires Copy and Paste while preserving native and modified shortcuts", async () => {
    act(() => {
      root.render(
        <StudioI18nProvider>
          <EditorWorkspace initialPresentation={presentation()} />
        </StudioI18nProvider>,
      );
    });

    await act(async () => {
      window.dispatchEvent(new KeyboardEvent("keydown", {
        key: "v",
        ctrlKey: true,
        bubbles: true,
        cancelable: true,
      }));
    });
    expect(container.querySelectorAll("[class*='slideCanvas'] [data-presentation-id]").length).toBe(1);

    const image = container.querySelector<HTMLElement>('[data-presentation-id="image-1"]');
    if (!image) throw new Error("expected the source image");
    await act(async () => image.dispatchEvent(new Event("pointerdown", { bubbles: true })));

    await act(async () => {
      window.dispatchEvent(new KeyboardEvent("keydown", {
        key: "C",
        ctrlKey: true,
        shiftKey: true,
        bubbles: true,
        cancelable: true,
      }));
    });
    expect(container.querySelectorAll("[class*='clipboardEntry']").length).toBe(0);

    await act(async () => {
      window.dispatchEvent(new KeyboardEvent("keydown", {
        key: "c",
        ctrlKey: true,
        bubbles: true,
        cancelable: true,
      }));
    });
    const titleInput = container.querySelector<HTMLInputElement>("input");
    if (!titleInput) throw new Error("expected the slide title input");
    await act(async () => {
      titleInput.dispatchEvent(new KeyboardEvent("keydown", {
        key: "v",
        ctrlKey: true,
        bubbles: true,
        cancelable: true,
      }));
    });
    expect(container.querySelectorAll("[class*='slideCanvas'] [data-presentation-id]").length).toBe(1);

    const clipboardTab = Array.from(container.querySelectorAll<HTMLButtonElement>("button"))
      .find((button) => button.textContent?.trim() === "Clipboard");
    if (!clipboardTab) throw new Error("expected the Clipboard tab");
    act(() => clipboardTab.click());
    expect(container.querySelector("[class*='clipboardEntry']")).not.toBeNull();
    expect(container.querySelector("[class*='clipboardEntrySelected']")).not.toBeNull();
    expect(container.querySelector('[class*="clipboardPreview"] [data-presentation-id="image-1"]')).not.toBeNull();

    const pin = container.querySelector<HTMLButtonElement>('button[aria-label^="Pin "]');
    expect(pin).not.toBeNull();
    act(() => pin!.click());
    expect(container.textContent).toContain("Pinned");
    expect(container.querySelector("[class*='clipboardEntrySelected']")).not.toBeNull();
    const unpin = container.querySelector<HTMLButtonElement>('button[aria-label^="Unpin "]');
    expect(unpin).not.toBeNull();
    act(() => unpin!.click());

    await act(async () => {
      window.dispatchEvent(new KeyboardEvent("keydown", {
        key: "v",
        ctrlKey: true,
        shiftKey: true,
        bubbles: true,
        cancelable: true,
      }));
    });
    expect(container.querySelectorAll("[class*='slideCanvas'] [data-presentation-id]").length).toBe(1);

    await act(async () => {
      window.dispatchEvent(new KeyboardEvent("keydown", {
        key: "v",
        ctrlKey: true,
        bubbles: true,
        cancelable: true,
      }));
    });
    expect(container.querySelectorAll("[class*='slideCanvas'] [data-presentation-id]").length).toBe(2);
    expect(container.querySelectorAll(".studio-editor-selected")).toHaveLength(1);

    await act(async () => {
      window.dispatchEvent(new KeyboardEvent("keydown", {
        key: "v",
        ctrlKey: true,
        bubbles: true,
        cancelable: true,
      }));
    });
    expect(container.querySelectorAll("[class*='slideCanvas'] [data-presentation-id]").length).toBe(3);
  });

  it("keeps a Cut source until Paste, then consumes it atomically", async () => {
    act(() => {
      root.render(
        <StudioI18nProvider>
          <EditorWorkspace initialPresentation={presentation()} />
        </StudioI18nProvider>,
      );
    });

    const image = container.querySelector<HTMLElement>('[data-presentation-id="image-1"]');
    expect(image).not.toBeNull();
    await act(async () => image!.dispatchEvent(new Event("pointerdown", { bubbles: true })));

    await act(async () => {
      window.dispatchEvent(new KeyboardEvent("keydown", {
        key: "x",
        ctrlKey: true,
        bubbles: true,
        cancelable: true,
      }));
    });
    expect(container.querySelector('[data-presentation-id="image-1"]')).not.toBeNull();
    expect(container.querySelector('[data-presentation-id="image-1"]')?.classList.contains("studio-editor-pending-cut")).toBe(true);

    const clipboardTab = Array.from(container.querySelectorAll<HTMLButtonElement>("button"))
      .find((button) => button.textContent?.trim() === "Clipboard");
    expect(clipboardTab).toBeDefined();
    act(() => clipboardTab!.click());
    expect(container.textContent).toContain("Pending Cut");

    await act(async () => {
      window.dispatchEvent(new KeyboardEvent("keydown", {
        key: "v",
        ctrlKey: true,
        bubbles: true,
        cancelable: true,
      }));
    });
    const moved = container.querySelectorAll("[class*='slideCanvas'] [data-presentation-id]");
    expect(moved).toHaveLength(1);
    expect(moved[0]?.getAttribute("data-presentation-id")).not.toBe("image-1");
    expect(container.querySelector(".studio-editor-pending-cut")).toBeNull();
    expect(container.textContent).not.toContain("Pending Cut");
  });

  it("keeps card actions separate from selection and Paste", async () => {
    act(() => {
      root.render(
        <StudioI18nProvider>
          <EditorWorkspace initialPresentation={presentation()} />
        </StudioI18nProvider>,
      );
    });
    const image = container.querySelector<HTMLElement>('[data-presentation-id="image-1"]')!;
    await act(async () => image.dispatchEvent(new Event("pointerdown", { bubbles: true })));
    await act(async () => window.dispatchEvent(new KeyboardEvent("keydown", { key: "c", ctrlKey: true, bubbles: true, cancelable: true })));
    const clipboardTab = Array.from(container.querySelectorAll<HTMLButtonElement>("button"))
      .find((button) => button.textContent?.trim() === "Clipboard");
    act(() => clipboardTab!.click());

    const remove = container.querySelector<HTMLButtonElement>('button[aria-label^="Remove "]');
    expect(remove).not.toBeNull();
    await act(async () => remove!.click());
    expect(container.querySelector("[class*='clipboardEntry']")).toBeNull();
    expect(container.querySelectorAll("[class*='slideCanvas'] [data-presentation-id]")).toHaveLength(1);
  });

  it("gates Clipboard double-click Paste for Root-backed Slides without disabling card actions", async () => {
    act(() => {
      root.render(
        <StudioI18nProvider>
          <EditorWorkspace initialPresentation={rootBackedPresentation()} />
        </StudioI18nProvider>,
      );
    });

    const masterText = container.querySelector<HTMLElement>('[data-presentation-id="root-text"]');
    expect(masterText).not.toBeNull();
    await act(async () => masterText!.dispatchEvent(new Event("pointerdown", { bubbles: true })));
    await act(async () => window.dispatchEvent(new KeyboardEvent("keydown", { key: "c", ctrlKey: true, bubbles: true, cancelable: true })));

    const clipboardTab = Array.from(container.querySelectorAll<HTMLButtonElement>("button"))
      .find((button) => button.textContent?.trim() === "Clipboard");
    expect(clipboardTab).toBeDefined();
    act(() => clipboardTab!.click());

    const entry = container.querySelector<HTMLElement>("[class*='clipboardEntry']");
    expect(entry).not.toBeNull();
    const beforePaste = container.querySelectorAll("[class*='slideCanvas'] [data-presentation-id]").length;
    await act(async () => entry!.dispatchEvent(new MouseEvent("dblclick", { bubbles: true })));
    expect(container.querySelectorAll("[class*='slideCanvas'] [data-presentation-id]")).toHaveLength(beforePaste);

    await act(async () => entry!.dispatchEvent(new MouseEvent("click", { bubbles: true })));
    expect(container.querySelector("[class*='clipboardEntrySelected']")).not.toBeNull();
    const remove = entry!.querySelector<HTMLButtonElement>('button[aria-label^="Remove "]');
    expect(remove).not.toBeNull();
    await act(async () => remove!.click());
    expect(container.querySelector("[class*='clipboardEntry']")).toBeNull();
  });

  it("keeps Clipboard double-click Paste enabled for ordinary Slides", async () => {
    act(() => {
      root.render(
        <StudioI18nProvider>
          <EditorWorkspace initialPresentation={presentation()} />
        </StudioI18nProvider>,
      );
    });

    const image = container.querySelector<HTMLElement>('[data-presentation-id="image-1"]');
    expect(image).not.toBeNull();
    await act(async () => image!.dispatchEvent(new Event("pointerdown", { bubbles: true })));
    await act(async () => window.dispatchEvent(new KeyboardEvent("keydown", { key: "c", ctrlKey: true, bubbles: true, cancelable: true })));

    const clipboardTab = Array.from(container.querySelectorAll<HTMLButtonElement>("button"))
      .find((button) => button.textContent?.trim() === "Clipboard");
    expect(clipboardTab).toBeDefined();
    act(() => clipboardTab!.click());
    const entry = container.querySelector<HTMLElement>("[class*='clipboardEntry']");
    expect(entry).not.toBeNull();
    await act(async () => entry!.dispatchEvent(new MouseEvent("dblclick", { bubbles: true })));
    expect(container.querySelectorAll("[class*='slideCanvas'] [data-presentation-id]")).toHaveLength(2);
  });
});
