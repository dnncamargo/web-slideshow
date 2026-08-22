import { describe, expect, it } from "vitest";

import type {
  BlockItem,
  BlocksElement,
} from "@powershow/document-schema";

import { renderBlocks } from "../src/render-blocks";
import { renderElement } from "../src/render-element";

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
  items: BlockItem[] = [],
  overrides: Partial<BlocksElement> = {},
): BlocksElement {
  return {
    id: "blocks-1",
    type: "blocks",
    items,
    hidden: false,
    ...overrides,
  };
}

function countOccurrences(
  value: string,
  search: string,
): number {
  return value.split(search).length - 1;
}

describe("renderBlocks", () => {
  it("renders a root div with the powershow-element class", () => {
    const html = renderBlocks(blocksElement());

    expect(html).toMatch(/^<div /);

    expect(html).toContain("powershow-element");
  });

  it("renders the powershow-blocks class", () => {
    expect(
      renderBlocks(blocksElement()),
    ).toContain("powershow-blocks");
  });

  it("emits data-powershow-id", () => {
    expect(
      renderBlocks(blocksElement()),
    ).toContain('data-powershow-id="blocks-1"');
  });

  it("emits data-powershow-type=blocks", () => {
    expect(
      renderBlocks(blocksElement()),
    ).toContain('data-powershow-type="blocks"');
  });

  it("renders root items in order", () => {
    const html = renderBlocks(
      blocksElement([
        blockItem("first", "alpha"),
        blockItem("second", "beta"),
        blockItem("third", "gamma"),
      ]),
    );

    expect(html.indexOf("alpha")).toBeLessThan(
      html.indexOf("beta"),
    );

    expect(html.indexOf("beta")).toBeLessThan(
      html.indexOf("gamma"),
    );
  });

  it("renders nested children recursively", () => {
    const html = renderBlocks(
      blocksElement([
        blockItem("outer", "outer text", [
          blockItem("inner-1", "inner one", [
            blockItem("inner-2", "inner two"),
          ]),
        ]),
      ]),
    );

    expect(html).toContain("outer text");

    expect(html).toContain("inner one");

    expect(html).toContain("inner two");
  });

  // ============================================================
  // BEGIN: NODE / ITEM STRUCTURE
  // ============================================================

  it("renders one powershow-blocks-node per BlockItem", () => {
    const html = renderBlocks(
      blocksElement([
        blockItem("outer", "outer", [
          blockItem("inner-1", "one", [
            blockItem("inner-2", "two"),
          ]),
          blockItem("inner-3", "three"),
        ]),
      ]),
    );

    expect(
      countOccurrences(html, 'class="powershow-blocks-node"'),
    ).toBe(4);
  });

  it("renders one powershow-blocks-item per BlockItem", () => {
    const html = renderBlocks(
      blocksElement([
        blockItem("outer", "outer", [
          blockItem("inner-1", "one", [
            blockItem("inner-2", "two"),
          ]),
          blockItem("inner-3", "three"),
        ]),
      ]),
    );

    expect(
      countOccurrences(html, 'class="powershow-blocks-item"'),
    ).toBe(4);
  });

  it("renders node and item as separate elements", () => {
    const html = renderBlocks(
      blocksElement([
        blockItem("block-a", "one"),
      ]),
    );

    expect(
      countOccurrences(html, "powershow-blocks-node"),
    ).toBe(1);

    expect(
      countOccurrences(html, "powershow-blocks-item"),
    ).toBe(1);

    expect(
      countOccurrences(html, "<div"),
    ).toBeGreaterThanOrEqual(2);
  });

  it("does not combine node and item on a single class attribute", () => {
    const html = renderBlocks(
      blocksElement([
        blockItem("block-a", "one"),
      ]),
    );

    expect(html).not.toContain(
      "powershow-blocks-node powershow-blocks-item",
    );

    expect(html).not.toContain(
      "powershow-blocks-item powershow-blocks-node",
    );
  });

  it("places data-powershow-block-id on the structural node", () => {
    const html = renderBlocks(
      blocksElement([
        blockItem("block-a", "one"),
      ]),
    );

    const nodeStart = html.indexOf('class="powershow-blocks-node"');

    const idAt = html.indexOf('data-powershow-block-id="block-a"');

    const nodeTagEnd = html.indexOf(
      ">",
      nodeStart,
    );

    expect(nodeStart).toBeGreaterThanOrEqual(0);

    expect(idAt).toBeGreaterThan(nodeStart);

    expect(idAt).toBeLessThan(nodeTagEnd);
  });

  it("does not emit data-powershow-id for any BlockItem", () => {
    const html = renderBlocks(
      blocksElement([
        blockItem("block-a", "one", [
          blockItem("block-a-1", "nested"),
        ]),
        blockItem("block-b", "two"),
      ]),
    );

    expect(html).not.toContain('data-powershow-id="block-a"');

    expect(html).not.toContain('data-powershow-id="block-a-1"');

    expect(html).not.toContain('data-powershow-id="block-b"');

    expect(
      countOccurrences(html, "data-powershow-block-id="),
    ).toBe(3);
  });

  it("keeps parent text inside the parent powershow-blocks-item", () => {
    const html = renderBlocks(
      blocksElement([
        blockItem("parent", "parent-text", [
          blockItem("child", "child-text"),
        ]),
      ]),
    );

    const parentItemOpen = html.indexOf(
      'class="powershow-blocks-item"',
    );

    const parentItemClose = html.indexOf(
      "</div>",
      parentItemOpen,
    );

    const parentTextAt = html.indexOf("parent-text");

    expect(parentTextAt).toBeGreaterThan(parentItemOpen);

    expect(parentTextAt).toBeLessThan(parentItemClose);

    expect(
      html.indexOf("child-text"),
    ).toBeGreaterThan(parentItemClose);
  });

  it("closes the parent item before the parent children group begins", () => {
    const html = renderBlocks(
      blocksElement([
        blockItem("parent", "parent-text", [
          blockItem("child", "child-text"),
        ]),
      ]),
    );

    const parentItemOpen = html.indexOf(
      'class="powershow-blocks-item"',
    );

    const parentItemClose = html.indexOf(
      "</div>",
      parentItemOpen,
    );

    const childrenOpen = html.indexOf('class="powershow-blocks-children"');

    expect(childrenOpen).toBeGreaterThan(parentItemClose);
  });

  it("renders descendants inside children, not inside parent visual item", () => {
    const html = renderBlocks(
      blocksElement([
        blockItem("parent", "parent-text", [
          blockItem("child", "child-text"),
        ]),
      ]),
    );

    const parentItemOpen = html.indexOf(
      'class="powershow-blocks-item"',
    );

    const parentItemClose = html.indexOf(
      "</div>",
      parentItemOpen,
    );

    const childrenOpen = html.indexOf('class="powershow-blocks-children"');

    const childNodeOpen = html.indexOf('class="powershow-blocks-node"', childrenOpen);

    expect(childrenOpen).toBeGreaterThan(parentItemClose);

    expect(childNodeOpen).toBeGreaterThan(childrenOpen);

    expect(html.indexOf("child-text")).toBeGreaterThan(childrenOpen);
  });

  // ============================================================
  // END: NODE / ITEM STRUCTURE
  // ============================================================

  it("aligns root list to flex-start", () => {
    const html = renderBlocks(
      blocksElement([
        blockItem("block-a", "one"),
      ]),
    );

    expect(html).toContain("align-items:flex-start");
  });

  it("aligns nested children to flex-start", () => {
    const html = renderBlocks(
      blocksElement([
        blockItem("outer", "outer", [
          blockItem("inner", "inner"),
        ]),
      ]),
    );

    const childrenOpen = html.indexOf('class="powershow-blocks-children"');

    const childrenTag = html.slice(
      childrenOpen,
      html.indexOf(">", childrenOpen),
    );

    expect(childrenTag).toContain("align-items:flex-start");
  });

  it("emits the visual block sizing and shape styles", () => {
    const html = renderBlocks(
      blocksElement([
        blockItem("block-a", "value = 1"),
      ]),
    );

    const itemOpen = html.indexOf('class="powershow-blocks-item"');

    const itemTag = html.slice(
      itemOpen,
      html.indexOf(">", itemOpen),
    );

    expect(itemTag).toContain("display:block");

    expect(itemTag).toContain("max-width:100%");

    expect(itemTag).toContain("box-sizing:border-box");

    expect(itemTag).toContain("padding:8px 12px");

    expect(itemTag).toContain("border:1px solid currentColor");

    expect(itemTag).toContain("border-radius:8px");

    expect(itemTag).toContain("white-space:pre-wrap");
  });

  it("keeps nested visual indentation at 24px", () => {
    const html = renderBlocks(
      blocksElement([
        blockItem("outer", "outer", [
          blockItem("inner", "inner"),
        ]),
      ]),
    );

    expect(html).toContain("margin-inline-start:24px");
  });

  it("escapes block text", () => {
    const html = renderBlocks(
      blocksElement([
        blockItem(
          "block-x",
          '<button onclick="run()">Run</button>',
        ),
      ]),
    );

    expect(html).toContain(
      "&lt;button onclick=&quot;run()&quot;&gt;Run&lt;/button&gt;",
    );

    expect(html).not.toContain("<button");
  });

  it("renders nothing when hidden", () => {
    expect(
      renderBlocks(blocksElement([], { hidden: true })),
    ).toBe("");
  });

  it("applies generic ElementStyle to the root only", () => {
    const html = renderBlocks(
      blocksElement([
        blockItem("block-a", "one"),
      ], {
        style: {
          width: "80%",
          height: 400,
          background: "#0f172a",
          borderRadius: 8,
          opacity: 0.9,
        },
      }),
    );

    // The style belongs on the top-level root element.
    expect(html.indexOf("width:80%")).toBeLessThan(
      html.indexOf("powershow-blocks-item"),
    );

    expect(html).toContain("height:400px");

    expect(html).toContain("background:#0f172a");

    expect(html).toContain("border-radius:8px");

    expect(html).toContain("opacity:0.9");
  });

  it("preserves the authored custom className", () => {
    const html = renderBlocks(
      blocksElement([], {
        style: { className: "my-blocks" },
      }),
    );

    expect(html).toContain("my-blocks");
  });

  it("renders empty Blocks as a valid empty root", () => {
    const html = renderBlocks(blocksElement([]));

    expect(html).toContain("powershow-blocks");

    expect(html).toContain("powershow-blocks-list");

    expect(html).not.toContain("data-powershow-block-id=");

    expect(html).not.toContain("powershow-blocks-item");

    expect(html).toContain("</div>");
  });

  it("output contains no scripts, handlers, or runtime", () => {
    const html = renderBlocks(
      blocksElement([
        blockItem("block-a", "value = 1"),
        blockItem("block-b", "return 42"),
      ]),
    );

    expect(html).not.toContain("<script");

    expect(html).not.toContain("onclick");

    expect(html).not.toContain("onload");

    expect(html).not.toContain("javascript:");

    expect(html).not.toContain("eval");

    expect(html).not.toContain("Function(");
  });

  it("dispatches Blocks through renderElement", () => {
    const html = renderElement(
      blocksElement([
        blockItem("block-a", "value = 1"),
      ]),
    );

    expect(html).toContain("powershow-blocks");

    expect(html).toContain('data-powershow-type="blocks"');
  });
});