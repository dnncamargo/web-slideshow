import { describe, expect, it } from "vitest";
import type {
  ContentSlot,
  PowerShowElement,
  Presentation,
  TopicItem,
  TopicsElement,
} from "@powershow/document-schema";
import { PresentationSchema } from "@powershow/document-schema";

import { presentationUsesFontFamily } from "../src/features/editor/font-resource-helpers";

function text(id: string, fontFamily: string): PowerShowElement {
  return {
    type: "text",
    id,
    hidden: false,
    variant: "body",
    content: id,
    typography: { fontFamily },
  };
}

function contentSlot(id: string, children: PowerShowElement[] = []): ContentSlot {
  return { id, children };
}

function fontContentSlot(
  id: string,
  fontFamily: string | undefined,
  children: PowerShowElement[] = [],
): ContentSlot {
  return {
    id,
    children,
    ...(fontFamily === undefined ? {} : { typography: { fontFamily } }),
  };
}

function topicItem(id: string, slot: ContentSlot, children: TopicItem[] = []): TopicItem {
  return { id, content: slot, children };
}

function topics(id: string, items: TopicItem[]): TopicsElement {
  return {
    type: "topics",
    id,
    hidden: false,
    kind: "unordered",
    items,
  };
}

function presentationWithElements(
  elements: PowerShowElement[],
  overrides: Partial<Presentation> = {},
): Presentation {
  return {
    schemaVersion: 1,
    id: "presentation",
    title: "Presentation",
    description: "",
    aspectRatio: "16:9",
    slides: [{ id: "slide", title: "", summary: "", speakerNotes: "", elements }],
    ...overrides,
  };
}

function container(id: string, typography?: { fontFamily: string }): PowerShowElement {
  return { type: "container", id, hidden: false, children: [], typography };
}

function code(id: string): PowerShowElement {
  return {
    type: "code",
    id,
    hidden: false,
    code: "const value = 1;",
    language: "typescript",
    showLineNumbers: true,
    highlightedLines: [],
    typography: { fontFamily: "Space Grotesk" },
  };
}

function terminal(id: string, titleTypography?: { fontFamily: string }): PowerShowElement {
  return {
    type: "terminal",
    id,
    hidden: false,
    lines: [],
    typography: { fontFamily: "Space Grotesk" },
    titleTypography,
  };
}

function simpleTable(id: string): PowerShowElement {
  return {
    type: "table",
    id,
    hidden: false,
    columns: [{ key: "value", label: "Value" }],
    rows: [{ value: "text" }],
    typography: { fontFamily: "Space Grotesk" },
  };
}

function structuredTable(
  header: ContentSlot,
  cell: ContentSlot,
): PowerShowElement {
  return {
    type: "table",
    id: "structured-table",
    hidden: false,
    mode: "structured",
    showHeader: true,
    columns: [{ id: "column", header }],
    rows: [{ id: "row", cells: [cell] }],
  };
}

describe("font resource traversal", () => {
  it("detects font families used inside Topics content slots", () => {
    const presentation: Presentation = {
      schemaVersion: 1,
      id: "presentation",
      title: "Presentation",
      description: "",
      aspectRatio: "16:9",
      slides: [
        {
          id: "slide",
          title: "",
          summary: "",
          speakerNotes: "",
          elements: [
            topics("topics", [
              topicItem("item", contentSlot("slot", [text("text", "Space Grotesk")])),
            ]),
          ],
        },
      ],
    };

    expect(presentationUsesFontFamily(presentation, "Space Grotesk")).toBe(true);
    expect(presentationUsesFontFamily(presentation, "Inter")).toBe(false);
  });

  it.each([
    ["Text typography", text("text", "Space Grotesk")],
    ["Container typography", container("container", { fontFamily: "Space Grotesk" })],
    ["Topics typography", { ...topics("topics", []), typography: { fontFamily: "Space Grotesk" } }],
    ["Code typography", code("code")],
    ["Terminal body typography", terminal("terminal")],
    ["Terminal title typography", terminal("terminal-title", { fontFamily: "Space Grotesk" })],
    ["Table typography", simpleTable("table")],
  ] as const)("detects %s", (_label, element) => {
    const presentation = presentationWithElements([element]);
    expect(presentationUsesFontFamily(presentation, "Space Grotesk")).toBe(true);
  });

  it.each([
    ["Structured Table header slot", fontContentSlot("header", "Space Grotesk")],
    ["Structured Table cell slot", fontContentSlot("cell", "Space Grotesk")],
  ] as const)("detects %s typography without child elements", (_label, slot) => {
    const table = structuredTable(
      slot.id === "header" ? slot : fontContentSlot("header", undefined),
      slot.id === "cell" ? slot : fontContentSlot("cell", undefined),
    );
    expect(presentationUsesFontFamily(presentationWithElements([table]), "Space Grotesk")).toBe(true);
  });

  it("detects nested elements inside a Structured Table ContentSlot", () => {
    const table = structuredTable(
      fontContentSlot("header", undefined),
      fontContentSlot("cell", undefined, [text("nested-text", "Space Grotesk")]),
    );
    expect(presentationUsesFontFamily(presentationWithElements([table]), "Space Grotesk")).toBe(true);
  });

  it("detects direct and nested Topics ContentSlot typography", () => {
    const element = topics("topics", [
      topicItem("outer", fontContentSlot("outer", undefined), [
        topicItem("inner", fontContentSlot("inner", "Space Grotesk")),
      ]),
    ]);
    expect(presentationUsesFontFamily(presentationWithElements([element]), "Space Grotesk")).toBe(true);

    const direct = topics("direct-topics", [topicItem("item", fontContentSlot("slot", "Space Grotesk"))]);
    expect(presentationUsesFontFamily(presentationWithElements([direct]), "Space Grotesk")).toBe(true);
  });

  it("detects nested elements inside a Topics ContentSlot", () => {
    const element = topics("topics", [
      topicItem("item", fontContentSlot("slot", undefined, [text("nested-text", "Space Grotesk")]))
    ]);
    expect(presentationUsesFontFamily(presentationWithElements([element]), "Space Grotesk")).toBe(true);
  });

  it("detects TextStyle and LinkedContainerStyle typography", () => {
    const presentation = presentationWithElements([], {
      textStyles: [{ id: "body", typography: { fontFamily: "Space Grotesk" } }],
      linkedStyles: [{ id: "linked", name: "Linked", typography: { fontFamily: "Space Grotesk" } }],
    });
    expect(presentationUsesFontFamily(presentation, "Space Grotesk")).toBe(true);
  });

  it("does not treat the font resource itself as usage", () => {
    const presentation = presentationWithElements([], {
      resources: {
        fonts: [{ id: "space", family: "Space Grotesk", faces: [] }],
      },
    });
    expect(presentationUsesFontFamily(presentation, "Space Grotesk")).toBe(false);
  });

  it("matches only the requested family and ignores blank or unrelated properties", () => {
    const presentation = presentationWithElements([
      text("different", "Inter"),
      {
        type: "container",
        id: "blank",
        hidden: false,
        children: [],
        typography: { fontSize: "2rem" },
      },
    ], {
      linkedStyles: [{ id: "unrelated", name: "Unrelated", style: { color: "#fff" } }],
    });
    expect(presentationUsesFontFamily(presentation, "Space Grotesk")).toBe(false);
  });
});

describe("typography style font dependencies", () => {
  it("detects fundamental and custom style font families", () => {
    const presentation = PresentationSchema.parse({ schemaVersion: 1, id: "p", title: "P", textStyles: [
      { id: "body", typography: { fontFamily: " Inter " } },
      { id: "quote", name: "Quote", role: "body", typography: { fontFamily: "Fira Code" } },
    ], slides: [{ id: "s", title: "", elements: [] }] });
    expect(presentationUsesFontFamily(presentation, "inter")).toBe(true);
    expect(presentationUsesFontFamily(presentation, "fira code")).toBe(true);
    expect(presentationUsesFontFamily(presentation, "Roboto")).toBe(false);
  });
});
