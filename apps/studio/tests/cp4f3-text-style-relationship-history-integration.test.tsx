// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  PresentationSchema,
  type ContainerElement,
  type PresentationElement,
  type Presentation,
  type TextElement,
} from "@web-slideshow/document-schema";

import { EditorWorkspace } from "../src/features/editor/editor-workspace";
import { StudioI18nProvider } from "../src/features/i18n/studio-i18n-context";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

const TEXT_A_ID = "cp4f3-text-a";
const TEXT_B_ID = "cp4f3-text-b";
const NESTED_TEXT_ID = "cp4f3-nested-text";
const ROOT_CONTAINER_ID = "cp4f3-root-container";
const QUOTE_STYLE_ID = "quote";

const QUOTE_STYLE = {
  id: QUOTE_STYLE_ID,
  name: "Quote",
  role: "body",
  style: { color: "#663399" },
  typography: { fontFamily: "Fira Code", fontStyle: "italic", fontWeight: 500 },
} as const;

function text(id: string, overrides: Partial<TextElement> = {}): TextElement {
  return {
    id,
    type: "text",
    hidden: false,
    variant: "body",
    content: id,
    ...overrides,
  };
}

function container(id: string, children: PresentationElement[]): ContainerElement {
  return { id, type: "container", hidden: false, children };
}

function presentation(elements: PresentationElement[], includeBodyOverride = true): Presentation {
  return PresentationSchema.parse({
    schemaVersion: 1,
    id: "cp4f3-text-style-relationship-history",
    title: "CP4F3 Text Style relationship history",
    slides: [{ id: "slide-1", title: "Slide 1", elements }],
    ...(includeBodyOverride ? { textStyles: [{ id: "body", typography: { fontFamily: "Inter", fontWeight: 700 } }, QUOTE_STYLE] } : { textStyles: [QUOTE_STYLE] }),
  });
}

function key(options: KeyboardEventInit = {}): KeyboardEvent {
  return new KeyboardEvent("keydown", { key: "z", bubbles: true, cancelable: true, ...options });
}

function changeSelect(select: HTMLSelectElement, value: string): void {
  const setter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value")?.set;
  if (!setter) throw new Error("expected HTMLSelectElement.value setter");
  setter.call(select, value);
  select.dispatchEvent(new Event("change", { bubbles: true }));
}

function changeInput(input: HTMLInputElement, value: string): void {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
  if (!setter) throw new Error("expected HTMLInputElement.value setter");
  setter.call(input, value);
  input.dispatchEvent(new Event("input", { bubbles: true }));
}

function findText(elements: readonly PresentationElement[], id: string): TextElement | undefined {
  for (const element of elements) {
    if (element.type === "text" && element.id === id) return element;
    if (element.type === "container") {
      const nested = findText(element.children, id);
      if (nested) return nested;
    }
  }
  return undefined;
}

function findCurrentText(snapshot: Presentation, id: string): TextElement {
  const slide = snapshot.slides[0];
  if (!slide) throw new Error("Slide was not found");
  const result = findText(slide.elements, id);
  if (!result) throw new Error(`Text was not found: ${id}`);
  return result;
}

describe("CP4F3 Text Style relationship history", () => {
  let host: HTMLDivElement;
  let root: Root;
  let saved: Presentation[];

  beforeEach(() => {
    host = document.createElement("div");
    document.body.appendChild(host);
    root = createRoot(host);
    saved = [];
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    document.body.innerHTML = "";
  });

  async function mount(initial: Presentation): Promise<void> {
    await act(async () => root.render(
      <StudioI18nProvider>
        <EditorWorkspace initialPresentation={initial} onSave={async (snapshot) => { saved.push(structuredClone(snapshot)); }} />
      </StudioI18nProvider>,
    ));
  }

  async function save(): Promise<Presentation> {
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

  async function selectText(id: string): Promise<void> {
    const target = host.querySelector<HTMLElement>(`[data-presentation-id="${id}"]`);
    if (!target) throw new Error(`Rendered Text was not found: ${id}`);
    await act(async () => target.dispatchEvent(new Event("pointerdown", { bubbles: true })));
  }

  function inspectorStyleSelect(): HTMLSelectElement {
    const select = host.querySelector<HTMLSelectElement>("#text-variant");
    if (!select) throw new Error("Text Style select was not rendered");
    return select;
  }

  async function openTextStyleUsage(styleId: string): Promise<HTMLElement> {
    const resourcesButton = Array.from(host.querySelectorAll<HTMLButtonElement>("button"))
      .find((button) => button.textContent?.trim() === "Custom Resources");
    if (!resourcesButton) throw new Error("Custom Resources button was not rendered");
    await act(async () => resourcesButton.click());

    const textStyles = Array.from(host.querySelectorAll<HTMLElement>("details"))
      .find((detail) => detail.querySelector("summary")?.textContent?.includes("Text Styles"));
    if (!textStyles) throw new Error("Text Styles section was not rendered");
    await act(async () => textStyles.querySelector("summary")?.dispatchEvent(new MouseEvent("click", { bubbles: true })));

    const row = host.querySelector<HTMLElement>(`[data-text-style-id="${styleId}"]`);
    if (!row) throw new Error(`Text Style resource was not rendered: ${styleId}`);
    const disclosure = row.querySelector<HTMLButtonElement>("button");
    if (!disclosure) throw new Error(`Text Style disclosure was not rendered: ${styleId}`);
    await act(async () => disclosure.click());
    return row;
  }

  async function closeResources(): Promise<void> {
    const resourcesButton = Array.from(host.querySelectorAll<HTMLButtonElement>("button"))
      .find((button) => button.textContent?.trim() === "Custom Resources");
    if (!resourcesButton) throw new Error("Custom Resources button was not rendered");
    await act(async () => resourcesButton.click());
  }

  function detachButtonFor(row: HTMLElement, elementId: string): HTMLButtonElement {
    const button = Array.from(row.querySelectorAll<HTMLButtonElement>("[data-resource-action='detach']"))
      .find((candidate) => candidate.parentElement?.textContent?.includes(elementId));
    if (!button) throw new Error(`Detach button was not rendered for ${elementId}`);
    return button;
  }

  async function requestDetach(row: HTMLElement, elementId: string): Promise<void> {
    await act(async () => detachButtonFor(row, elementId).click());
    expect(host.querySelector("[data-studio-danger-confirm-dialog]")).not.toBeNull();
  }

  async function confirmDetach(): Promise<void> {
    const dialog = host.querySelector<HTMLElement>("[data-studio-danger-confirm-dialog]");
    if (!dialog) throw new Error("Detach confirmation was not rendered");
    const confirm = Array.from(dialog.querySelectorAll<HTMLButtonElement>("button"))
      .find((button) => button.textContent?.trim() === "Detach");
    if (!confirm) throw new Error("Detach confirmation button was not rendered");
    await act(async () => confirm.click());
  }

  async function cancelDetach(): Promise<void> {
    const dialog = host.querySelector<HTMLElement>("[data-studio-danger-confirm-dialog]");
    if (!dialog) throw new Error("Detach confirmation was not rendered");
    const cancel = Array.from(dialog.querySelectorAll<HTMLButtonElement>("button"))
      .find((button) => button.textContent?.trim() === "Cancel");
    if (!cancel) throw new Error("Detach cancel button was not rendered");
    await act(async () => cancel.click());
  }

  it("tracks style switches as separate actions and replays exact representations", async () => {
    const initial = presentation([text(TEXT_A_ID, {
      content: "Keep content",
      variant: "body",
      typography: { fontSize: 22, fontWeight: 600, textDecorationColor: "#ff0000" },
      style: { color: "#000000", className: "keep-local-style" },
      layout: { position: "absolute", left: 11 },
      effect: { opacity: 0.7 },
    })]);
    await mount(initial);
    await selectText(TEXT_A_ID);
    const original = initial;

    await act(async () => changeSelect(inspectorStyleSelect(), QUOTE_STYLE_ID));
    const switchedToQuote = await save();
    expect(findCurrentText(switchedToQuote, TEXT_A_ID)).toMatchObject({ variant: QUOTE_STYLE_ID, style: { className: "keep-local-style" } });
    expect(findCurrentText(switchedToQuote, TEXT_A_ID)).toHaveProperty("typography.fontSize", 22);
    expect(findCurrentText(switchedToQuote, TEXT_A_ID)).toMatchObject({ content: "Keep content", layout: { position: "absolute", left: 11 }, effect: { opacity: 0.7 } });

    await act(async () => changeSelect(inspectorStyleSelect(), "title"));
    const switchedToTitle = await save();
    expect(findCurrentText(switchedToTitle, TEXT_A_ID).variant).toBe("title");

    await undo();
    expect(await save()).toEqual(switchedToQuote);
    await undo();
    expect(await save()).toEqual(original);
    await redo();
    expect(await save()).toEqual(switchedToQuote);
    await redo();
    expect(await save()).toEqual(switchedToTitle);
  });

  it("proves the master-local-master sequence with sibling isolation", async () => {
    const initial = PresentationSchema.parse({
      schemaVersion: 1,
      id: "cp4f3-sequence",
      title: "CP4F3 sequence",
      textStyles: [{ id: "body", typography: { fontSize: 20 } }],
      slides: [{
        id: "slide-1",
        title: "Slide 1",
        elements: [
          text("sequence-a"),
          text("sequence-b"),
        ],
      }],
    });
    await mount(initial);
    await selectText("sequence-a");
    expect(host.querySelector<HTMLInputElement>("#text-font-size")?.value).toBe("1.25");
    expect(host.querySelector("#text-font-size")?.parentElement?.parentElement?.textContent).toContain("Linked");

    const localInput = host.querySelector<HTMLInputElement>("#text-font-size");
    if (!localInput) throw new Error("Text font size control was not rendered");
    await act(async () => {
      changeInput(localInput, "30");
      localInput.blur();
    });
    let local = await save();
    expect(findCurrentText(local, "sequence-a")).toHaveProperty("typography.fontSize", "30rem");
    expect(findCurrentText(local, "sequence-b")).not.toHaveProperty("typography.fontSize");
    expect(local.textStyles).toEqual([{ id: "body", typography: { fontSize: 20 } }]);
    expect(host.querySelector("#text-font-size")?.parentElement?.parentElement?.textContent).toContain("Local override");

    const body = await openTextStyleUsage("body");
    const masterInput = body.querySelector<HTMLInputElement>("#text-style-body-font-size");
    if (!masterInput) throw new Error("Text Style font size control was not rendered");
    await act(async () => {
      changeInput(masterInput, "24");
      masterInput.blur();
    });
    const master = await save();
    expect(master.textStyles).toEqual([{ id: "body", typography: { fontSize: 24 } }]);
    expect(findCurrentText(master, "sequence-a")).not.toHaveProperty("typography.fontSize");
    expect(findCurrentText(master, "sequence-b")).not.toHaveProperty("typography.fontSize");
    await closeResources();
    expect(host.querySelector<HTMLInputElement>("#text-font-size")?.value).toBe("1.5");
    expect(host.querySelector("#text-font-size")?.parentElement?.parentElement?.textContent).toContain("Linked");

    const secondLocalInput = host.querySelector<HTMLInputElement>("#text-font-size");
    if (!secondLocalInput) throw new Error("Text font size control was not rendered after master edit");
    await act(async () => {
      changeInput(secondLocalInput, "32");
      secondLocalInput.blur();
    });
    expect((await save()).slides[0]!.elements[0]).toHaveProperty("typography.fontSize", "32rem");
    expect(host.querySelector("#text-font-size")?.parentElement?.parentElement?.textContent).toContain("Local override");

    const removeRow = await openTextStyleUsage("body");
    const remove = removeRow.querySelector<HTMLButtonElement>("[aria-label='Remove Font size']");
    if (!remove) throw new Error("Text Style font size remove button was not rendered");
    await act(async () => remove.click());
    const removed = await save();
    expect(removed.textStyles ?? []).toEqual([]);
    expect(findCurrentText(removed, "sequence-a")).not.toHaveProperty("typography.fontSize");
    expect(findCurrentText(removed, "sequence-b")).not.toHaveProperty("typography.fontSize");
    await closeResources();
    const finalField = host.querySelector<HTMLInputElement>("#text-font-size")?.parentElement?.parentElement;
    expect(finalField?.textContent).not.toContain("Local override");
    expect(finalField?.textContent).not.toContain("Linked");
  });

  it("covers the CP7 Text ownership lifecycle with exact snapshots", async () => {
    const initial = PresentationSchema.parse({
      schemaVersion: 1,
      id: "cp7-text-lifecycle",
      title: "CP7 Text lifecycle",
      textStyles: [{ id: "body", typography: { fontSize: 20 } }],
      slides: [{
        id: "slide-1",
        title: "Slide 1",
        elements: [
          text("cp7-text-a", { styleDetached: true, typography: { fontSize: 30, textAlign: "right" }, content: "Keep A" }),
          container("cp7-text-root", [text("cp7-text-b", { typography: { fontSize: 40, textAlign: "left" }, content: "Keep B" })]),
        ],
      }],
    });
    await mount(initial);
    await selectText("cp7-text-a");

    await act(async () => changeSelect(inspectorStyleSelect(), "body"));
    const attached = await save();
    expect(findCurrentText(attached, "cp7-text-a")).toMatchObject({ variant: "body", typography: { textAlign: "right" }, content: "Keep A" });
    expect(findCurrentText(attached, "cp7-text-a")).not.toHaveProperty("typography.fontSize");
    expect(findCurrentText(attached, "cp7-text-b")).toHaveProperty("typography.fontSize", 40);
    await undo();
    expect(await save()).toEqual(initial);
    await redo();
    expect(await save()).toEqual(attached);

    await act(async () => {
      const input = host.querySelector<HTMLInputElement>("#text-font-size");
      if (!input) throw new Error("Text font size input was not rendered");
      changeInput(input, "30");
      input.blur();
    });
    const local = await save();
    expect(findCurrentText(local, "cp7-text-a")).toHaveProperty("typography.fontSize", "30rem");
    expect(findCurrentText(local, "cp7-text-b")).toHaveProperty("typography.fontSize", 40);

    const body = await openTextStyleUsage("body");
    const masterInput = body.querySelector<HTMLInputElement>("#text-style-body-font-size");
    if (!masterInput) throw new Error("Text Style master font size input was not rendered");
    await act(async () => { changeInput(masterInput, "24"); masterInput.blur(); });
    const edited = await save();
    expect(edited.textStyles).toEqual([{ id: "body", typography: { fontSize: 24 } }]);
    expect(findCurrentText(edited, "cp7-text-a")).not.toHaveProperty("typography.fontSize");
    expect(findCurrentText(edited, "cp7-text-b")).not.toHaveProperty("typography.fontSize");
    expect(findCurrentText(edited, "cp7-text-a")).toHaveProperty("typography.textAlign", "right");
    await undo();
    expect(await save()).toEqual(local);
    await redo();
    expect(await save()).toEqual(edited);

    await closeResources();
    await act(async () => {
      const input = host.querySelector<HTMLInputElement>("#text-font-size");
      if (!input) throw new Error("Text font size input was not rendered after edit");
      changeInput(input, "32");
      input.blur();
    });
    const localAgain = await save();
    expect(findCurrentText(localAgain, "cp7-text-a")).toHaveProperty("typography.fontSize", "32rem");

    const editedBody = await openTextStyleUsage("body");
    const remove = editedBody.querySelector<HTMLButtonElement>("[aria-label='Remove Font size']");
    if (!remove) throw new Error("Text Style font size remove action was not rendered");
    await act(async () => remove.click());
    const removed = await save();
    expect(removed.textStyles ?? []).toEqual([]);
    expect(findCurrentText(removed, "cp7-text-a")).not.toHaveProperty("typography.fontSize");
    expect(findCurrentText(removed, "cp7-text-b")).not.toHaveProperty("typography.fontSize");
    await undo();
    expect(await save()).toEqual(localAgain);
    await redo();
    expect(await save()).toEqual(removed);

    await closeResources();
    await act(async () => {
      const input = host.querySelector<HTMLInputElement>("#text-font-size");
      if (!input) throw new Error("Text font size input was not rendered after remove");
      changeInput(input, "28");
      input.blur();
    });
    const localAfterRemove = await save();
    expect(findCurrentText(localAfterRemove, "cp7-text-a")).toHaveProperty("typography.fontSize", "28rem");

    const addBody = await openTextStyleUsage("body");
    await act(async () => {
      const add = Array.from(addBody.querySelectorAll<HTMLButtonElement>("button"))
        .find((button) => button.textContent?.trim() === "+ Add property");
      if (!add) throw new Error("Text Style Add property action was not rendered");
      add.click();
    });
    const fontSize = Array.from(addBody.querySelectorAll<HTMLButtonElement>("button"))
      .find((button) => button.textContent?.trim() === "Font size");
    if (!fontSize) throw new Error("Text Style Font size Add property option was not rendered");
    await act(async () => fontSize.click());
    const added = await save();
    expect(added.textStyles?.find((style) => style.id === "body")).toHaveProperty("typography.fontSize");
    expect(findCurrentText(added, "cp7-text-a")).not.toHaveProperty("typography.fontSize");
    expect(findCurrentText(added, "cp7-text-b")).not.toHaveProperty("typography.fontSize");
    await undo();
    expect(await save()).toEqual(localAfterRemove);
    await redo();
    expect(await save()).toEqual(added);

    await closeResources();
    const detach = Array.from(host.querySelectorAll<HTMLButtonElement>("button"))
      .find((button) => button.textContent?.trim() === "Detach from Body");
    if (!detach) throw new Error("Text Style detach action was not rendered");
    await act(async () => detach.click());
    const detached = await save();
    expect(findCurrentText(detached, "cp7-text-a")).toMatchObject({ variant: "body", styleDetached: true, typography: { textAlign: "right" }, content: "Keep A" });
    expect(findCurrentText(detached, "cp7-text-b")).toHaveProperty("variant", "body");
    expect(detached.textStyles).toEqual(added.textStyles);
    await undo();
    expect(await save()).toEqual(added);
    await redo();
    expect(await save()).toEqual(detached);
  });

  it("tracks custom detach, preserves element-local properties, and keeps the resource immutable", async () => {
    const initial = presentation([text(TEXT_A_ID, {
      variant: QUOTE_STYLE_ID,
      content: "Quote content",
      typography: { fontSize: 24 },
      style: { background: { color: "#eeeeee" }, className: "local" },
      layout: { position: "absolute", left: 22 },
      effect: { opacity: 0.8 },
    })]);
    await mount(initial);
    await selectText(TEXT_A_ID);
    const detach = Array.from(host.querySelectorAll<HTMLButtonElement>("button"))
      .find((button) => button.textContent?.trim() === "Detach from Quote");
    if (!detach) throw new Error("Inspector Detach button was not rendered");
    await act(async () => detach.click());
    const detached = await save();
    expect(findCurrentText(detached, TEXT_A_ID)).toMatchObject({ variant: "body", styleDetached: true, typography: { fontFamily: "Fira Code", fontStyle: "italic", fontWeight: 500, fontSize: 24 }, style: { color: "#663399", background: { color: "#eeeeee" }, className: "local" }, layout: { position: "absolute", left: 22 }, effect: { opacity: 0.8 } });
    expect(detached.textStyles).toEqual(initial.textStyles);

    await undo();
    expect(await save()).toEqual(initial);
    await redo();
    expect(await save()).toEqual(detached);
  });

  it("does not materialize omitted source-master properties in one switch action", async () => {
    const initial = presentation([text(TEXT_A_ID, { variant: QUOTE_STYLE_ID })]);
    await mount(initial);
    await selectText(TEXT_A_ID);

    await act(async () => changeSelect(inspectorStyleSelect(), "body"));
    const switched = await save();
    expect(findCurrentText(switched, TEXT_A_ID)).toMatchObject({
      variant: "body",
    });
    expect(findCurrentText(switched, TEXT_A_ID)).not.toHaveProperty("typography.fontStyle");
    expect(findCurrentText(switched, TEXT_A_ID)).not.toHaveProperty("typography.fontFamily");
    expect(findCurrentText(switched, TEXT_A_ID)).not.toHaveProperty("style.color");

    await undo();
    expect(await save()).toEqual(initial);
    await redo();
    expect(await save()).toEqual(switched);
  });

  it("tracks fundamental detach without a persisted fundamental override", async () => {
    const initial = presentation([text(TEXT_A_ID, { variant: "body" })], false);
    await mount(initial);
    await selectText(TEXT_A_ID);
    const detach = Array.from(host.querySelectorAll<HTMLButtonElement>("button"))
      .find((button) => button.textContent?.trim() === "Detach from Body");
    if (!detach) throw new Error("Fundamental Inspector Detach button was not rendered");
    await act(async () => detach.click());
    const detached = await save();
    expect(findCurrentText(detached, TEXT_A_ID)).toMatchObject({ variant: "body", styleDetached: true, typography: { fontSize: 18, fontWeight: 400 } });
    expect(detached.textStyles).toEqual(initial.textStyles);
    await undo();
    expect(await save()).toEqual(initial);
  });

  it("tracks explicit Attach and separates it from a preceding continuous typography edit", async () => {
    const initial = presentation([text(TEXT_A_ID, { styleDetached: true, typography: { fontSize: 22, textDecorationColor: "#f00" } })]);
    await mount(initial);
    await selectText(TEXT_A_ID);
    const fontSize = host.querySelector<HTMLInputElement>("#text-font-size");
    if (!fontSize) throw new Error("Text font size control was not rendered");
    await act(async () => changeInput(fontSize, "1.5"));
    await act(async () => fontSize.dispatchEvent(new Event("change", { bubbles: true })));
    const afterTypography = await save();
    const attach = Array.from(host.querySelectorAll<HTMLButtonElement>("button"))
      .find((button) => button.textContent?.trim() === "Attach to Body");
    if (!attach) throw new Error("Inspector Attach button was not rendered");
    await act(async () => attach.click());
    const attached = await save();
    expect(findCurrentText(attached, TEXT_A_ID)).toMatchObject({ variant: "body" });
    expect(findCurrentText(attached, TEXT_A_ID)).not.toHaveProperty("styleDetached");
    expect(findCurrentText(attached, TEXT_A_ID)).toHaveProperty("typography.fontSize", 1.5);

    await undo();
    expect(await save()).toEqual(afterTypography);
    await undo();
    expect(await save()).toEqual(initial);
  });

  it("keeps Resources request and cancel transient and does not consume Undo", async () => {
    const initial = presentation([text(TEXT_A_ID, { variant: QUOTE_STYLE_ID })]);
    await mount(initial);
    const row = await openTextStyleUsage(QUOTE_STYLE_ID);
    await requestDetach(row, TEXT_A_ID);
    expect(saved).toHaveLength(0);
    await cancelDetach();
    expect(saved).toHaveLength(0);
    const undoEvent = await undo();
    expect(undoEvent.defaultPrevented).toBe(false);
    expect(row.querySelectorAll("[data-resource-action='detach']")).toHaveLength(1);
  });

  it("detaches one nested custom usage, updates count, and replays exact snapshots", async () => {
    const initial = presentation([container(ROOT_CONTAINER_ID, [
      text(TEXT_A_ID, { variant: QUOTE_STYLE_ID }),
      container("cp4f3-nested-container", [text(NESTED_TEXT_ID, { variant: QUOTE_STYLE_ID })]),
      text(TEXT_B_ID, { variant: QUOTE_STYLE_ID }),
    ])]);
    await mount(initial);
    const row = await openTextStyleUsage(QUOTE_STYLE_ID);
    expect(row.querySelectorAll("[data-resource-action='detach']")).toHaveLength(3);
    await requestDetach(row, NESTED_TEXT_ID);
    await confirmDetach();
    const detached = await save();
    expect(findCurrentText(detached, NESTED_TEXT_ID)).toMatchObject({ variant: "body", styleDetached: true });
    expect(findCurrentText(detached, TEXT_A_ID)).toEqual(findCurrentText(initial, TEXT_A_ID));
    expect(findCurrentText(detached, TEXT_B_ID)).toEqual(findCurrentText(initial, TEXT_B_ID));
    expect(detached.textStyles).toEqual(initial.textStyles);
    expect(row.querySelectorAll("[data-resource-action='detach']")).toHaveLength(2);

    await closeResources();
    await undo();
    expect(await save()).toEqual(initial);
    await redo();
    expect(await save()).toEqual(detached);
  });

  it("detaches a virtual fundamental resource usage without a persisted body entry", async () => {
    const initial = presentation([text(TEXT_A_ID, { variant: "body" })], false);
    await mount(initial);
    const row = await openTextStyleUsage("body");
    expect(row.querySelectorAll("[data-resource-action='detach']")).toHaveLength(1);
    await requestDetach(row, TEXT_A_ID);
    await confirmDetach();
    const detached = await save();
    expect(findCurrentText(detached, TEXT_A_ID)).toMatchObject({ variant: "body", styleDetached: true });
    expect(detached.textStyles).toEqual(initial.textStyles);
    await closeResources();
    await undo();
    expect(await save()).toEqual(initial);
  });

  it("keeps Inspector and Resources relationship actions independent", async () => {
    const initial = presentation([text(TEXT_A_ID, { variant: "body" })], false);
    await mount(initial);
    await selectText(TEXT_A_ID);
    await act(async () => changeSelect(inspectorStyleSelect(), QUOTE_STYLE_ID));
    const attached = await save();
    expect(findCurrentText(attached, TEXT_A_ID).variant).toBe(QUOTE_STYLE_ID);

    const row = await openTextStyleUsage(QUOTE_STYLE_ID);
    await requestDetach(row, TEXT_A_ID);
    await confirmDetach();
    const detached = await save();
    expect(findCurrentText(detached, TEXT_A_ID)).toMatchObject({ variant: "body", styleDetached: true });
    await closeResources();
    await undo();
    expect(await save()).toEqual(attached);
    await undo();
    expect(await save()).toEqual(initial);
  });

  it("guards stale Resources confirmations in the current Presentation", async () => {
    const initial = presentation([text(TEXT_A_ID, { variant: QUOTE_STYLE_ID })]);
    await mount(initial);
    const row = await openTextStyleUsage(QUOTE_STYLE_ID);
    await requestDetach(row, TEXT_A_ID);
    await cancelDetach();
    expect(saved).toHaveLength(0);
    expect(findCurrentText(initial, TEXT_A_ID).styleDetached).toBeUndefined();
    expect(row.textContent).toContain("Used by 1 element");
  });
});
