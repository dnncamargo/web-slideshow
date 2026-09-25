import { describe, expect, it } from "vitest";
import type {
  ContentSlot,
  PresentationElement,
  Presentation,
  TopicItem,
  TopicsElement,
} from "@web-slideshow/document-schema";
import { PresentationSchema } from "@web-slideshow/document-schema";

import { presentationUsesFontFamily } from "../src/features/editor/font-resource-helpers";

function text(id: string, fontFamily: string): PresentationElement {
  return {
    type: "text",
    id,
    hidden: false,
    variant: "body",
    content: id,
    typography: { fontFamily },
  };
}

function contentSlot(id: string, children: PresentationElement[] = []): ContentSlot {
  return { id, children };
}

function fontContentSlot(
  id: string,
  fontFamily: string | undefined,
  children: PresentationElement[] = [],
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
  elements: PresentationElement[],
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

function container(id: string, typography?: { fontFamily: string }): PresentationElement {
  return { type: "container", id, hidden: false, children: [], typography };
}

function code(id: string): PresentationElement {
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

function terminal(id: string, titleTypography?: { fontFamily: string }): PresentationElement {
  return {
    type: "terminal",
    id,
    hidden: false,
    lines: [],
    typography: { fontFamily: "Space Grotesk" },
    titleTypography,
  };
}

function simpleTable(id: string): PresentationElement {
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
): PresentationElement {
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

  it.each([
    ["Code Linked Style", { target: "code", id: "code", name: "Code", typography: { fontFamily: "Space Grotesk" } }],
    ["Terminal Linked Style body", { target: "terminal", id: "terminal", name: "Terminal", typography: { fontFamily: "Space Grotesk" } }],
    ["Terminal Linked Style title", { target: "terminal", id: "terminal", name: "Terminal", titleTypography: { fontFamily: "Space Grotesk" } }],
    ["Simple Table Linked Style", { target: "table", mode: "simple", id: "table", name: "Table", typography: { fontFamily: "Space Grotesk" } }],
  ] as const)("detects %s font usage", (_label, linkedStyle) => {
    const presentation = presentationWithElements([], { linkedStyles: [linkedStyle] });
    expect(presentationUsesFontFamily(presentation, "Space Grotesk")).toBe(true);
    expect(presentationUsesFontFamily(presentation, "Inter")).toBe(false);
  });

  it.each([
    ["Root Definition", {
      id: "root-text", type: "text", hidden: false, variant: "body", content: "Root", typography: { fontFamily: "Space Grotesk" },
    }],
    ["local Root child", {
      id: "local-text", type: "text", hidden: false, variant: "body", content: "Local", typography: { fontFamily: "Space Grotesk" },
    }],
  ] as const)("detects a font used only by a %s", (_label, usedElement) => {
    const presentation = PresentationSchema.parse({
      ...presentationWithElements([], {
        rootDefinitions: [{
          id: "root-definition",
          name: "Root Definition",
          localChildTargetIds: ["root-container"],
          root: {
            id: "root-container",
            type: "container",
            hidden: false,
            children: _label === "Root Definition" ? [usedElement] : [],
          },
        }],
        defaultRootDefinitionId: "root-definition",
      }),
      slides: [{
        id: "slide",
        title: "",
        summary: "",
        speakerNotes: "",
        elements: [],
        rootDefinitionId: "root-definition",
        ...(_label === "local Root child" ? {
          localRootChildren: [{ targetContainerId: "root-container", children: [usedElement] }],
        } : {}),
      }],
    });

    expect(presentationUsesFontFamily(presentation, "Space Grotesk")).toBe(true);
    expect(presentationUsesFontFamily(presentation, "Inter")).toBe(false);
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
