// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { PresentationSchema, type Presentation, type PresentationElement } from "@web-slideshow/document-schema";

import { EditorWorkspace } from "../src/features/editor/editor-workspace";
import { StudioI18nProvider } from "../src/features/i18n/studio-i18n-context";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

const text = (id: string, content = id): PresentationElement => ({
  id,
  type: "text",
  hidden: false,
  variant: "body",
  content,
});

const container = (
  id: string,
  children: PresentationElement[] = [],
): Extract<PresentationElement, { type: "container" }> => ({
  id,
  type: "container",
  hidden: false,
  children,
});

function presentation(): Presentation {
  return PresentationSchema.parse({
    schemaVersion: 1,
    id: "root-local-clipboard-ui",
    title: "Root local Clipboard UI",
    slides: [{
      id: "slide-1",
      title: "Slide 1",
      summary: "",
      speakerNotes: "",
      elements: [],
      rootDefinitionId: "root-1",
      localRootChildren: [{
        targetContainerId: "receiver-a",
        children: [container("local-container", [text("local-child")])],
      }],
    }],
    rootDefinitions: [{
      id: "root-1",
      name: "Root 1",
      localChildTargetIds: ["receiver-a", "receiver-b"],
      root: container("root", [
        text("master-source"),
        container("receiver-a"),
        container("receiver-b"),
      ]),
    }],
  });
}

function findElement(host: HTMLDivElement, id: string): HTMLElement {
  const element = host.querySelector<HTMLElement>(`[data-presentation-id="${id}"]`);
  if (!element) throw new Error(`Expected element ${id}`);
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

function save(host: HTMLDivElement): HTMLButtonElement {
  const button = Array.from(host.querySelectorAll<HTMLButtonElement>("button"))
    .find((candidate) => candidate.textContent?.trim() === "Save");
  if (!button) throw new Error("Expected Save button");
  return button;
}

function select(host: HTMLDivElement, id: string): void {
  act(() => findElement(host, id).dispatchEvent(new Event("pointerdown", { bubbles: true })));
}

describe("Root-backed Slide local Clipboard authoring", () => {
  let host: HTMLDivElement;
  let root: Root;
  let saved: Presentation[];

  beforeEach(() => {
    host = document.createElement("div");
    document.body.appendChild(host);
    root = createRoot(host);
    saved = [];
    act(() => {
      root.render(
        <StudioI18nProvider>
          <EditorWorkspace
            initialPresentation={presentation()}
            onSave={async (value) => { saved.push(structuredClone(value)); }}
          />
        </StudioI18nProvider>,
      );
    });
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    document.body.innerHTML = "";
  });

  it("copies local content into a selected authorized master receiver without mutating the Root", async () => {
    const initial = presentation();
    select(host, "local-child");
    await pressKey("c", { ctrlKey: true });
    select(host, "receiver-b");
    await pressKey("v", { ctrlKey: true });
    await act(async () => save(host).click());

    const result = saved.at(-1);
    expect(result).toBeDefined();
    expect(result?.slides[0]?.elements).toEqual([]);
    expect(result?.slides[0]?.localRootChildren?.map((record) => record.targetContainerId)).toEqual([
      "receiver-a",
      "receiver-b",
    ]);
    expect(result?.slides[0]?.localRootChildren?.[1]?.children.map((element) => element.id)).toEqual([
      "local-child-copy",
    ]);
    expect(result?.rootDefinitions).toEqual(initial.rootDefinitions);
  });

  it("cuts local content across receiver records atomically and replays exact Undo/Redo", async () => {
    select(host, "local-child");
    await pressKey("x", { ctrlKey: true });
    await act(async () => {
      Array.from(host.querySelectorAll<HTMLButtonElement>("button"))
        .find((button) => button.textContent?.trim() === "Clipboard")?.click();
    });
    expect(host.textContent).toContain("Pending Cut");
    select(host, "receiver-b");
    await pressKey("v", { ctrlKey: true });
    await act(async () => save(host).click());
    const moved = saved.at(-1);
    expect(moved?.slides[0]?.localRootChildren?.map((record) => record.targetContainerId)).toEqual([
      "receiver-a",
      "receiver-b",
    ]);
    expect(moved?.slides[0]?.localRootChildren?.[0]?.children[0]?.type).toBe("container");
    expect(moved?.slides[0]?.localRootChildren?.[0]?.children[0]?.type === "container"
      ? moved.slides[0]?.localRootChildren?.[0]?.children[0]?.children
      : undefined).toEqual([]);
    expect(moved?.slides[0]?.localRootChildren?.[1]?.children[0]?.id).toBe("local-child-copy");

    await pressKey("z", { ctrlKey: true });
    await act(async () => save(host).click());
    expect(saved.at(-1)?.slides[0]?.localRootChildren).toEqual(presentation().slides[0]?.localRootChildren);

    await pressKey("z", { ctrlKey: true, shiftKey: true });
    await act(async () => save(host).click());
    expect(saved.at(-1)?.slides[0]?.localRootChildren?.[1]?.children[0]?.id).toBe("local-child-copy");
  });

  it("pastes into a selected local Container and enables Clipboard-panel Paste only for valid local destinations", async () => {
    select(host, "local-child");
    await pressKey("c", { ctrlKey: true });
    select(host, "local-container");
    await act(async () => {
      Array.from(host.querySelectorAll<HTMLButtonElement>("button"))
        .find((button) => button.textContent?.trim() === "Clipboard")?.click();
    });
    const card = host.querySelector<HTMLElement>("[class*='clipboardEntry']");
    expect(card).not.toBeNull();
    await act(async () => card?.dispatchEvent(new MouseEvent("dblclick", { bubbles: true })));
    await act(async () => save(host).click());

    const result = saved.at(-1);
    const localContainer = result?.slides[0]?.localRootChildren?.[0]?.children[0];
    expect(localContainer?.type).toBe("container");
    if (localContainer?.type !== "container") throw new Error("Expected local Container");
    expect(localContainer.children.map((element) => element.id)).toEqual(["local-child", "local-child-copy"]);
  });

  it("keeps projected master Cut and non-Container Paste fail-closed", async () => {
    const initial = presentation();
    select(host, "master-source");
    await pressKey("x", { ctrlKey: true });
    await act(async () => {
      Array.from(host.querySelectorAll<HTMLButtonElement>("button"))
        .find((button) => button.textContent?.trim() === "Clipboard")?.click();
    });
    expect(host.textContent).not.toContain("Pending Cut");

    await pressKey("c", { ctrlKey: true });
    const card = host.querySelector<HTMLElement>("[class*='clipboardEntry']");
    expect(card).not.toBeNull();
    await act(async () => card?.dispatchEvent(new MouseEvent("dblclick", { bubbles: true })));
    await pressKey("v", { ctrlKey: true });
    await act(async () => save(host).click());

    expect(saved).toHaveLength(0);
    expect(host.querySelector('[data-presentation-id="local-child"]')).not.toBeNull();
    expect(host.querySelector('[data-presentation-id="receiver-b"]')).not.toBeNull();
    expect(initial.slides[0]?.elements).toEqual([]);
  });
});
