import { describe, expect, it } from "vitest";

import { PresentationSchema } from "@powershow/document-schema";

import {
  decodePresentationFromFirestore,
  encodePresentationForFirestore,
} from "../src";

function presentation() {
  return PresentationSchema.parse({
    schemaVersion: 1,
    id: "pres-1",
    title: "Topics",
    palette: { colors: [{ id: "accent", name: "Accent", value: "#ff0000" }] },
    slides: [{
      id: "slide-1",
      elements: [{
        id: "topics",
        type: "topics",
        kind: "unordered",
        items: [{
          id: "item-1",
          content: { id: "slot-1", children: [{
            id: "text-1",
            type: "text",
            content: {
              type: "rich-text",
              runs: [
                { text: "plain " },
                { text: "color", marks: { color: { kind: "palette", colorId: "accent" } } },
              ],
            },
          }] },
          children: [],
        }],
      }],
    }],
  });
}

describe("Firestore Presentation codec", () => {
  it("round-trips the canonical document without changing schemaVersion or palette refs", () => {
    const source = presentation();
    const record = encodePresentationForFirestore(source);

    expect(record).toEqual({ presentationJson: expect.any(String) });
    expect(decodePresentationFromFirestore(record)).toEqual(source);
    expect(JSON.parse(record.presentationJson)).toHaveProperty("schemaVersion", 1);
  });

  it("rejects malformed, missing, empty, legacy, and schema-invalid records", () => {
    expect(() => decodePresentationFromFirestore({ presentationJson: "{" })).toThrow();
    expect(() => decodePresentationFromFirestore({})).toThrow();
    expect(() => decodePresentationFromFirestore({ presentationJson: "" })).toThrow();
    expect(() => decodePresentationFromFirestore({ presentation: sourceValue() })).toThrow();
    expect(() => decodePresentationFromFirestore({ presentationJson: JSON.stringify({ schemaVersion: 2 }) })).toThrow();
  });

  it("omits undefined values before serializing", () => {
    const source = presentation();
    const record = encodePresentationForFirestore(source);

    expect(record.presentationJson).not.toContain("undefined");
  });
});

function sourceValue() {
  return presentation();
}
