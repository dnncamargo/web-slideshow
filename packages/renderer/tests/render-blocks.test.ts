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

  it("exposes block ids only as data-powershow-block-id", () => {
    const html = renderBlocks(
      blocksElement([
        blockItem("block-a", "one", [
          blockItem("block-a-1", "nested"),
        ]),
        blockItem("block-b", "two"),
      ]),
    );

    expect(html).toContain('data-powershow-block-id="block-a"');

    expect(
      html,
    ).toContain('data-powershow-block-id="block-a-1"');

    expect(html).toContain('data-powershow-block-id="block-b"');

    expect(html).not.toContain('data-powershow-id="block-a"');

    expect(html).not.toContain('data-powershow-id="block-a-1"');

    expect(html).not.toContain('data-powershow-id="block-b"');

    expect(
      countOccurrences(html, "data-powershow-block-id="),
    ).toBe(3);
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

  it("renders empty Blocks as a valid empty root", () => {
    const html = renderBlocks(blocksElement([]));

    expect(html).toContain("powershow-blocks");

    expect(html).toContain("powershow-blocks-list");

    expect(html).not.toContain("data-powershow-block-id=");

    expect(html).toContain("</div>");
  });

  it("renders nothing when hidden", () => {
    expect(
      renderBlocks(blocksElement([], { hidden: true })),
    ).toBe("");
  });

  it("applies generic ElementStyle to the root", () => {
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

    expect(html).toContain("width:80%");

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

  it("emits nested visual indentation for children", () => {
    const html = renderBlocks(
      blocksElement([
        blockItem("outer", "outer", [
          blockItem("inner", "inner"),
        ]),
      ]),
    );

    expect(html).toContain("margin-inline-start:24px");
  });

  it("emits block border, padding, and pre-wrap structure", () => {
    const html = renderBlocks(
      blocksElement([
        blockItem("block-a", "value = 1"),
      ]),
    );

    expect(html).toContain("border:1px solid currentColor");

    expect(html).toContain("padding:8px 12px");

    expect(html).toContain("white-space:pre-wrap");

    expect(html).toContain("max-width:100%");
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