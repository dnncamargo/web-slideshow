import { describe, expect, it } from "vitest";

import type { PowerShowElement } from "@powershow/document-schema";

import { resolveClipboardPasteDestination } from "../src/features/editor/clipboard-operations";

const divider = (id: string): PowerShowElement =>
  ({ id, type: "divider" } as PowerShowElement);

describe("Clipboard paste destination", () => {
  it("uses the current parent when the original source remains selected", () => {
    const source = divider("source");
    expect(
      resolveClipboardPasteDestination([source], "source", source, null),
    ).toEqual({ kind: "slide" });

    const container = { id: "container", type: "container", children: [source] } as unknown as PowerShowElement;
    expect(
      resolveClipboardPasteDestination([container], "source", source, null),
    ).toEqual({ kind: "container", id: "container" });

    const rootContainer = { id: "root-container", type: "container", children: [] } as unknown as PowerShowElement;
    expect(
      resolveClipboardPasteDestination([rootContainer], "root-container", rootContainer, null),
    ).toEqual({ kind: "slide" });
  });

  it("uses a different selected Container as the explicit receiver", () => {
    const container = { id: "container", type: "container", children: [] } as unknown as PowerShowElement;
    expect(
      resolveClipboardPasteDestination([container], "source", container, null),
    ).toEqual({ kind: "container", id: "container" });
  });

  it.each(["terminal", "plot", "code", "container"] as const)(
    "%s snapshots can use a different Container as receiver",
    (type) => {
      const container = { id: "receiver", type: "container", children: [] } as unknown as PowerShowElement;
      const source = { id: "source", type } as unknown as PowerShowElement;
      expect(
        resolveClipboardPasteDestination(
          [container],
          source.id,
          container,
          null,
        ),
      ).toEqual({ kind: "container", id: "receiver" });
    },
  );

  it("keeps a Container receiver stable for repeated insertions", () => {
    const receiver = {
      id: "receiver",
      type: "container",
      children: [],
    } as unknown as Extract<PowerShowElement, { type: "container" }>;
    const snapshot = divider("snapshot");
    const first = {
      ...receiver,
      children: [...receiver.children, snapshot],
    };
    const second = {
      ...first,
      children: [...first.children, divider("snapshot-copy")],
    };

    expect(first.children).toHaveLength(1);
    expect(second.children).toHaveLength(2);
    expect(second.id).toBe(receiver.id);
  });

  it("uses an explicit existing ContentSlot before falling back to root", () => {
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
      resolveClipboardPasteDestination([topics], "child", divider("child"), "slot"),
    ).toEqual({ kind: "content-slot", id: "slot" });
    expect(
      resolveClipboardPasteDestination([topics], "child", divider("child"), null),
    ).toEqual({ kind: "slide" });
    expect(
      resolveClipboardPasteDestination([topics], "child", divider("child"), "missing"),
    ).toEqual({ kind: "slide" });
  });
});
