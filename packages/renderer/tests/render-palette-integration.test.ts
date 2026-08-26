import { describe, expect, it } from "vitest";

import {
  PresentationSchema,
} from "@powershow/document-schema";

import {
  paletteColorCssVariableName,
  renderPresentation,
} from "../src";

describe("canonical palette color rendering", () => {
  it("renders references across canonical element and slide paint positions", () => {
    const reference = { kind: "palette" as const, colorId: "accent" };
    const presentation = PresentationSchema.parse({
      schemaVersion: 1,
      id: "palette-integration",
      title: "Palette integration",
      palette: {
        colors: [{ id: "accent", name: "Accent", value: "#facc15" }],
      },
      slides: [{
        id: "slide",
        background: {
          color: reference,
          gradient: { type: "linear", stops: [
            { color: reference, position: 0 },
            { color: "#123456", position: 100 },
          ] },
          pattern: { type: "grid", color: reference, backgroundColor: reference },
        },
        elements: [
          {
            id: "text",
            type: "text",
            content: { type: "rich-text", runs: [{ text: "Text", marks: { color: reference } }] },
            style: {
              color: reference,
              background: { color: reference },
              border: { width: 1, color: reference },
            },
            typography: { textDecorationColor: reference, textStroke: { width: 1, color: reference } },
            effect: { shadow: { x: 0, y: 1, blur: 2, color: reference } },
          },
          {
            id: "container",
            type: "container",
            children: [],
            style: { color: reference, background: { color: reference } },
          },
          {
            id: "topics",
            type: "topics",
            kind: "unordered",
            markerColor: reference,
            style: { color: reference },
            items: [{ id: "item", content: { id: "content", style: { color: reference, background: { color: reference } }, children: [] }, children: [] }],
          },
          {
            id: "blocks",
            type: "blocks",
            categories: [{ id: "statement", name: "Statement", color: reference }],
            items: [],
            effect: { shadow: { x: 0, y: 1, blur: 2, color: reference } },
          },
          {
            id: "table",
            type: "table",
            mode: "simple",
            columns: [{ key: "name", label: "Name" }],
            rows: [{ name: "PowerShow" }],
            style: {
              background: { gradient: { type: "linear", stops: [
                { color: reference, position: 0 },
                { color: "#123456", position: 100 },
              ] } },
            },
            effect: { shadow: { x: 0, y: 1, blur: 2, color: reference } },
          },
          {
            id: "divider",
            type: "divider",
            style: { background: { color: reference } },
          },
        ],
      }],
    });

    const html = renderPresentation(presentation);
    const variable = `var(${paletteColorCssVariableName("accent")})`;

    expect(html).toContain(variable);
    expect(html).toContain("#123456");
    expect(html).not.toContain("[object Object]");
    expect(html.split(variable).length - 1).toBeGreaterThanOrEqual(15);
  });
});
