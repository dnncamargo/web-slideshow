// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { PresentationSchema, type Presentation } from "@powershow/document-schema";

import { EditorWorkspace } from "../src/features/editor/editor-workspace";
import { StudioI18nProvider } from "../src/features/i18n/studio-i18n-context";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

function presentation(): Presentation {
  return PresentationSchema.parse({
    schemaVersion: 1,
    id: "deletion-workspace",
    title: "Deletion workspace",
    slides: [{
      id: "slide-1",
      title: "First",
      elements: [{
        type: "image",
        id: "image-1",
        hidden: false,
        src: "/image.png",
        alt: "Example",
      }],
    }],
  });
}

describe("EditorWorkspace element deletion", () => {
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

  it("focuses Delete before the native confirm action", async () => {
    await act(async () => {
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
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "Delete", bubbles: true, cancelable: true }));
    });

    const dialog = container.querySelector<HTMLDivElement>('[role="dialog"]');
    expect(dialog).not.toBeNull();
    const confirm = Array.from(dialog!.querySelectorAll<HTMLButtonElement>("button"))
      .find((button) => button.textContent?.trim() === "Delete");
    expect(confirm).toBeDefined();
    expect(document.activeElement).toBe(confirm);

    await act(async () => confirm!.click());
    expect(container.querySelector('[data-powershow-id="image-1"]')).toBeNull();
    expect(container.querySelector('[role="dialog"]')).toBeNull();
  });

  it("cancels deletion with Escape", async () => {
    await act(async () => {
      root.render(
        <StudioI18nProvider>
          <EditorWorkspace initialPresentation={presentation()} />
        </StudioI18nProvider>,
      );
    });
    const image = container.querySelector<HTMLElement>('[data-powershow-id="image-1"]')!;
    await act(async () => image.dispatchEvent(new Event("pointerdown", { bubbles: true })));
    await act(async () => window.dispatchEvent(new KeyboardEvent("keydown", { key: "Delete", bubbles: true })));
    await act(async () => container.querySelector<HTMLDivElement>('[role="dialog"]')!
      .dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true })));

    expect(container.querySelector('[data-powershow-id="image-1"]')).not.toBeNull();
    expect(container.querySelector('[role="dialog"]')).toBeNull();
  });
});
