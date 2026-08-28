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
});

describe("typography style font dependencies", () => {
  it("detects fundamental and custom style font families", () => {
    const presentation = PresentationSchema.parse({ schemaVersion: 1, id: "p", title: "P", typographyStyles: [
      { id: "body", typography: { fontFamily: " Inter " } },
      { id: "quote", name: "Quote", role: "body", typography: { fontFamily: "Fira Code" } },
    ], slides: [{ id: "s", title: "", elements: [] }] });
    expect(presentationUsesFontFamily(presentation, "inter")).toBe(true);
    expect(presentationUsesFontFamily(presentation, "fira code")).toBe(true);
    expect(presentationUsesFontFamily(presentation, "Roboto")).toBe(false);
  });
});
