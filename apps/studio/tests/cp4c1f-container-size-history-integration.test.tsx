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
    id: "cp4c1f-container-size-history",
    title: "CP4C1F container size history",
    linkedStyles: [{
      id: "linked-size",
      name: "Linked size",
      layout: { width: "70%", height: "60%" },
    }],
    slides: [{
      id: "slide-1",
      title: "Slide 1",
      elements: [
        {
          id: "size-local",
          type: "container",
          hidden: false,
          children: [],
          layout: { width: "70%", height: "60%" },
        },
        {
          id: "size-linked",
          type: "container",
          hidden: false,
          children: [],
          linkedStyleId: "linked-size",
        },
        {
          id: "size-normalization",
          type: "container",
          hidden: false,
          children: [],
          layout: { width: "70.0%", height: "60.0%" },
        },
        {
          id: "size-clear-local",
          type: "container",
          hidden: false,
          children: [],
          layout: { width: "70%", height: "60%" },
        },
        {
          id: "size-linked-clear",
          type: "container",
          hidden: false,
          children: [],
          linkedStyleId: "linked-size",
        },
        {
          id: "size-preset",
          type: "container",
          hidden: false,
          children: [],
          layout: { width: "56%", height: "48%" },
        },
      ],
    }],
  });
}

function key(value: string, options: KeyboardEventInit = {}): KeyboardEvent {
  return new KeyboardEvent("keydown", { key: value, bubbles: true, cancelable: true, ...options });
}

function changeInput(input: HTMLInputElement, value: string): void {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
  if (!setter) throw new Error("expected HTMLInputElement.value setter");
  setter.call(input, value);
  input.dispatchEvent(new Event("input", { bubbles: true }));
}

describe("CP4C1F continuous Container size history", () => {
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

  async function mount(
    initial = presentation(),
    onSave?: (snapshot: Presentation) => Promise<void>,
  ): Promise<Presentation> {
    await act(async () => root.render(<StudioI18nProvider><EditorWorkspace initialPresentation={initial} onSave={onSave} /></StudioI18nProvider>));
    return initial;
  }

  async function selectElement(id: string): Promise<void> {
    const element = host.querySelector<HTMLElement>(`[data-powershow-id="${id}"]`);
    if (!element) throw new Error(`element ${id} was not rendered`);
    await act(async () => element.dispatchEvent(new Event("pointerdown", { bubbles: true })));
  }

  function input(id: string): HTMLInputElement {
    const result = host.querySelector<HTMLInputElement>(`#${id}`);
    if (!result) throw new Error(`input ${id} was not rendered`);
    return result;
  }

  function labelText(id: string): string {
    return input(id).closest("label")?.textContent ?? "";
  }

  async function editNumber(id: string, values: string[]): Promise<void> {
    const control = input(id);
    await act(async () => {
      control.focus();
      for (const value of values) changeInput(control, value);
      control.blur();
    });
  }

  async function authorDisplayedNumber(id: string, value: string): Promise<void> {
    const control = input(id);
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
    if (!setter) throw new Error("expected HTMLInputElement.value setter");
    await act(async () => {
      control.focus();
      const tracker = (control as HTMLInputElement & {
        _valueTracker?: { setValue: (value: string) => void };
      })._valueTracker;
      tracker?.setValue("");
      setter.call(control, value);
      control.dispatchEvent(new Event("input", { bubbles: true }));
      control.dispatchEvent(new Event("change", { bubbles: true }));
      control.blur();
    });
  }

  async function save(): Promise<void> {
    const button = Array.from(host.querySelectorAll<HTMLButtonElement>("button"))
      .find((candidate) => candidate.textContent === "Save");
    if (!button) throw new Error("save button was not rendered");
    await act(async () => {
      button.click();
      await Promise.resolve();
    });
  }

  function savedContainerWidth(snapshot: Presentation, id: string): string | number | undefined {
    const element = snapshot.slides[0]?.elements.find((candidate) => candidate.id === id);
    if (element?.type !== "container") throw new Error(`container ${id} was not saved`);
    return element.layout?.width;
  }

  it("coalesces Width changes and keeps Height in a separate transaction", async () => {
    await mount();
    await selectElement("size-local");

    await editNumber("container-width", ["72", "74"]);
    await editNumber("container-height", ["62", "64"]);

    const undoHeight = key("z", { ctrlKey: true });
    await act(async () => window.dispatchEvent(undoHeight));
    expect(undoHeight.defaultPrevented).toBe(true);
    expect(input("container-width").value).toBe("74");
    expect(input("container-height").value).toBe("60");

    const undoWidth = key("z", { ctrlKey: true });
    await act(async () => window.dispatchEvent(undoWidth));
    expect(undoWidth.defaultPrevented).toBe(true);
    expect(input("container-width").value).toBe("70");

    const redoWidth = key("z", { ctrlKey: true, shiftKey: true });
    await act(async () => window.dispatchEvent(redoWidth));
    expect(redoWidth.defaultPrevented).toBe(true);
    expect(input("container-width").value).toBe("74");
  });

  it("records a same-visible linked Width override without changing the linked Style", async () => {
    const initial = await mount();
    await selectElement("size-linked");

    await editNumber("container-width", ["71", "70"]);
    expect(labelText("container-width")).toContain("Local override");
    expect(labelText("container-height")).toContain("Linked");
    expect(initial.linkedStyles?.[0]).toMatchObject({ layout: { width: "70%", height: "60%" } });

    const undo = key("z", { ctrlKey: true });
    await act(async () => window.dispatchEvent(undo));
    expect(undo.defaultPrevented).toBe(true);
    expect(labelText("container-width")).toContain("Linked");
    expect(labelText("container-height")).toContain("Linked");

    const redo = key("z", { ctrlKey: true, shiftKey: true });
    await act(async () => window.dispatchEvent(redo));
    expect(redo.defaultPrevented).toBe(true);
    expect(labelText("container-width")).toContain("Local override");
    expect(labelText("container-height")).toContain("Linked");
  });

  it("leaves native Undo alone for an ordinary local Width no-op", async () => {
    await mount();
    await selectElement("size-local");

    await authorDisplayedNumber("container-width", "70");
    expect(input("container-width").value).toBe("70");

    const undo = key("z", { ctrlKey: true });
    await act(async () => window.dispatchEvent(undo));
    expect(undo.defaultPrevented).toBe(false);
    expect(input("container-width").value).toBe("70");
  });

  it("records canonical Width normalization even when the displayed value is unchanged", async () => {
    const saved: Presentation[] = [];
    await mount(presentation(), async (snapshot) => {
      saved.push(structuredClone(snapshot));
    });
    await selectElement("size-normalization");

    await authorDisplayedNumber("container-width", "70");
    await save();
    expect(savedContainerWidth(saved.at(-1)!, "size-normalization")).toBe("70%");

    const undo = key("z", { ctrlKey: true });
    await act(async () => window.dispatchEvent(undo));
    expect(undo.defaultPrevented).toBe(true);
    await save();
    expect(savedContainerWidth(saved.at(-1)!, "size-normalization")).toBe("70.0%");

    const redo = key("z", { ctrlKey: true, shiftKey: true });
    await act(async () => window.dispatchEvent(redo));
    expect(redo.defaultPrevented).toBe(true);
    await save();
    expect(savedContainerWidth(saved.at(-1)!, "size-normalization")).toBe("70%");
  });

  it("does not create a local override when clearing inherited size", async () => {
    await mount();
    await selectElement("size-linked-clear");

    await editNumber("container-width", [""]);
    expect(input("container-width").value).toBe("70");
    expect(labelText("container-width")).toContain("Linked");

    const undo = key("z", { ctrlKey: true });
    await act(async () => window.dispatchEvent(undo));
    expect(undo.defaultPrevented).toBe(false);
  });

  it("clears a real local size value and replays it through Undo/Redo", async () => {
    await mount();
    await selectElement("size-clear-local");

    await editNumber("container-width", [""]);
    expect(input("container-width").value).toBe("");

    const undo = key("z", { ctrlKey: true });
    await act(async () => window.dispatchEvent(undo));
    expect(undo.defaultPrevented).toBe(true);
    expect(input("container-width").value).toBe("70");

    const redo = key("z", { ctrlKey: true, shiftKey: true });
    await act(async () => window.dispatchEvent(redo));
    expect(redo.defaultPrevented).toBe(true);
    expect(input("container-width").value).toBe("");
  });

  it("preserves the size preset as one discrete Width and Height action", async () => {
    await mount();
    await selectElement("size-preset");

    await act(async () => {
      const preset = host.querySelector<HTMLSelectElement>("#container-size-preset");
      if (!preset) throw new Error("preset control was not rendered");
      preset.value = "medium";
      preset.dispatchEvent(new Event("change", { bubbles: true }));
    });
    expect(input("container-width").value).toBe("70");
    expect(input("container-height").value).toBe("60");

    const undo = key("z", { ctrlKey: true });
    await act(async () => window.dispatchEvent(undo));
    expect(undo.defaultPrevented).toBe(true);
    expect(input("container-width").value).toBe("56");
    expect(input("container-height").value).toBe("48");
  });
});
