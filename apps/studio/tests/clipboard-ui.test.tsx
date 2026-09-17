// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { PresentationSchema, type Presentation } from "@powershow/document-schema";
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
    expect(container.querySelectorAll("[data-powershow-id]").length).toBe(1);

    const image = container.querySelector<HTMLElement>('[data-powershow-id="image-1"]');
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
    expect(container.querySelectorAll("[data-powershow-id]").length).toBe(1);

    const clipboardTab = Array.from(container.querySelectorAll<HTMLButtonElement>("button"))
      .find((button) => button.textContent?.trim() === "Clipboard");
    if (!clipboardTab) throw new Error("expected the Clipboard tab");
    act(() => clipboardTab.click());
    expect(container.querySelector("[class*='clipboardEntry']")).not.toBeNull();
    expect(container.querySelector("[class*='clipboardEntrySelected']")).not.toBeNull();

    await act(async () => {
      window.dispatchEvent(new KeyboardEvent("keydown", {
        key: "v",
        ctrlKey: true,
        shiftKey: true,
        bubbles: true,
        cancelable: true,
      }));
    });
    expect(container.querySelectorAll("[data-powershow-id]").length).toBe(1);

    await act(async () => {
      window.dispatchEvent(new KeyboardEvent("keydown", {
        key: "v",
        ctrlKey: true,
        bubbles: true,
        cancelable: true,
      }));
    });
    expect(container.querySelectorAll("[data-powershow-id]").length).toBe(2);
    expect(container.querySelectorAll(".powershow-editor-selected")).toHaveLength(1);

    await act(async () => {
      window.dispatchEvent(new KeyboardEvent("keydown", {
        key: "v",
        ctrlKey: true,
        bubbles: true,
        cancelable: true,
      }));
    });
    expect(container.querySelectorAll("[data-powershow-id]").length).toBe(3);
  });

  it("keeps a Cut source until Paste, then consumes it atomically", async () => {
    act(() => {
      root.render(
        <StudioI18nProvider>
          <EditorWorkspace initialPresentation={presentation()} />
        </StudioI18nProvider>,
      );
    });

    const image = container.querySelector<HTMLElement>('[data-powershow-id="image-1"]');
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
    expect(container.querySelector('[data-powershow-id="image-1"]')).not.toBeNull();

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
    const moved = container.querySelectorAll("[data-powershow-id]");
    expect(moved).toHaveLength(1);
    expect(moved[0]?.getAttribute("data-powershow-id")).not.toBe("image-1");
    expect(container.textContent).not.toContain("Pending Cut");
  });
});
