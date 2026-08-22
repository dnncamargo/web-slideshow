import { describe, expect, it } from "vitest";

import {
  BlockItemSchema,
  BlocksElementSchema,
  CodeElementSchema,
  PowerShowElementSchema,
} from "../src/elements";

function blockItem(
  id: string,
  text: string,
  children: unknown[] = [],
) {
  return {
    id,
    text,
    children,
  };
}

function blocksElement(
  items: unknown[] = [],
  overrides: Record<string, unknown> = {},
) {
  return {
    id: "blocks-1",
    type: "blocks",
    items,
    hidden: false,
    ...overrides,
  };
}

describe("BlockItem schema", () => {
  it("parses a valid single BlockItem", () => {
    const result = BlockItemSchema.safeParse(
      blockItem("step-1", "set value"),
    );

    expect(result.success).toBe(true);

    if (result.success) {
      expect(result.data).toEqual({
        id: "step-1",
        text: "set value",
        children: [],
      });
    }
  });

  it("parses nested children recursively", () => {
    const result = BlockItemSchema.safeParse(
      blockItem("step-1", "outer", [
        blockItem("step-2", "inner"),
      ]),
    );

    expect(result.success).toBe(true);

    if (result.success) {
      expect(result.data.children).toHaveLength(1);

      expect(result.data.children[0]?.id).toBe("step-2");
    }
  });

  it("parses multiple nesting levels", () => {
    const result = BlockItemSchema.safeParse(
      blockItem("step-1", "root", [
        blockItem("step-2", "level-2", [
          blockItem("step-3", "level-3", [
            blockItem("step-4", "level-4"),
          ]),
        ]),
      ]),
    );

    expect(result.success).toBe(true);

    if (result.success) {
      expect(result.data.id).toBe("step-1");

      expect(result.data.children[0]?.id).toBe("step-2");

      expect(
        result.data.children[0]?.children[0]?.id,
      ).toBe("step-3");

      expect(
        result.data.children[0]?.children[0]
          ?.children[0]?.id,
      ).toBe("step-4");
    }
  });

  it("accepts empty children", () => {
    const result = BlockItemSchema.safeParse(
      blockItem("step-1", "leaf"),
    );

    expect(result.success).toBe(true);

    if (result.success) {
      expect(result.data.children).toEqual([]);
    }
  });

  it("accepts empty text", () => {
    const result = BlockItemSchema.safeParse(
      blockItem("step-1", ""),
    );

    expect(result.success).toBe(true);

    if (result.success) {
      expect(result.data.text).toBe("");
    }
  });

  it("preserves BlockItem ids", () => {
    const result = BlockItemSchema.safeParse(
      blockItem("stable-id", "text"),
    );

    expect(result.success).toBe(true);

    if (result.success) {
      expect(result.data.id).toBe("stable-id");
    }
  });

  it("preserves child order", () => {
    const result = BlockItemSchema.safeParse(
      blockItem("step-1", "parent", [
        blockItem("first", "a"),
        blockItem("second", "b"),
        blockItem("third", "c"),
      ]),
    );

    expect(result.success).toBe(true);

    if (result.success) {
      expect(
        result.data.children.map((child) => child.id),
      ).toEqual(["first", "second", "third"]);
    }
  });

  it("rejects an empty BlockItem id", () => {
    const result = BlockItemSchema.safeParse(
      blockItem("", "text"),
    );

    expect(result.success).toBe(false);
  });

  it("rejects a missing id", () => {
    const result = BlockItemSchema.safeParse({
      text: "text",
      children: [],
    });

    expect(result.success).toBe(false);
  });

  it("rejects a missing children field", () => {
    const result = BlockItemSchema.safeParse({
      id: "step-1",
      text: "text",
    });

    expect(result.success).toBe(false);
  });
});

describe("Blocks element schema", () => {
  it("parses a valid BlocksElement with a single root item", () => {
    const result = BlocksElementSchema.safeParse(
      blocksElement([
        blockItem("step-1", "set value"),
      ]),
    );

    expect(result.success).toBe(true);

    if (result.success) {
      expect(result.data.type).toBe("blocks");

      expect(result.data.items).toHaveLength(1);

      expect(result.data.items[0]?.text).toBe("set value");
    }
  });

  it("parses multiple root items and preserves their order", () => {
    const result = BlocksElementSchema.safeParse(
      blocksElement([
        blockItem("first", "a"),
        blockItem("second", "b"),
        blockItem("third", "c"),
      ]),
    );

    expect(result.success).toBe(true);

    if (result.success) {
      expect(
        result.data.items.map((item) => item.id),
      ).toEqual(["first", "second", "third"]);
    }
  });

  it("parses nested children", () => {
    const result = BlocksElementSchema.safeParse(
      blocksElement([
        blockItem("step-1", "outer", [
          blockItem("step-2", "inner"),
        ]),
      ]),
    );

    expect(result.success).toBe(true);

    if (result.success) {
      expect(result.data.items[0]?.children[0]?.id).toBe(
        "step-2",
      );
    }
  });

  it("accepts empty root items", () => {
    const result = BlocksElementSchema.safeParse(
      blocksElement([]),
    );

    expect(result.success).toBe(true);

    if (result.success) {
      expect(result.data.items).toEqual([]);
    }
  });

  it("accepts Blocks through PowerShowElementSchema", () => {
    const result = PowerShowElementSchema.safeParse(
      blocksElement([
        blockItem("step-1", "set value"),
      ]),
    );

    expect(result.success).toBe(true);

    if (result.success) {
      expect(result.data.type).toBe("blocks");
    }
  });

  it("does not preserve unknown provider/workspace/xml/script/config fields", () => {
    const result = BlocksElementSchema.safeParse(
      blocksElement([], {
        provider: "scratch",
        workspace: "ws-1",
        xml: '<block type="math_number"/>',
        script: "run();",
        config: { nested: true },
        blockly: { toolbox: "simplest" },
        language: "javascript",
        generatedCode: "run();",
      }),
    );

    expect(result.success).toBe(true);

    if (result.success) {
      expect(result.data).not.toHaveProperty("provider");

      expect(result.data).not.toHaveProperty("workspace");

      expect(result.data).not.toHaveProperty("xml");

      expect(result.data).not.toHaveProperty("script");

      expect(result.data).not.toHaveProperty("config");

      expect(result.data).not.toHaveProperty("blockly");

      expect(result.data).not.toHaveProperty("language");

      expect(result.data).not.toHaveProperty("generatedCode");
    }
  });

  it("does not preserve unknown fields on BlockItems", () => {
    const result = BlocksElementSchema.safeParse(
      blocksElement([
        {
          id: "step-1",
          text: "set value",
          children: [],
          style: { width: 100 },
          category: "logic",
          link: "https://example.com",
          events: ["click"],
        },
      ]),
    );

    expect(result.success).toBe(true);

    if (result.success) {
      const item = result.data.items[0];

      expect(item).not.toHaveProperty("style");

      expect(item).not.toHaveProperty("category");

      expect(item).not.toHaveProperty("link");

      expect(item).not.toHaveProperty("events");
    }
  });

  it("parsing does not invent items", () => {
    const result = BlocksElementSchema.safeParse(
      blocksElement([]),
    );

    expect(result.success).toBe(true);

    if (result.success) {
      expect(result.data.items).toEqual([]);
    }
  });

  it("does not parse BlockItems through PowerShowElementSchema", () => {
    const result = PowerShowElementSchema.safeParse(
      blockItem("step-1", "not an element"),
    );

    expect(result.success).toBe(false);
  });

  it("leaves existing CodeElement parsing unchanged", () => {
    const result = CodeElementSchema.safeParse({
      id: "code-1",
      type: "code",
      hidden: false,
      code: "const answer = 42;",
      language: "typescript",
      showLineNumbers: true,
      highlightedLines: [],
    });

    expect(result.success).toBe(true);

    if (result.success) {
      expect(result.data.type).toBe("code");

      expect(result.data.language).toBe("typescript");

      expect(result.data).not.toHaveProperty("items");

      expect(result.data).not.toHaveProperty("blocks");
    }
  });
});