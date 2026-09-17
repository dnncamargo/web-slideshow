import { describe, expect, it } from "vitest";

import type { PowerShowElement } from "@powershow/document-schema";

import { resolveClipboardPasteDestination } from "../src/features/editor/clipboard-operations";

const divider = (id: string): PowerShowElement =>
  ({ id, type: "divider" } as PowerShowElement);

describe("Clipboard paste destination", () => {
  it("uses the current slide root for a slide-root source", () => {
    expect(
      resolveClipboardPasteDestination("slide", [], null, null),
    ).toEqual({ kind: "slide" });
  });

  it("requires an explicitly selected current Container for container sources", () => {
    const container = { id: "container", type: "container", children: [] } as unknown as PowerShowElement;
    expect(
      resolveClipboardPasteDestination("container", [container], container, null),
    ).toEqual({ kind: "container", id: "container" });
    expect(
      resolveClipboardPasteDestination("container", [container], null, null),
    ).toBeNull();
    expect(
      resolveClipboardPasteDestination("container", [container], divider("other"), null),
    ).toBeNull();
  });

  it("requires an explicit existing ContentSlot for content-slot sources", () => {
    const topics = {
      id: "topics",
      type: "topics",
      hidden: false,
      kind: "unordered",
      items: [{
        id: "topic-item",
        content: { id: "slot", children: [] },
        children: [],
      }],
    } as unknown as PowerShowElement;

    expect(
      resolveClipboardPasteDestination("content-slot", [topics], divider("child"), "slot"),
    ).toEqual({ kind: "content-slot", id: "slot" });
    expect(
      resolveClipboardPasteDestination("content-slot", [topics], divider("child"), null),
    ).toBeNull();
    expect(
      resolveClipboardPasteDestination("content-slot", [topics], divider("child"), "missing"),
    ).toBeNull();
  });
});
