import { describe, expect, it } from "vitest";

import {
  PresentationSchema,
  type PowerShowElement,
  type Presentation,
} from "@powershow/document-schema";

import {
  moveClipboardElement,
  resolveClipboardPasteDestination,
} from "../src/features/editor/clipboard-operations";

const divider = (id: string): PowerShowElement =>
  ({ id, type: "divider" } as PowerShowElement);

const presentation = (
  slides: Array<{ id: string; title: string; elements: readonly PowerShowElement[] }>,
): Presentation =>
  PresentationSchema.parse({
    schemaVersion: 1,
    id: "clipboard-move",
    title: "Clipboard move",
    slides: slides.map((slide) => ({
      ...slide,
      summary: "",
      speakerNotes: "",
    })),
  });

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

describe("Pending Cut move", () => {
  it("moves a live source across slides with fresh ids in one result", () => {
    const source = divider("source");
    const current = presentation([
      { id: "slide-a", title: "A", elements: [source] },
      { id: "slide-b", title: "B", elements: [] },
    ]);

    const next = moveClipboardElement(current, "slide-a", "source", 1, null, null);
    expect(next).not.toBeNull();
    expect(next?.slides[0]?.elements).toEqual([]);
    expect(next?.slides[1]?.elements).toHaveLength(1);
    expect(next?.slides[1]?.elements[0]?.id).not.toBe("source");
  });

  it("keeps a moved Container as one structural child with fresh descendants", () => {
    const source = {
      id: "source-container",
      type: "container",
      hidden: false,
      children: [divider("source-child")],
    } as unknown as PowerShowElement;
    const receiver = {
      id: "receiver-container",
      type: "container",
      hidden: false,
      children: [],
    } as unknown as PowerShowElement;
    const current = presentation([{
      id: "slide-1",
      title: "One",
      elements: [source, receiver],
    }]);

    const next = moveClipboardElement(
      current,
      "slide-1",
      "source-container",
      0,
      receiver,
      null,
    );
    const nextReceiver = next?.slides[0]?.elements.find((element) => element.id === "receiver-container");
    expect(nextReceiver?.type).toBe("container");
    if (nextReceiver?.type !== "container") throw new Error("expected receiver");
    expect(nextReceiver.children).toHaveLength(1);
    expect(nextReceiver.children[0]?.type).toBe("container");
    if (nextReceiver.children[0]?.type !== "container") throw new Error("expected moved container");
    expect(nextReceiver.children[0].children).toHaveLength(1);
    expect(nextReceiver.children[0].children[0]?.id).not.toBe("source-child");
  });

  it("uses an explicit ContentSlot receiver", () => {
    const topics = {
      id: "topics",
      type: "topics",
      hidden: false,
      kind: "unordered",
      items: [{ id: "item", content: { id: "slot", children: [] }, children: [] }],
    } as unknown as PowerShowElement;
    const current = presentation([{
      id: "slide-1",
      title: "One",
      elements: [divider("source"), topics],
    }]);

    const next = moveClipboardElement(current, "slide-1", "source", 0, null, "slot");
    expect(next?.slides[0]?.elements).toHaveLength(1);
    const movedTopics = next?.slides[0]?.elements.find((element) => element.id === "topics");
    expect(movedTopics?.type).toBe("topics");
    if (movedTopics?.type !== "topics") throw new Error("expected topics");
    expect(movedTopics.items[0]?.content.children).toHaveLength(1);
  });

  it("rejects moving a Container into its own descendant", () => {
    const descendant = {
      id: "descendant",
      type: "container",
      hidden: false,
      children: [],
    } as unknown as PowerShowElement;
    const source = {
      id: "source-container",
      type: "container",
      hidden: false,
      children: [descendant],
    } as unknown as PowerShowElement;
    const current = presentation([{ id: "slide-1", title: "One", elements: [source] }]);

    const next = moveClipboardElement(current, "slide-1", "source-container", 0, descendant, null);
    expect(next).toBeNull();
  });
});
