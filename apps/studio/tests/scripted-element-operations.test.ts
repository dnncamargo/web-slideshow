import { describe, expect, it } from "vitest";

import type { ScriptedElement, Slide } from "@powershow/document-schema";

import type { ElementCreateType } from "../src/features/editor/element-operations";
import {
  createElement,
  duplicateElement,
  removeElementById,
} from "../src/features/editor/element-operations";

function scripted(
  overrides: Partial<Omit<ScriptedElement, "type">> = {},
): ScriptedElement {
  return {
    id: "scripted-1",

    type: "scripted",

    title: "Scripted content",

    html: "",

    css: "",

    script: "",

    hidden: false,

    ...overrides,

    ports: overrides.ports ?? [],
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

describe("Scripted element authoring", () => {
  it("exposes scripted as an ElementCreateType", () => {
    const createType: ElementCreateType = "scripted";

    expect(createType).toBe("scripted");
  });

  it("creates a Scripted element", () => {
    const created = createElement("scripted", []);

    expect(created.type).toBe("scripted");
  });

  it("defaults the unique id to scripted-element", () => {
    expect(createElement("scripted", []).id).toBe("scripted-element");
  });

  it("uses scripted-element-2 on id collision", () => {
    const created = createElement("scripted", [
      slide([scripted({ id: "scripted-element" })]),
    ]);

    expect(created.id).toBe("scripted-element-2");
  });

  it("defaults hidden to false", () => {
    const created = createElement("scripted", []);

    if (created.type === "scripted") {
      expect(created.hidden).toBe(false);
    }
  });

  it("defaults title to Scripted content", () => {
    const created = createElement("scripted", []);

    if (created.type === "scripted") {
      expect(created.title).toBe("Scripted content");
    }
  });

  it("defaults html to an empty string", () => {
    const created = createElement("scripted", []);

    if (created.type === "scripted") {
      expect(created.html).toBe("");
    }
  });

  it("defaults css to an empty string", () => {
    const created = createElement("scripted", []);

    if (created.type === "scripted") {
      expect(created.css).toBe("");
    }
  });

  it("defaults script to an empty string", () => {
    const created = createElement("scripted", []);

    if (created.type === "scripted") {
      expect(created.script).toBe("");
    }
  });

  it("defaults ports to an empty array", () => {
    const created = createElement("scripted", []);

    if (created.type === "scripted") {
      expect(created.ports).toEqual([]);
    }
  });

  it("defaults style width to 60%", () => {
    const created = createElement("scripted", []);

    if (created.type === "scripted") {
      expect(created.layout?.width).toBe("60%");
    }
  });

  it("defaults style height to 55%", () => {
    const created = createElement("scripted", []);

    if (created.type === "scripted") {
      expect(created.layout?.height).toBe("55%");
    }
  });

  it("keeps Scripted a leaf with no children or slots", () => {
    const created = createElement("scripted", []);

    if (created.type === "scripted") {
      expect(created).not.toHaveProperty("children");

      expect(created).not.toHaveProperty("slots");
    }
  });

  it("duplicates a Scripted element with a unique element id", () => {
    const duplicate = duplicateElement(scripted(), [slide()]);

    expect(duplicate.id).toBe("scripted-1-copy");

    expect(duplicate.id).not.toBe(scripted().id);
  });

  it("duplicate preserves title, html, css and script", () => {
    const duplicate = duplicateElement(
      scripted({
        title: "Plot demo",

        html: "<canvas id=\"plot\"></canvas>",

        css: "#plot { width: 100%; height: 100%; }",

        script: "console.log('ready');",
      }),
      [slide()],
    );

    if (duplicate.type === "scripted") {
      expect(duplicate.title).toBe("Plot demo");

      expect(duplicate.html).toBe("<canvas id=\"plot\"></canvas>");

      expect(duplicate.css).toBe("#plot { width: 100%; height: 100%; }");

      expect(duplicate.script).toBe("console.log('ready');");
    }
  });

  it("duplicate preserves style and does not share the reference", () => {
    const source = scripted({ layout: { width: "60%", height: "55%" } });

    const duplicate = duplicateElement(source, [slide()]);

    if (duplicate.type === "scripted") {
      expect(duplicate.layout).toEqual({ width: "60%", height: "55%" });

      expect(duplicate.layout).not.toBe(source.layout);
    }
  });

  it("delete works through generic removeElementById", () => {
    const other = scripted({ id: "kept-element" });

    const next = removeElementById(
      [scripted({ id: "to-delete" }), other],
      "to-delete",
    );

    expect(next).toHaveLength(1);

    expect(next[0]?.id).toBe("kept-element");
  });

  it("delete of a missing id leaves the elements unchanged", () => {
    const elements = [scripted({ id: "scripted-1" })];

    const next = removeElementById(elements, "missing");

    expect(next).toBe(elements);
  });
});
