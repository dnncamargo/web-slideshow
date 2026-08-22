import { describe, expect, it } from "vitest";

import type {
  BlockItem,
  BlocksElement,
  PowerShowElement,
} from "@powershow/document-schema";

import {
  collectAuthoringIds,
  findElementById,
} from "../src/features/editor/element-hierarchy";

function blockItem(
  id: string,
  text: string,
  children: BlockItem[] = [],
): BlockItem {
  return {
    id,
    text,
    children,
  };
}

function blocksElement(
  id: string,
  items: BlockItem[],
): BlocksElement {
  return {
    id,
    type: "blocks",
    hidden: false,
    items,
  };
}

function collectIds(elements: readonly PowerShowElement[]): Set<string> {
  const ids = new Set<string>();

  for (const element of elements) {
    collectAuthoringIds(element, ids);
  }

  return ids;
}

describe("BlockItem authoring ID inventory", () => {
  it("collects the ordinary Blocks element id", () => {
    const ids = collectIds([blocksElement("blocks-1", [])]);

    expect(ids.has("blocks-1")).toBe(true);
  });

  it("collects every root BlockItem id", () => {
    const ids = collectIds([
      blocksElement("blocks-1", [
        blockItem("root-a", "A"),
        blockItem("root-b", "B"),
      ]),
    ]);

    expect(ids.has("root-a")).toBe(true);

    expect(ids.has("root-b")).toBe(true);
  });

  it("collects nested BlockItem ids recursively", () => {
    const ids = collectIds([
      blocksElement("blocks-1", [
        blockItem("root-a", "A", [
          blockItem("child-a", "A1", [blockItem("grand-a", "A1a")]),
        ]),
      ]),
    ]);

    expect(ids.has("root-a")).toBe(true);

    expect(ids.has("child-a")).toBe(true);

    expect(ids.has("grand-a")).toBe(true);
  });

  it("collects BlockItem ids inside containers", () => {
    const inner = blocksElement("blocks-2", [
      blockItem("nested-block", "N"),
    ]);

    const container: PowerShowElement = {
      type: "container",
      id: "container-1",
      hidden: false,
      direction: "column",
      children: [inner],
    };

    const ids = collectIds([container]);

    expect(ids.has("container-1")).toBe(true);

    expect(ids.has("blocks-2")).toBe(true);

    expect(ids.has("nested-block")).toBe(true);
  });

  it("does not return BlockItems through findElementById", () => {
    const elements: PowerShowElement[] = [
      blocksElement("blocks-1", [
        blockItem("root-a", "A"),
        blockItem("other-root", "B", [blockItem("nested-c", "C")]),
      ]),
    ];

    expect(findElementById(elements, "blocks-1")?.type).toBe("blocks");

    expect(findElementById(elements, "root-a")).toBeNull();

    expect(findElementById(elements, "other-root")).toBeNull();

    expect(findElementById(elements, "nested-c")).toBeNull();
  });

  it("leaves existing Topics/Table/Container ID behavior unchanged", () => {
    const structure: PowerShowElement[] = [
      {
        type: "container",
        id: "container-1",
        hidden: false,
        direction: "column",
        children: [
          {
            type: "text",
            id: "text-1",
            hidden: false,
            variant: "body",
            content: "Hi",
          },
        ],
      },
      {
        type: "topics",
        id: "topics-1",
        hidden: false,
        kind: "unordered",
        items: [
          {
            id: "topic-a",
            content: {
              id: "slot-a",
              children: [
                {
                  type: "text",
                  id: "topic-text",
                  hidden: false,
                  variant: "body",
                  content: "Topic",
                },
              ],
            },
            children: [],
          },
        ],
      },
      {
        type: "table",
        id: "table-1",
        hidden: false,
        mode: "structured",
        showHeader: true,
        columns: [
          {
            id: "column-1",
            header: {
              id: "header-slot-1",
              children: [
                {
                  type: "text",
                  id: "header-text",
                  hidden: false,
                  variant: "body",
                  content: "Column",
                },
              ],
            },
          },
        ],
        rows: [],
      },
    ];

    const ids = collectIds(structure);

    expect(ids.has("container-1")).toBe(true);

    expect(ids.has("text-1")).toBe(true);

    expect(ids.has("topics-1")).toBe(true);

    expect(ids.has("topic-a")).toBe(true);

    expect(ids.has("slot-a")).toBe(true);

    expect(ids.has("table-1")).toBe(true);

    expect(ids.has("column-1")).toBe(true);

    expect(ids.has("header-slot-1")).toBe(true);

    expect(ids.has("header-text")).toBe(true);
  });
});