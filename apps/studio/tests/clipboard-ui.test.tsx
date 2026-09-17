// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { createBlankPresentation } from "../src/features/persistence/presentation-repository-instance";
import { EditorWorkspace } from "../src/features/editor/editor-workspace";
import { StudioI18nProvider } from "../src/features/i18n/studio-i18n-context";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

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
});
