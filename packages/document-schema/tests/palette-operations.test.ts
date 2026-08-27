import { describe, expect, it } from "vitest";

import {
  addPresentationPaletteColor,
  detachColorValue,
  linkColorToPalette,
  removePresentationPaletteColor,
  renamePresentationPaletteColor,
  updatePresentationPaletteColorValue,
} from "../src";
import { PresentationSchema } from "../src";
import { defaultsInput } from "./fixtures/schema-fixtures";

const reference = linkColorToPalette("accent");
const presentation = PresentationSchema.parse({
  ...defaultsInput,
  palette: {
    colors: [
      { id: "accent", name: "Accent", value: "#facc15" },
      { id: "other", name: "Other", value: "#ffffff" },
    ],
  },
  slides: [{
    id: "slide",
    elements: [{
      id: "text",
      type: "text",
      content: "Text",
      style: {
        color: reference,
        border: { width: 1, color: reference },
        background: { gradient: { type: "linear", stops: [
          { color: reference, position: 0 },
          { color: linkColorToPalette("other"), position: 100 },
        ] } },
      },
    }, {
      id: "interactive",
      type: "interactive",
      widget: "function-plot",
      config: { payload: reference },
    }, {
      id: "scripted",
      type: "scripted",
      title: "Script",
      html: JSON.stringify(reference),
    }],
  }],
});

describe("presentation palette authoring operations", () => {
  it("updates values by id without rewriting references", () => {
    const result = updatePresentationPaletteColorValue(presentation, "accent", " #EF4444 ");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.presentation.palette?.colors[0]).toEqual({ id: "accent", name: "Accent", value: "#ef4444" });
    expect((result.presentation.slides[0]?.elements[0] as { style?: { color?: unknown } }).style?.color).toEqual(reference);
    expect(presentation.palette?.colors[0]?.value).toBe("#facc15");
  });

  it("renames by id and permits duplicate names", () => {
    const result = renamePresentationPaletteColor(presentation, "accent", " Other ");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.presentation.palette?.colors.map((color) => color.name)).toEqual(["Other", "Other"]);
    expect(result.presentation.palette?.colors[0]?.id).toBe("accent");
  });

  it("adds a local palette, suffixes collisions, and permits duplicate values", () => {
    const empty = PresentationSchema.parse({ ...defaultsInput, slides: [] });
    const first = addPresentationPaletteColor(empty, " Accent ", "#fff");
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    const second = addPresentationPaletteColor(first.presentation, "Accent", "#ffffff");
    expect(second.ok).toBe(true);
    if (!second.ok) return;
    expect(second.presentation.palette?.colors).toEqual([
      { id: "accent", name: "Accent", value: "#ffffff" },
      { id: "accent-2", name: "Accent", value: "#ffffff" },
    ]);
  });

  it("links and detaches literals or current palette values explicitly", () => {
    expect(detachColorValue("#fff", presentation.palette)).toBe("#fff");
    expect(detachColorValue(reference, presentation.palette)).toBe("#facc15");
    expect(detachColorValue(linkColorToPalette("missing"), presentation.palette)).toBeUndefined();
  });

  it("removes by id while detaching every canonical reference and ignoring opaque payloads", () => {
    const result = removePresentationPaletteColor(presentation, "accent");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.detachedCount).toBe(3);
    expect(result.presentation.palette?.colors).toEqual([
      { id: "other", name: "Other", value: "#ffffff" },
    ]);
    const text = result.presentation.slides[0]?.elements[0] as { style?: { color?: unknown; border?: { color?: unknown }; background?: { gradient?: { stops: Array<{ color: unknown }> } } } };
    expect(text.style?.color).toBe("#facc15");
    expect(text.style?.border?.color).toBe("#facc15");
    expect(text.style?.background?.gradient?.stops[0]?.color).toBe("#facc15");
    expect((result.presentation.slides[0]?.elements[1] as unknown as { config: { payload: unknown } }).config.payload).toEqual(reference);
    expect(PresentationSchema.safeParse(result.presentation).success).toBe(true);
  });

  it("fails explicitly for missing ids and invalid colors", () => {
    expect(removePresentationPaletteColor(presentation, "missing")).toEqual({ ok: false, reason: "color-not-found" });
    expect(updatePresentationPaletteColorValue(presentation, "accent", "not-a-color")).toEqual({ ok: false, reason: "invalid-color" });
  });
});
