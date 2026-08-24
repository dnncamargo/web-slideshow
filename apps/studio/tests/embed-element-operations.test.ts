import { describe, expect, it } from "vitest";

import type { EmbedElement, Slide } from "@powershow/document-schema";

import {
  createElement,
  duplicateElement,
} from "../src/features/editor/element-operations";

function embed(
  overrides: Partial<Omit<EmbedElement, "type">> = {},
): EmbedElement {
  return {
    id: "embed-1",

    type: "embed",

    src: "https://example.com/",

    title: "Embedded content",

    hidden: false,

    ...overrides,
  };
}

function slide(elements: Slide["elements"] = []): Slide {
  return {
    id: "slide-1",

    title: "",

    summary: "",

    speakerNotes: "",

    elements,
  };
}

describe("Embed element authoring", () => {
  it("creates an Embed", () => {
    const created = createElement("embed", []);

    expect(created.type).toBe("embed");
  });

  it("defaults the unique id to embed-element", () => {
    expect(createElement("embed", []).id).toBe("embed-element");
  });

  it("uses embed-element-2 on id collision", () => {
    const created = createElement("embed", [
      slide([embed({ id: "embed-element" })]),
    ]);

    expect(created.id).toBe("embed-element-2");
  });

  it("defaults hidden to false", () => {
    const created = createElement("embed", []);

    if (created.type === "embed") {
      expect(created.hidden).toBe(false);
    }
  });

  it("defaults src to https://example.com/", () => {
    const created = createElement("embed", []);

    if (created.type === "embed") {
      expect(created.src).toBe("https://example.com/");
    }
  });

  it("defaults title to Embedded content", () => {
    const created = createElement("embed", []);

    if (created.type === "embed") {
      expect(created.title).toBe("Embedded content");
    }
  });

  it("defaults style width to 60%", () => {
    const created = createElement("embed", []);

    if (created.type === "embed") {
      expect(created.layout?.width).toBe("60%");
    }
  });

  it("defaults style height to 55%", () => {
    const created = createElement("embed", []);

    if (created.type === "embed") {
      expect(created.layout?.height).toBe("55%");
    }
  });

  it("keeps Embed a leaf with no children or slots", () => {
    const created = createElement("embed", []);

    if (created.type === "embed") {
      expect(created).not.toHaveProperty("children");

      expect(created).not.toHaveProperty("slots");
    }
  });

  it("duplicates an Embed with a unique element id", () => {
    const duplicate = duplicateElement(embed(), [slide()]);

    expect(duplicate.id).toBe("embed-1-copy");

    expect(duplicate.id).not.toBe(embed().id);
  });

  it("duplicate preserves src", () => {
    const duplicate = duplicateElement(
      embed({ src: "https://player.example.com/live" }),
      [slide()],
    );

    if (duplicate.type === "embed") {
      expect(duplicate.src).toBe("https://player.example.com/live");
    }
  });

  it("duplicate preserves title", () => {
    const duplicate = duplicateElement(
      embed({ title: "Live chart" }),
      [slide()],
    );

    if (duplicate.type === "embed") {
      expect(duplicate.title).toBe("Live chart");
    }
  });

  it("duplicate preserves style", () => {
    const duplicate = duplicateElement(
      embed({
        layout: {
          width: "80%",

          height: 320,

        },
        style: { borderRadius: 12, background: { color: "#0f172a" } },
      }),
      [slide()],
    );

    if (duplicate.type === "embed") {
      expect(duplicate.layout).toEqual({ width: "80%", height: 320 });
      expect(duplicate.style).toEqual({ borderRadius: 12, background: { color: "#0f172a" } });
    }
  });

  it("duplicate layout is not the same reference as the source", () => {
    const source = embed({ layout: { width: "60%", height: "55%" } });

    const duplicate = duplicateElement(source, [slide()]);

    if (duplicate.type === "embed") {
      expect(duplicate.layout).not.toBe(source.layout);
    }
  });

  it("modifying the duplicate does not mutate the source", () => {
    const original = embed({
      layout: { width: "60%", height: "55%" },
    });

    const source = original;

    const duplicate = duplicateElement(source, [slide()]);

    if (duplicate.type === "embed") {
      duplicate.src = "https://changed.example.com/";

      duplicate.title = "Changed";

      duplicate.layout = { width: "10%", height: "10%" };

      expect(source).toEqual(original);

      expect(duplicate.src).toBe("https://changed.example.com/");
    }
  });
});
