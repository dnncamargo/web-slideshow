// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { PresentationSchema, type Presentation, type PresentationElement } from "@web-slideshow/document-schema";
import { EditorWorkspace } from "../src/features/editor/editor-workspace";
import { StudioI18nProvider } from "../src/features/i18n/studio-i18n-context";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

function divider(id: string): Extract<PresentationElement, { type: "text" }> {
  return { id, type: "text", hidden: false, variant: "body", content: id };
}

function container(id: string, children: PresentationElement[] = []): Extract<PresentationElement, { type: "container" }> {
  return { id, type: "container", hidden: false, children };
}

function rootPresentation(): Presentation {
  return PresentationSchema.parse({
    schemaVersion: 1,
    id: "sm6d7a-root-clipboard",
    title: "Root Clipboard",
    rootDefinitions: [{
      id: "root-definition",
      name: "Root Definition",
      root: container("root-container", [
        divider("root-source"),
        container("root-receiver", [divider("root-receiver-text")]),
      ]),
    }],
    slides: [{
      id: "slide-1",
      title: "Retained Slide",
      summary: "",
      speakerNotes: "",
      elements: [divider("slide-element")],
    }],
  });
}

function renderIds(container: HTMLDivElement): string[] {
  return Array.from(
    container.querySelectorAll<HTMLElement>("[data-presentation-id]"),
  ).map((element) => element.getAttribute("data-presentation-id") ?? "");
}

function findPresentationElement(container: HTMLDivElement, id: string): HTMLElement {
  const element = container.querySelector<HTMLElement>(
    `[data-presentation-id="${id}"]`,
  );
  if (!element) throw new Error(`expected element ${id}`);
  return element;
}

async function pressKey(key: string, modifiers: Partial<KeyboardEventInit> = {}): Promise<void> {
  await act(async () => {
    window.dispatchEvent(new KeyboardEvent("keydown", {
      key,
      bubbles: true,
      cancelable: true,
      ...modifiers,
    }));
  });
}

describe("SM6D7A Root clipboard authoring", () => {
  let host: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    host = document.createElement("div");
    document.body.appendChild(host);
    root = createRoot(host);
    act(() => {
      root.render(
        <StudioI18nProvider>
          <EditorWorkspace
            initialPresentation={rootPresentation()}
            initialAuthoringTarget={{ kind: "root-definition", rootDefinitionId: "root-definition" }}
          />
        </StudioI18nProvider>,
      );
    });
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    document.body.innerHTML = "";
  });

  it("pastes a Root snapshot inside the canonical Root Container", async () => {
    await act(async () => findPresentationElement(host, "root-source").dispatchEvent(new Event("pointerdown", { bubbles: true })));
    await pressKey("c", { ctrlKey: true });
    expect(host.querySelector("[class*='clipboardEntry']")).toBeNull();

    await pressKey("v", { ctrlKey: true });
    const ids = renderIds(host);
    expect(ids.filter((id) => id === "root-container")).toHaveLength(1);
    expect(ids).toContain("root-source");
    expect(ids).toContain("root-source-copy");
    expect(ids).not.toContain("root-definition-workspace:root-definition");

    await pressKey("z", { ctrlKey: true });
    expect(renderIds(host)).not.toContain("root-source-copy");
    expect(renderIds(host)).toContain("root-source");
    await pressKey("z", { ctrlKey: true, shiftKey: true });
    expect(renderIds(host)).toContain("root-source-copy");
  });

  it("does not cut the canonical Root Container", async () => {
    const before = renderIds(host);
    await act(async () => findPresentationElement(host, "root-container").dispatchEvent(new Event("pointerdown", { bubbles: true })));
    await pressKey("x", { ctrlKey: true });

    expect(renderIds(host)).toEqual(before);
    expect(host.textContent).not.toContain("Pending Cut");
  });

  it("moves a Root descendant within the same Root Definition with fresh ids", async () => {
    await act(async () => findPresentationElement(host, "root-source").dispatchEvent(new Event("pointerdown", { bubbles: true })));
    await pressKey("x", { ctrlKey: true });
    await act(async () => findPresentationElement(host, "root-receiver").dispatchEvent(new Event("pointerdown", { bubbles: true })));
    await pressKey("v", { ctrlKey: true });

    const ids = renderIds(host);
    expect(ids).not.toContain("root-source");
    expect(ids).toContain("root-source-copy");
    expect(ids.filter((id) => id === "root-container")).toHaveLength(1);

    await pressKey("z", { ctrlKey: true });
    expect(renderIds(host)).toContain("root-source");
    expect(renderIds(host)).not.toContain("root-source-copy");
    await pressKey("z", { ctrlKey: true, shiftKey: true });
    expect(renderIds(host)).not.toContain("root-source");
    expect(renderIds(host)).toContain("root-source-copy");
  });

  it("carries a Root snapshot to the retained Slide without moving the Root source", async () => {
    await act(async () => findPresentationElement(host, "root-source").dispatchEvent(new Event("pointerdown", { bubbles: true })));
    await pressKey("c", { ctrlKey: true });
    const exit = Array.from(host.querySelectorAll<HTMLButtonElement>("button"))
      .find((button) => button.textContent?.trim() === "Exit master editing");
    if (!exit) throw new Error("expected Root exit control");
    act(() => exit.click());
    await pressKey("v", { ctrlKey: true });

    const ids = renderIds(host);
    expect(ids).toContain("slide-element");
    expect(ids).toContain("root-source-copy");
    expect(ids).not.toContain("root-source");
  });
});
