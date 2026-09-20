// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { PresentationSchema, type Presentation } from "@web-slideshow/document-schema";

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

function emptyContainerPresentation(): Presentation {
  return PresentationSchema.parse({
    schemaVersion: 1,
    id: "empty-container-deletion-workspace",
    title: "Empty container deletion workspace",
    slides: [{
      id: "slide-1",
      title: "First",
      elements: [{ type: "container", id: "container-1", hidden: false, children: [] }],
    }],
  });
}

function nonEmptyContainerPresentation(): Presentation {
  const value = emptyContainerPresentation();
  return PresentationSchema.parse({
    ...value,
    id: "non-empty-container-deletion-workspace",
    slides: [{
      ...value.slides[0],
      elements: [{
        type: "container",
        id: "container-1",
        hidden: false,
        children: [{ type: "image", id: "child-1", hidden: false, src: "/image.png", alt: "Child" }],
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

    const image = container.querySelector<HTMLElement>('[data-presentation-id="image-1"]');
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
    expect(container.querySelector('[data-presentation-id="image-1"]')).toBeNull();
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
    const image = container.querySelector<HTMLElement>('[data-presentation-id="image-1"]')!;
    await act(async () => image.dispatchEvent(new Event("pointerdown", { bubbles: true })));
    await act(async () => window.dispatchEvent(new KeyboardEvent("keydown", { key: "Delete", bubbles: true })));
    await act(async () => container.querySelector<HTMLDivElement>('[role="dialog"]')!
      .dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true })));

    expect(container.querySelector('[data-presentation-id="image-1"]')).not.toBeNull();
    expect(container.querySelector('[role="dialog"]')).toBeNull();
  });

  it("keeps incompatible containers on the destructive-only confirmation", async () => {
    await act(async () => {
      root.render(
        <StudioI18nProvider>
          <EditorWorkspace initialPresentation={emptyContainerPresentation()} />
        </StudioI18nProvider>,
      );
    });
    const containerElement = container.querySelector<HTMLElement>('[data-presentation-id="container-1"]')!;
    await act(async () => containerElement.dispatchEvent(new Event("pointerdown", { bubbles: true })));
    await act(async () => window.dispatchEvent(new KeyboardEvent("keydown", { key: "Delete", bubbles: true })));

    const dialog = container.querySelector<HTMLDivElement>('[role="dialog"]')!;
    expect(dialog.textContent).toContain("Delete");
    expect(Array.from(dialog.querySelectorAll("button")).some((button) => button.textContent?.includes("keep children"))).toBe(false);
  });

  it("keeps destructive container deletion unchanged", async () => {
    await act(async () => {
      root.render(
        <StudioI18nProvider>
          <EditorWorkspace initialPresentation={nonEmptyContainerPresentation()} />
        </StudioI18nProvider>,
      );
    });
    await act(async () => container.querySelector<HTMLElement>('[data-presentation-id="container-1"]')!.dispatchEvent(new Event("pointerdown", { bubbles: true })));
    await act(async () => window.dispatchEvent(new KeyboardEvent("keydown", { key: "Delete", bubbles: true })));

    const deleteAll = Array.from(container.querySelectorAll<HTMLButtonElement>('[role="dialog"] button'))
      .find((button) => button.textContent?.trim() === "Delete container and children");
    expect(deleteAll).toBeDefined();
    expect(document.activeElement).toBe(deleteAll);
    await act(async () => deleteAll!.click());
    expect(container.querySelector('[data-presentation-id="container-1"]')).toBeNull();
    expect(container.querySelector('[data-presentation-id="child-1"]')).toBeNull();
    await act(async () => window.dispatchEvent(new KeyboardEvent("keydown", { key: "z", ctrlKey: true, bubbles: true })));
    expect(container.querySelector('[data-presentation-id="container-1"]')).not.toBeNull();
    expect(container.querySelector('[data-presentation-id="child-1"]')).not.toBeNull();
  });

  it("cancels the compatible container choices with Escape", async () => {
    await act(async () => {
      root.render(
        <StudioI18nProvider>
          <EditorWorkspace initialPresentation={nonEmptyContainerPresentation()} />
        </StudioI18nProvider>,
      );
    });
    await act(async () => container.querySelector<HTMLElement>('[data-presentation-id="container-1"]')!.dispatchEvent(new Event("pointerdown", { bubbles: true })));
    await act(async () => window.dispatchEvent(new KeyboardEvent("keydown", { key: "Delete", bubbles: true })));

    const dialog = container.querySelector<HTMLDivElement>('[role="dialog"]')!;
    expect(dialog.textContent).toContain('Choose whether to delete or keep its children.');
    expect(Array.from(dialog.querySelectorAll<HTMLButtonElement>("button"), (button) => button.textContent?.trim())).toEqual([
      "Cancel",
      "Delete container and children",
      "Delete container, keep children",
    ]);

    await act(async () => dialog.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true })));
    expect(container.querySelector('[role="dialog"]')).toBeNull();
    expect(container.querySelector('[data-presentation-id="container-1"]')).not.toBeNull();
    expect(container.querySelector('[data-presentation-id="child-1"]')).not.toBeNull();
  });
});
