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

  it("keeps primary views and switches into Clipboard and History", () => {
    act(() => {
      root.render(
        <StudioI18nProvider>
          <EditorWorkspace initialPresentation={createBlankPresentation("clipboard-ui")} />
        </StudioI18nProvider>,
      );
    });

    expect(container.textContent).toContain("Inspector");
    expect(container.textContent).toContain("Elements");
    expect(container.textContent).not.toContain("Clipboard");

    const sessionSwitch = container.querySelector<HTMLButtonElement>(
      'button[aria-label="Clipboard and history views"]',
    );
    if (!sessionSwitch) throw new Error("expected the session view switch");
    act(() => sessionSwitch.click());

    expect(container.textContent).toContain("Clipboard");
    expect(container.textContent).toContain("History");
    expect(container.textContent).toContain("No snapshots in this Clipboard session.");
    expect(container.textContent).not.toContain("Inspector");

    const history = Array.from(container.querySelectorAll<HTMLButtonElement>("button"))
      .find((button) => button.textContent?.trim() === "History");
    if (!history) throw new Error("expected the History tab");
    act(() => history.click());
    expect(container.textContent).toContain("History is not populated yet.");

    const primarySwitch = container.querySelector<HTMLButtonElement>(
      'button[aria-label="Primary editor views"]',
    );
    if (!primarySwitch) throw new Error("expected the primary view switch");
    act(() => primarySwitch.click());
    expect(container.textContent).toContain("Inspector");
    expect(container.textContent).not.toContain("Clipboard");
  });
});
