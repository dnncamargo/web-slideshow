// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { PresentationSchema, type Presentation } from "@web-slideshow/document-schema";

import { EditorWorkspace } from "../src/features/editor/editor-workspace";
import { StudioI18nProvider } from "../src/features/i18n/studio-i18n-context";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

const repositories = { listPalettes: async () => [], listFonts: async () => [] } as never;

function initialPresentation(): Presentation {
  return PresentationSchema.parse({
    schemaVersion: 1,
    id: "lsx4b2a-target-resources",
    title: "Target Resources",
    linkedStyles: [
      { target: "code", id: "code-style", name: "Code style", style: { color: "#222222" } },
      { target: "terminal", id: "terminal-style", name: "Terminal style", style: { outputColor: "#333333" } },
      { target: "table", mode: "simple", id: "simple-style", name: "Simple style", style: { color: "#444444" } },
      { target: "table", mode: "structured", id: "structured-style", name: "Structured style", style: { headerBackground: "#555555" } },
      { target: "divider", id: "divider-style", name: "Divider style", style: { background: { color: "#666666" } } },
      { target: "code", id: "unused-style", name: "Unused style", style: { color: "#777777" } },
    ],
    slides: [{
      id: "ordinary-slide",
      title: "Ordinary slide",
      elements: [
        { id: "ordinary-code", type: "code", hidden: false, code: "ordinary", language: "text", linkedStyleId: "code-style" },
        { id: "ordinary-terminal", type: "terminal", hidden: false, lines: [], linkedStyleId: "terminal-style" },
        { id: "ordinary-simple", type: "table", hidden: false, columns: [{ key: "value", label: "Value" }], rows: [{ value: "one" }], linkedStyleId: "simple-style" },
        { id: "ordinary-structured", type: "table", mode: "structured", hidden: false, showHeader: true, columns: [], rows: [], linkedStyleId: "structured-style" },
      ],
    }, {
      id: "root-backed-slide",
      title: "Root-backed slide",
      elements: [],
      rootDefinitionId: "root-definition",
      localRootChildren: [{ targetContainerId: "receiver", children: [
        { id: "local-code", type: "code", hidden: false, code: "local", language: "text", style: { color: "#111111" }, linkedStyleId: "code-style" },
        { id: "local-divider", type: "divider", hidden: false, linkedStyleId: "divider-style" },
      ] }],
    }],
    rootDefinitions: [{
      id: "root-definition",
      name: "Teaching master",
      localChildTargetIds: ["receiver"],
      root: { id: "root-container", type: "container", hidden: false, children: [
        { id: "receiver", type: "container", hidden: false, children: [] },
        { id: "root-code", type: "code", hidden: false, code: "root", language: "text", linkedStyleId: "code-style" },
        { id: "root-divider", type: "divider", hidden: false, linkedStyleId: "divider-style" },
      ] },
    }],
  });
}

function findButton(host: HTMLElement, label: string): HTMLButtonElement {
  const button = Array.from(host.querySelectorAll<HTMLButtonElement>("button"))
    .find((candidate) => candidate.textContent?.trim() === label);
  if (!button) throw new Error(`Button was not rendered: ${label}`);
  return button;
}

describe("LSX4B2A target Linked Style Resources", () => {
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

  async function mount(initial = initialPresentation(), target: { kind: "slide"; slideIndex: number } | { kind: "root-definition"; rootDefinitionId: string } = { kind: "root-definition", rootDefinitionId: "root-definition" }): Promise<void> {
    await act(async () => root.render(
      <StudioI18nProvider>
        <EditorWorkspace
          initialPresentation={initial}
          initialAuthoringTarget={target}
          onSave={async (snapshot) => { saved.push(structuredClone(snapshot)); }}
          customLibraryPaletteRepository={repositories}
          customLibraryFontRepository={repositories}
        />
      </StudioI18nProvider>,
    ));
  }

  async function openLinkedStyles(): Promise<void> {
    await act(async () => findButton(host, "Custom Resources").click());
    const details = Array.from(host.querySelectorAll<HTMLDetailsElement>("details"))
      .find((candidate) => candidate.querySelector("summary")?.textContent?.includes("Linked Styles"));
    if (!details) throw new Error("Linked Styles section was not rendered");
    if (!details.open) await act(async () => details.querySelector("summary")?.dispatchEvent(new MouseEvent("click", { bubbles: true })));
  }

  async function openRow(id: string): Promise<HTMLElement> {
    const row = host.querySelector<HTMLElement>(`[data-linked-style-id='${id}']`);
    if (!row) throw new Error(`Linked Style row was not rendered: ${id}`);
    const summary = row.querySelector<HTMLButtonElement>(":scope > button");
    if (!summary) throw new Error(`Linked Style summary was not rendered: ${id}`);
    await act(async () => summary.click());
    return row;
  }

  async function save(): Promise<Presentation> {
    await act(async () => findButton(host, "Save").click());
    const snapshot = saved.at(-1);
    if (!snapshot) throw new Error("Save did not produce a snapshot");
    return snapshot;
  }

  async function confirmDetach(): Promise<void> {
    const dialog = host.querySelector<HTMLElement>("[data-studio-danger-confirm-dialog]");
    if (!dialog) throw new Error("Detach confirmation was not rendered");
    await act(async () => findButton(dialog, "Detach").click());
  }

  async function undo(): Promise<void> {
    await act(async () => window.dispatchEvent(new KeyboardEvent("keydown", { key: "z", ctrlKey: true, bubbles: true, cancelable: true })));
  }

  async function redo(): Promise<void> {
    await act(async () => window.dispatchEvent(new KeyboardEvent("keydown", { key: "z", ctrlKey: true, shiftKey: true, bubbles: true, cancelable: true })));
  }

  it("shows owner-aware target usage, exact count, source metadata, and no B2B editor surface", async () => {
    await mount();
    await openLinkedStyles();
    const row = await openRow("code-style");
    expect(row.textContent).toContain("Used by 3 elements");
    expect(row.querySelectorAll("[data-linked-style-usage-source]")).toHaveLength(3);
    expect(Array.from(row.querySelectorAll<HTMLElement>("[data-linked-style-usage-source]"), (item) => item.dataset.linkedStyleUsageSource)).toEqual(["slide", "slide-local-root", "root-definition"]);
    expect(row.querySelector("[data-linked-style-preview]")).toBeNull();
    expect(row.querySelector("[data-linked-style-property]")).toBeNull();
    expect(row.textContent).not.toContain("matching");
    expect(Array.from(row.querySelectorAll<HTMLButtonElement>("button")).find((button) => button.textContent?.trim() === "Remove")?.disabled).toBe(true);
  });

  it("navigates ordinary Slide, localRootChildren, and Root Definition target usages", async () => {
    await mount();
    await openLinkedStyles();
    const row = await openRow("code-style");
    const usage = (source: string) => row.querySelector<HTMLButtonElement>(`[data-linked-style-usage-source='${source}'] button`);

    await act(async () => usage("slide-local-root")?.click());
    expect(host.querySelector('[data-authoring-target="slide"]')).not.toBeNull();
    expect(host.querySelector('[data-presentation-id="local-code"]')?.classList.contains("studio-editor-selected")).toBe(true);

    await act(async () => usage("root-definition")?.click());
    expect(host.querySelector('[data-authoring-target="root-definition"]')).not.toBeNull();
    expect(host.querySelector('[data-presentation-id="root-code"]')?.classList.contains("studio-editor-selected")).toBe(true);

    await act(async () => usage("slide")?.click());
    expect(host.querySelector('[data-presentation-id="ordinary-code"]')?.classList.contains("studio-editor-selected")).toBe(true);
  });

  it("detaches localRootChildren target content with exact Undo/Redo ownership", async () => {
    const initial = initialPresentation();
    await mount(initial);
    await openLinkedStyles();
    const row = await openRow("code-style");
    const localUsage = row.querySelector<HTMLElement>("[data-linked-style-usage-source='slide-local-root']");
    if (!localUsage) throw new Error("Local target usage was not rendered");
    await act(async () => localUsage.querySelector<HTMLButtonElement>("[data-resource-action='detach']")?.click());
    await confirmDetach();

    const changed = await save();
    const local = changed.slides[1]?.localRootChildren?.[0]?.children[0];
    expect(local).toMatchObject({ id: "local-code", style: { color: "#111111" } });
    expect(local).not.toHaveProperty("linkedStyleId");
    expect(changed.slides[1]?.elements).toEqual([]);
    expect(changed.rootDefinitions).toEqual(initial.rootDefinitions);

    await undo();
    expect(await save()).toEqual(initial);
    await redo();
    expect(await save()).toEqual(changed);
  });

  it("detaches a Root Definition target without changing Slide/local owners", async () => {
    const initial = initialPresentation();
    await mount(initial);
    await openLinkedStyles();
    const row = await openRow("code-style");
    const rootUsage = row.querySelector<HTMLElement>("[data-linked-style-usage-source='root-definition']");
    if (!rootUsage) throw new Error("Root target usage was not rendered");
    await act(async () => rootUsage.querySelector<HTMLButtonElement>("[data-resource-action='detach']")?.click());
    await confirmDetach();

    const changed = await save();
    expect(changed.rootDefinitions?.[0]?.root.children.find((element) => element.id === "root-code")).not.toHaveProperty("linkedStyleId");
    expect(changed.slides[0]?.elements).toEqual(initial.slides[0]?.elements);
    expect(changed.slides[1]?.localRootChildren).toEqual(initial.slides[1]?.localRootChildren);
    await undo();
    expect(await save()).toEqual(initial);
    await redo();
    expect(await save()).toEqual(changed);
  });

  it("detaches an ordinary Slide target through the same owner-aware path", async () => {
    const initial = initialPresentation();
    await mount(initial);
    await openLinkedStyles();
    const row = await openRow("terminal-style");
    const slideUsage = row.querySelector<HTMLElement>("[data-linked-style-usage-source='slide']");
    if (!slideUsage) throw new Error("Slide target usage was not rendered");
    await act(async () => slideUsage.querySelector<HTMLButtonElement>("[data-resource-action='detach']")?.click());
    await confirmDetach();

    const changed = await save();
    expect(changed.slides[0]?.elements.find((element) => element.id === "ordinary-terminal")).not.toHaveProperty("linkedStyleId");
    expect(changed.slides[1]?.localRootChildren).toEqual(initial.slides[1]?.localRootChildren);
    expect(changed.rootDefinitions).toEqual(initial.rootDefinitions);
    await undo();
    expect(await save()).toEqual(initial);
    await redo();
    expect(await save()).toEqual(changed);
  });

  it("protects referenced target definitions and removes unused ones through the existing guard", async () => {
    await mount();
    await openLinkedStyles();
    const used = await openRow("code-style");
    expect(Array.from(used.querySelectorAll<HTMLButtonElement>("button")).find((button) => button.textContent?.trim() === "Remove")?.disabled).toBe(true);
    const unused = await openRow("unused-style");
    const remove = Array.from(unused.querySelectorAll<HTMLButtonElement>("button")).find((button) => button.textContent?.trim() === "Remove");
    if (!remove) throw new Error("Unused target remove action was not rendered");
    expect(remove.disabled).toBe(false);
    await act(async () => remove.click());
    const changed = await save();
    expect(changed.linkedStyles?.some((style) => style.id === "unused-style")).toBe(false);
    await undo();
    expect((await save()).linkedStyles?.some((style) => style.id === "unused-style")).toBe(true);
    await redo();
    expect((await save()).linkedStyles?.some((style) => style.id === "unused-style")).toBe(false);
  });
});
