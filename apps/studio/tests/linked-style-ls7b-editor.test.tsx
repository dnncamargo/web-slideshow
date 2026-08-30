// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it } from "vitest";
import { PresentationSchema, type Presentation } from "@powershow/document-schema";

import { EditorWorkspace } from "../src/features/editor/editor-workspace";
import { StudioI18nProvider } from "../src/features/i18n/studio-i18n-context";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

const repositories = { listPalettes: async () => [], listFonts: async () => [] } as never;

function presentation(secondLinked = false): Presentation {
  return PresentationSchema.parse({
    schemaVersion: 1,
    id: "ls7b",
    title: "LS7B",
    slides: [
      { id: "slide-1", title: "First", elements: [
        { id: "linked", type: "container", hidden: false, linkedStyleId: "gap", children: [] },
        { id: "match-a", type: "container", hidden: false, layout: { children: { gap: 16 } }, children: [] },
        { id: "mismatch", type: "container", hidden: false, layout: { children: { gap: 12 } }, children: [] },
      ] },
      { id: "slide-2", title: "Second", elements: [
        { id: "match-b", type: "container", hidden: false, ...(secondLinked ? { linkedStyleId: "gap" } : { layout: { children: { gap: 16 } } }), children: [] },
      ] },
    ],
    linkedStyles: [{ id: "gap", name: "Gap", layout: { children: { gap: 16 } } }],
  });
}

describe("LS7B Linked Styles editor integration", () => {
  let host: HTMLDivElement;
  let root: Root;

  afterEach(async () => {
    await act(async () => root.unmount());
    host.remove();
  });

  async function mount(value = presentation()) {
    host = document.createElement("div");
    document.body.append(host);
    root = createRoot(host);
    await act(async () => root.render(<StudioI18nProvider><EditorWorkspace initialPresentation={value} customLibraryPaletteRepository={repositories} customLibraryFontRepository={repositories} /></StudioI18nProvider>));
  }

  async function openLinkedStyles() {
    await act(async () => Array.from(host.querySelectorAll<HTMLButtonElement>("button")).find((button) => button.textContent === "Custom Resources")?.click());
    const section = Array.from(host.querySelectorAll("details")).find((detail) => detail.textContent?.includes("Linked Styles"));
    await act(async () => section?.querySelector("summary")?.dispatchEvent(new MouseEvent("click", { bubbles: true })));
    const row = host.querySelector<HTMLElement>("[data-linked-style-id='gap']");
    await act(async () => row?.querySelector("button")?.click());
    return row;
  }

  it("attaches current matches through EditorWorkspace and leaves mismatches unlinked", async () => {
    await mount();
    const row = await openLinkedStyles();
    expect(row?.textContent).toContain("Used by 1 element");
    expect(row?.textContent).toContain("Matching 2 elements");
    await act(async () => Array.from(row?.querySelectorAll<HTMLButtonElement>("button") ?? []).find((button) => button.textContent?.includes("Attach 2 matching"))?.click());
    expect(row?.textContent).toContain("Used by 3 elements");
    expect(row?.textContent).toContain("Matching 0 elements");
    expect(row?.textContent).not.toContain("Attach 2 matching");
    expect(host.querySelector("[data-powershow-id='mismatch']")).not.toBeNull();
    expect(host.textContent).toContain("Resources");
  });

  it("navigates to one linked Container across slides while keeping Resources open", async () => {
    await mount(presentation(true));
    const row = await openLinkedStyles();
    const locationButton = Array.from(row?.querySelectorAll<HTMLButtonElement>("button") ?? []).find((button) => button.textContent?.includes("Slide 2"));
    await act(async () => locationButton?.click());
    expect(host.textContent).toContain("Slide 2");
    expect(host.textContent).toContain("Container · match-b");
    expect(host.textContent).toContain("Resources");
    expect(host.querySelector("[data-powershow-id='match-b']")).not.toBeNull();
  });
});
