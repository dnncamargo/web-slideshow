// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { PresentationSchema, type Presentation } from "@web-slideshow/document-schema";
import { EditorWorkspace } from "../src/features/editor/editor-workspace";
import { StudioI18nProvider } from "../src/features/i18n/studio-i18n-context";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

const style = { target: "code", id: "owner-code-style", name: "Owner Code", style: { color: "#222" } } as const;
const layoutStyle = { target: "code", id: "owner-layout-style", name: "Owner Layout", layout: { marginTop: 32 } } as const;

function code(id: string) { return { id, type: "code" as const, hidden: false, code: "const owner = true", language: "typescript", showLineNumbers: true, highlightedLines: [], style: { color: "#111" } }; }

function ownedCode(id: string) { return { ...code(id), linkedStyleId: layoutStyle.id }; }

function rootPresentation(local = false): Presentation {
  return PresentationSchema.parse({
    schemaVersion: 1, id: "lsx3b1-owner", title: "Owners",
    slides: [{ id: "slide", title: "Slide", elements: local ? [] : [{ id: "slide-code", type: "code", hidden: false, code: "slide", language: "text", showLineNumbers: true, highlightedLines: [] }], ...(local ? { rootDefinitionId: "root", localRootChildren: [{ targetContainerId: "receiver", children: [code("local-code")] }] } : {}) }],
    rootDefinitions: [{ id: "root", name: "Root", ...(local ? { localChildTargetIds: ["receiver"] } : {}), root: { id: "root-container", type: "container", hidden: false, children: local ? [{ id: "receiver", type: "container", hidden: false, children: [] }] : [code("root-code")] } }],
    linkedStyles: [style],
  });
}

describe("LSX3B1 target relationship owner resolution", () => {
  let host: HTMLDivElement; let root: Root;
  beforeEach(() => { host = document.createElement("div"); document.body.appendChild(host); root = createRoot(host); });
  afterEach(async () => { await act(async () => root.unmount()); document.body.innerHTML = ""; });

  async function run(initial: Presentation, initialAuthoringTarget: { kind: "slide"; slideIndex: number } | { kind: "root-definition"; rootDefinitionId: string }): Promise<{ changed: Presentation; undo: Presentation; redo: Presentation }> {
    const saved: Presentation[] = [];
    await act(async () => root.render(<StudioI18nProvider><EditorWorkspace initialPresentation={initial} initialAuthoringTarget={initialAuthoringTarget} onSave={async (snapshot) => { saved.push(structuredClone(snapshot)); }} /></StudioI18nProvider>));
    const target = host.querySelector<HTMLElement>('[data-presentation-id$="code"]'); if (!target) throw new Error("target was not rendered");
    await act(async () => target.dispatchEvent(new Event("pointerdown", { bubbles: true })));
    const select = host.querySelector<HTMLSelectElement>("select[id$='-linked-style']"); if (!select) throw new Error("relationship select was not rendered");
    await act(async () => { select.value = style.id; select.dispatchEvent(new Event("change", { bubbles: true })); });
    const save = async () => { const button = Array.from(host.querySelectorAll<HTMLButtonElement>("button")).find((candidate) => candidate.textContent?.trim() === "Save"); if (!button) throw new Error("Save was not rendered"); await act(async () => button.click()); const snapshot = saved.at(-1); if (!snapshot) throw new Error("save did not run"); return snapshot; };
    const changed = await save();
    await act(async () => window.dispatchEvent(new KeyboardEvent("keydown", { key: "z", ctrlKey: true, bubbles: true, cancelable: true })));
    const undo = await save();
    await act(async () => window.dispatchEvent(new KeyboardEvent("keydown", { key: "z", ctrlKey: true, shiftKey: true, bubbles: true, cancelable: true })));
    const redo = await save();
    return { changed, undo, redo };
  }

  it("writes Root Definition target relationships to rootDefinitions[].root only", async () => {
    const initial = rootPresentation(); const result = await run(initial, { kind: "root-definition", rootDefinitionId: "root" });
    expect(result.changed.rootDefinitions?.[0]?.root.children.find((element) => element.id === "root-code")).toHaveProperty("linkedStyleId", style.id);
    expect(result.changed.slides[0]!.elements).toEqual(initial.slides[0]!.elements);
    expect(result.undo).toEqual(initial); expect(result.redo).toEqual(result.changed);
  });

  it("writes localRootChildren target relationships to the local owner only", async () => {
    const initial = rootPresentation(true); const result = await run(initial, { kind: "slide", slideIndex: 0 });
    expect(result.changed.slides[0]!.localRootChildren?.[0]?.children[0]).toHaveProperty("linkedStyleId", style.id);
    expect(result.changed.slides[0]!.elements).toEqual(initial.slides[0]!.elements);
    expect(result.changed.rootDefinitions?.[0]?.root.children.find((element) => element.id === "receiver")).not.toHaveProperty("linkedStyleId");
    expect(result.undo).toEqual(initial); expect(result.redo).toEqual(result.changed);
  });

  it.each(["root", "local"] as const)("resolves linked Inspector locks for %s ownership", async (owner) => {
    const initial = PresentationSchema.parse({
      schemaVersion: 1,
      id: `lsx3b2-${owner}-inspector`,
      title: "Owner inspector",
      slides: [{
        id: "slide",
        title: "Slide",
        elements: owner === "root" ? [] : [],
        ...(owner === "local" ? {
          rootDefinitionId: "root",
          localRootChildren: [{ targetContainerId: "receiver", children: [ownedCode("local-code")] }],
        } : {}),
      }],
      rootDefinitions: [{
        id: "root",
        name: "Root",
        ...(owner === "local" ? { localChildTargetIds: ["receiver"] } : {}),
        root: {
          id: "root-container",
          type: "container",
          hidden: false,
          children: owner === "root"
            ? [ownedCode("root-code")]
            : [{ id: "receiver", type: "container", hidden: false, children: [] }],
        },
      }],
      linkedStyles: [layoutStyle],
    });
    await act(async () => root.render(<StudioI18nProvider><EditorWorkspace initialPresentation={initial} initialAuthoringTarget={owner === "root" ? { kind: "root-definition", rootDefinitionId: "root" } : { kind: "slide", slideIndex: 0 }} onSave={async () => {}} /></StudioI18nProvider>));
    const target = host.querySelector<HTMLElement>(`[data-presentation-id$="${owner === "root" ? "root-code" : "local-code"}"]`);
    if (!target) throw new Error("owner target was not rendered");
    await act(async () => target.dispatchEvent(new Event("pointerdown", { bubbles: true })));
    const top = host.querySelector<HTMLInputElement>("#code-margin-top");
    if (!top) throw new Error("top position control was not rendered");
    expect(top.disabled).toBe(true);
    expect(top.value).toContain("32");
  });
});
