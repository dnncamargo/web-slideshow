import { describe, expect, it } from "vitest";

import {
  PresentationSchema,
  type Presentation,
  type PresentationElement,
} from "@web-slideshow/document-schema";

import {
  moveClipboardElementAcrossSlideOwners,
  moveRootBackedClipboardElement,
  pasteRootBackedClipboardEntry,
  resolveRootBackedClipboardPasteDestination,
} from "../src/features/editor/root-local-clipboard-operations";

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

function topics(id: string, contentSlotId: string): PresentationElement {
  return {
    id,
    type: "topics",
    hidden: false,
    kind: "unordered",
    items: [{
      id: `${id}-item`,
      content: {
        id: contentSlotId,
        children: [text(`${id}-text`)],
      },
      children: [],
    }],
  };
}

function rootBackedPresentation(
  localRootChildren: NonNullable<Presentation["slides"][number]["localRootChildren"]> = [],
): Presentation {
  return PresentationSchema.parse({
    schemaVersion: 1,
    id: "root-local-clipboard",
    title: "Root local Clipboard",
    slides: [{
      id: "slide-1",
      title: "Slide 1",
      summary: "",
      speakerNotes: "",
      elements: [],
      rootDefinitionId: "root-1",
      localRootChildren,
    }],
    rootDefinitions: [{
      id: "root-1",
      name: "Root 1",
      localChildTargetIds: ["receiver-a", "receiver-b"],
      root: container("root", [
        container("receiver-a"),
        container("receiver-b"),
      ]),
    }],
  });
}

function masterContainer(presentation: Presentation, id: string): PresentationElement {
  const root = presentation.rootDefinitions?.[0]?.root;
  const found = root?.type === "container"
    ? root.children.find((element) => element.id === id)
    : undefined;
  if (!found) throw new Error(`Expected master Container ${id}`);
  return found;
}

function mixedOwnerPresentation(): Presentation {
  return PresentationSchema.parse({
    schemaVersion: 1,
    id: "root-local-clipboard-mixed-owners",
    title: "Root local Clipboard mixed owners",
    slides: [
      {
        id: "root-source",
        title: "Root source",
        summary: "",
        speakerNotes: "",
        elements: [],
        rootDefinitionId: "root-1",
        localRootChildren: [{
          targetContainerId: "receiver-a",
          children: [container("local-source", [text("local-child")])],
        }],
      },
      {
        id: "ordinary-source",
        title: "Ordinary source",
        summary: "",
        speakerNotes: "",
        elements: [container("ordinary-source-container", [text("ordinary-child")])],
      },
      {
        id: "ordinary-receiver",
        title: "Ordinary receiver",
        summary: "",
        speakerNotes: "",
        elements: [container("ordinary-receiver-container")],
      },
      {
        id: "root-receiver",
        title: "Root receiver",
        summary: "",
        speakerNotes: "",
        elements: [],
        rootDefinitionId: "root-1",
      },
    ],
    rootDefinitions: [{
      id: "root-1",
      name: "Root 1",
      localChildTargetIds: ["receiver-a", "receiver-b"],
      root: container("root", [container("receiver-a"), container("receiver-b")]),
    }],
  });
}

describe("Root-backed Slide Clipboard ownership", () => {
  it("moves Slide-local content to an ordinary Slide through the same owner-aware operation", () => {
    const source = mixedOwnerPresentation();
    const ordinaryReceiver = source.slides[2]?.elements[0];
    expect(ordinaryReceiver?.type).toBe("container");

    const result = moveClipboardElementAcrossSlideOwners(
      source,
      0,
      "receiver-a",
      2,
      "local-source",
      ordinaryReceiver ?? null,
      null,
    );

    expect(result).not.toBeNull();
    expect(result?.slides[0]?.localRootChildren).toBeUndefined();
    expect(result?.slides[2]?.elements[0]?.type).toBe("container");
    if (result?.slides[2]?.elements[0]?.type !== "container") throw new Error("Expected receiver Container");
    expect(result.slides[2].elements[0].children[0]?.id).toBe("local-source-copy");
    expect(result?.rootDefinitions).toEqual(source.rootDefinitions);
  });

  it("moves ordinary Slide content into an authorized Root-backed receiver", () => {
    const source = mixedOwnerPresentation();
    const receiver = masterContainer(source, "receiver-b");

    const result = moveClipboardElementAcrossSlideOwners(
      source,
      1,
      null,
      3,
      "ordinary-source-container",
      receiver,
      null,
    );

    expect(result).not.toBeNull();
    expect(result?.slides[1]?.elements).toEqual([]);
    expect(result?.slides[3]?.localRootChildren?.[0]?.targetContainerId).toBe("receiver-b");
    expect(result?.slides[3]?.localRootChildren?.[0]?.children[0]?.id).toBe("ordinary-source-container-copy");
    expect(result?.rootDefinitions).toEqual(source.rootDefinitions);
  });

  it("resolves an authorized projected master Container to its local record root", () => {
    const source = rootBackedPresentation();

    expect(resolveRootBackedClipboardPasteDestination(
      source,
      0,
      "snapshot",
      masterContainer(source, "receiver-a"),
      null,
    )).toEqual({
      targetContainerId: "receiver-a",
      destination: { kind: "slide" },
    });
  });

  it("pastes into a new local record without mutating the Root Definition", () => {
    const source = rootBackedPresentation();
    const masterBefore = structuredClone(source.rootDefinitions);
    const result = pasteRootBackedClipboardEntry(
      source,
      0,
      text("snapshot"),
      masterContainer(source, "receiver-a"),
      null,
    );

    expect(result).not.toBeNull();
    expect(result?.presentation.slides[0]?.elements).toEqual([]);
    expect(result?.presentation.slides[0]?.localRootChildren).toHaveLength(1);
    expect(result?.presentation.slides[0]?.localRootChildren?.[0]?.targetContainerId).toBe("receiver-a");
    expect(result?.presentation.rootDefinitions).toEqual(masterBefore);
    expect(result?.pastedElement.id).not.toBe("snapshot");
    expect(PresentationSchema.safeParse(result?.presentation).success).toBe(true);
  });

  it("uses the owning local record root for a local non-Container selection", () => {
    const source = rootBackedPresentation([{
      targetContainerId: "receiver-a",
      children: [text("local-source")],
    }]);
    const localSource = source.slides[0]?.localRootChildren?.[0]?.children[0];
    expect(localSource).toBeDefined();

    expect(resolveRootBackedClipboardPasteDestination(
      source,
      0,
      "snapshot",
      localSource ?? null,
      null,
    )).toEqual({
      targetContainerId: "receiver-a",
      destination: { kind: "slide" },
    });
  });

  it("resolves and persists a local ContentSlot without touching projected master content", () => {
    const localTopics: PresentationElement = {
      id: "local-topics",
      type: "topics",
      hidden: false,
      kind: "unordered",
      items: [{
        id: "local-topic",
        content: { id: "local-slot", children: [] },
        children: [],
      }],
    };
    const source = rootBackedPresentation([{
      targetContainerId: "receiver-a",
      children: [localTopics],
    }]);
    const selected = source.slides[0]?.localRootChildren?.[0]?.children[0] ?? null;
    const result = pasteRootBackedClipboardEntry(
      source,
      0,
      text("snapshot"),
      selected,
      "local-slot",
    );

    expect(result).not.toBeNull();
    const topics = result?.presentation.slides[0]?.localRootChildren?.[0]?.children[0];
    expect(topics?.type).toBe("topics");
    if (topics?.type !== "topics") throw new Error("Expected local Topics");
    expect(topics.items[0]?.content.children.map((element) => element.id)).toEqual(["snapshot-copy"]);
    expect(result?.presentation.rootDefinitions).toEqual(source.rootDefinitions);
    expect(PresentationSchema.safeParse(result?.presentation).success).toBe(true);
  });

  it("fails closed when a resolved TopicItem ContentSlot rejects a Topics snapshot", () => {
    const localTopics = topics("local-topics", "topic-slot");
    const source = rootBackedPresentation([{
      targetContainerId: "receiver-a",
      children: [localTopics],
    }]);
    const before = structuredClone(source);
    const selected = localTopics;

    expect(resolveRootBackedClipboardPasteDestination(
      source,
      0,
      "snapshot-topics",
      selected,
      "topic-slot",
    )).toEqual({
      targetContainerId: "receiver-a",
      destination: { kind: "content-slot", id: "topic-slot" },
    });
    expect(pasteRootBackedClipboardEntry(
      source,
      0,
      topics("snapshot-topics", "snapshot-slot"),
      selected,
      "topic-slot",
    )).toBeNull();
    expect(source).toEqual(before);
  });

  it("moves local content atomically from receiver A to receiver B", () => {
    const source = rootBackedPresentation([{
      targetContainerId: "receiver-a",
      children: [container("local-container", [text("local-child")])],
    }]);
    const masterBefore = structuredClone(source.rootDefinitions);
    const result = moveRootBackedClipboardElement(
      source,
      0,
      "receiver-a",
      "local-container",
      masterContainer(source, "receiver-b"),
      null,
    );

    expect(result).not.toBeNull();
    expect(result?.slides[0]?.elements).toEqual([]);
    expect(result?.slides[0]?.localRootChildren).toHaveLength(1);
    expect(result?.slides[0]?.localRootChildren?.[0]?.targetContainerId).toBe("receiver-b");
    expect(result?.slides[0]?.localRootChildren?.[0]?.children[0]?.id).not.toBe("local-container");
    expect(result?.rootDefinitions).toEqual(masterBefore);
    expect(PresentationSchema.safeParse(result).success).toBe(true);
  });

  it("does not remove a local source when a same-receiver TopicItem destination rejects insertion", () => {
    const sourceTopics = topics("source-topics", "source-slot");
    const destinationTopics = topics("destination-topics", "destination-slot");
    const source = rootBackedPresentation([{
      targetContainerId: "receiver-a",
      children: [sourceTopics, destinationTopics],
    }]);
    const before = structuredClone(source);

    expect(moveRootBackedClipboardElement(
      source,
      0,
      "receiver-a",
      "source-topics",
      destinationTopics,
      "destination-slot",
    )).toBeNull();
    expect(source).toEqual(before);
  });

  it("fails closed for no selection, unauthorized projected Containers, and self-descendant placement", () => {
    const source = rootBackedPresentation([{
      targetContainerId: "receiver-a",
      children: [container("local-container", [container("local-descendant")])],
    }]);
    const before = structuredClone(source);

    expect(resolveRootBackedClipboardPasteDestination(source, 0, "snapshot", null, null)).toBeNull();
    expect(resolveRootBackedClipboardPasteDestination(
      source,
      0,
      "snapshot",
      container("unauthorized"),
      null,
    )).toBeNull();
    expect(moveRootBackedClipboardElement(
      source,
      0,
      "receiver-a",
      "local-container",
      { id: "local-descendant", type: "container", hidden: false, children: [] },
      null,
    )).toBeNull();
    expect(source).toEqual(before);
  });
});
