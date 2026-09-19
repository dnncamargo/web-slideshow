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

const ROOT_ID = "cp4f2-root";
const TARGET_A_ID = "cp4f2-target-a";
const TARGET_B_ID = "cp4f2-target-b";
const LINKED_STYLE_ID = "cp4f2-shared-style";

const LINKED_STYLE = {
  id: LINKED_STYLE_ID,
  name: "Shared Container Style",
  layout: { children: { gap: 20 }, padding: 100 },
  style: { color: "#222222", borderRadius: 8 },
  typography: { fontSize: 22 },
  effect: { opacity: 0.8 },
} as const;

function text(id: string, content: string): PresentationElement {
  return { id, type: "text", hidden: false, variant: "body", content };
}

function container(id: string, overrides: Partial<ContainerElement> = {}): ContainerElement {
  return {
    id,
    type: "container",
    hidden: false,
    children: [text(`${id}-child`, "Keep this child")],
    ...overrides,
  };
}

function presentation(elements: PresentationElement[], linkedStyles: readonly object[] = [LINKED_STYLE]): Presentation {
  return PresentationSchema.parse({
    schemaVersion: 1,
    id: "cp4f2-linked-style-usage-detach",
    title: "CP4F2 linked style usage detach",
    slides: [{ id: "slide-1", title: "Slide 1", elements }],
    linkedStyles,
  });
}

function key(options: KeyboardEventInit): KeyboardEvent {
  return new KeyboardEvent("keydown", { key: "z", bubbles: true, cancelable: true, ...options });
}

function changeSelect(select: HTMLSelectElement, value: string): void {
  const setter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value")?.set;
  if (!setter) throw new Error("expected HTMLSelectElement.value setter");
  setter.call(select, value);
  select.dispatchEvent(new Event("change", { bubbles: true }));
}

function findContainer(document: Presentation, id: string): ContainerElement {
  const visit = (elements: readonly PresentationElement[]): ContainerElement | undefined => {
    for (const element of elements) {
      if (element.type === "container" && element.id === id) return element;
      if (element.type === "container") {
        const nested = visit(element.children);
        if (nested) return nested;
      }
    }
    return undefined;
  };
  const result = visit(document.slides[0]?.elements ?? []);
  if (!result) throw new Error(`Container was not found: ${id}`);
  return result;
}

describe("CP4F2 linked style usage detach history", () => {
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
        />
      </StudioI18nProvider>,
    ));
  }

  async function openResourcesAndLinkedStyle(): Promise<HTMLElement> {
    const resourcesButton = Array.from(host.querySelectorAll<HTMLButtonElement>("button"))
      .find((button) => button.textContent?.trim() === "Custom Resources");
    if (!resourcesButton) throw new Error("Custom Resources button was not rendered");
    await act(async () => resourcesButton.click());

    const linkedStyles = Array.from(host.querySelectorAll<HTMLElement>("details"))
      .find((detail) => detail.querySelector("summary")?.textContent?.includes("Linked Styles"));
    if (!linkedStyles) throw new Error("Linked Styles section was not rendered");
    await act(async () => linkedStyles.querySelector("summary")?.dispatchEvent(new MouseEvent("click", { bubbles: true })));

    const resource = host.querySelector<HTMLElement>(`[data-linked-style-id="${LINKED_STYLE_ID}"]`);
    if (!resource) throw new Error("Linked Style resource was not rendered");
    await act(async () => resource.querySelector<HTMLButtonElement>(":scope > button")?.click());
    const reuse = resource.querySelector<HTMLElement>("[data-linked-style-section='reuse']");
    if (!reuse) throw new Error("Linked Style reuse section was not rendered");
    return reuse;
  }

  async function closeResources(): Promise<void> {
    const resourcesButton = Array.from(host.querySelectorAll<HTMLButtonElement>("button"))
      .find((button) => button.textContent?.trim() === "Custom Resources");
    if (!resourcesButton) throw new Error("Custom Resources button was not rendered");
    await act(async () => resourcesButton.click());
  }

  function detachButtonFor(reuse: HTMLElement, elementId: string): HTMLButtonElement {
    const button = Array.from(reuse.querySelectorAll<HTMLButtonElement>("[data-resource-action='detach']"))
      .find((candidate) => candidate.parentElement?.textContent?.includes(elementId));
    if (!button) throw new Error(`Detach button was not rendered for ${elementId}`);
    return button;
  }

  async function requestDetach(reuse: HTMLElement, elementId: string): Promise<void> {
    await act(async () => detachButtonFor(reuse, elementId).click());
    expect(host.querySelector("[data-studio-danger-confirm-dialog]")).not.toBeNull();
  }

  async function confirmDetach(): Promise<void> {
    const dialog = host.querySelector<HTMLElement>("[data-studio-danger-confirm-dialog]");
    if (!dialog) throw new Error("Detach confirmation was not rendered");
    const confirm = Array.from(dialog.querySelectorAll<HTMLButtonElement>("button"))
      .find((button) => button.textContent?.trim() === "Detach");
    if (!confirm) throw new Error("Detach confirmation button was not rendered");
    await act(async () => confirm.click());
    expect(host.querySelector("[data-studio-danger-confirm-dialog]")).toBeNull();
  }

  async function cancelDetach(): Promise<void> {
    const dialog = host.querySelector<HTMLElement>("[data-studio-danger-confirm-dialog]");
    if (!dialog) throw new Error("Detach confirmation was not rendered");
    const cancel = Array.from(dialog.querySelectorAll<HTMLButtonElement>("button"))
      .find((button) => button.textContent?.trim() === "Cancel");
    if (!cancel) throw new Error("Detach cancel button was not rendered");
    await act(async () => cancel.click());
    expect(host.querySelector("[data-studio-danger-confirm-dialog]")).toBeNull();
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

  async function undo(): Promise<KeyboardEvent> {
    const event = key({ ctrlKey: true });
    await act(async () => window.dispatchEvent(event));
    return event;
  }

  async function redo(): Promise<KeyboardEvent> {
    const event = key({ ctrlKey: true, shiftKey: true });
    await act(async () => window.dispatchEvent(event));
    return event;
  }

  it("requests and cancels a Resources detach without changing Presentation or consuming Undo", async () => {
    const initial = presentation([container(TARGET_A_ID, { linkedStyleId: LINKED_STYLE_ID })]);
    const saved: Presentation[] = [];
    await mount(initial, saved);
    const reuse = await openResourcesAndLinkedStyle();

    await requestDetach(reuse, TARGET_A_ID);
    expect(saved).toHaveLength(0);
    await cancelDetach();
    expect(saved).toHaveLength(0);

    const undoEvent = await undo();
    expect(undoEvent.defaultPrevented).toBe(false);
    expect(reuse.querySelectorAll("[data-resource-action='detach']")).toHaveLength(1);
  });

  it("tracks one nested usage detach, preserves the other usage and resource, and replays exact snapshots", async () => {
    const initial = presentation([
      container(ROOT_ID, {
        role: "main",
        children: [
          container(TARGET_A_ID, {
            linkedStyleId: LINKED_STYLE_ID,
            layout: { width: "70%", children: { gap: 7 }, margin: 3 },
            style: { className: "local-class", background: { color: "#445566" } },
            typography: { fontWeight: 700 },
            effect: { shadow: { x: 1, y: 2, blur: 3, color: "#000000" } },
          }),
          container(TARGET_B_ID, { linkedStyleId: LINKED_STYLE_ID, layout: { width: "30%" } }),
        ],
      }),
    ]);
    const saved: Presentation[] = [];
    await mount(initial, saved);
    const reuse = await openResourcesAndLinkedStyle();
    expect(reuse.querySelectorAll("[data-resource-action='detach']")).toHaveLength(2);

    const resourceBefore = structuredClone(initial.linkedStyles);
    await requestDetach(reuse, TARGET_A_ID);
    expect(saved).toHaveLength(0);
    await confirmDetach();

    const detached = await save(saved);
    const detachedA = findContainer(detached, TARGET_A_ID);
    expect(detachedA).toMatchObject({
      layout: { width: "70%", children: { gap: 7, }, padding: 100, margin: 3 },
      style: { className: "local-class", background: { color: "#445566" }, color: "#222222", borderRadius: 8 },
      typography: { fontWeight: 700, fontSize: 22 },
      effect: { shadow: { x: 1, y: 2, blur: 3, color: "#000000" }, opacity: 0.8 },
    });
    expect(detachedA).not.toHaveProperty("linkedStyleId");
    expect(findContainer(detached, TARGET_A_ID).children).toEqual(findContainer(initial, TARGET_A_ID).children);
    expect(findContainer(detached, TARGET_B_ID)).toEqual(findContainer(initial, TARGET_B_ID));
    expect(detached.linkedStyles).toEqual(resourceBefore);
    expect(reuse.querySelectorAll("[data-resource-action='detach']")).toHaveLength(1);

    await closeResources();
    const undoEvent = await undo();
    expect(undoEvent.defaultPrevented).toBe(true);
    expect(await save(saved)).toEqual(initial);
    expect((await save(saved)).linkedStyles).toEqual(resourceBefore);

    const redoEvent = await redo();
    expect(redoEvent.defaultPrevented).toBe(true);
    expect(await save(saved)).toEqual(detached);
    expect((await save(saved)).linkedStyles).toEqual(resourceBefore);
  });

  it("keeps Inspector attach and Resources detach as separate history actions", async () => {
    const initial = presentation([container(TARGET_A_ID, { layout: { width: "80%" } })]);
    const saved: Presentation[] = [];
    await mount(initial, saved);

    const target = host.querySelector<HTMLElement>(`[data-presentation-id="${TARGET_A_ID}"]`);
    if (!target) throw new Error("Target container was not rendered");
    await act(async () => target.dispatchEvent(new Event("pointerdown", { bubbles: true })));
    await act(async () => changeSelect(host.querySelector<HTMLSelectElement>("#container-linked-style")!, LINKED_STYLE_ID));
    const attached = await save(saved);
    expect(findContainer(attached, TARGET_A_ID)).toMatchObject({ linkedStyleId: LINKED_STYLE_ID, layout: { width: "80%" } });

    const reuse = await openResourcesAndLinkedStyle();
    await requestDetach(reuse, TARGET_A_ID);
    await confirmDetach();
    const detached = await save(saved);
    expect(findContainer(detached, TARGET_A_ID)).not.toHaveProperty("linkedStyleId");

    await closeResources();
    const undoDetach = await undo();
    expect(undoDetach.defaultPrevented).toBe(true);
    expect(findContainer(await save(saved), TARGET_A_ID).linkedStyleId).toBe(LINKED_STYLE_ID);
    await undo();
    expect(await save(saved)).toEqual(initial);
    await redo();
    expect(await save(saved)).toEqual(attached);
    await redo();
    expect(await save(saved)).toEqual(detached);
  });
});
