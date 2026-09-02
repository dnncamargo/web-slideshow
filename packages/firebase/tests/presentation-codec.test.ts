import { describe, expect, it, vi } from "vitest";

import { PresentationSchema } from "@powershow/document-schema";

import {
  decodePresentationFromFirestore,
  encodePresentationForFirestore,
  MAX_PRESENTATION_SAFE_BYTES,
  PresentationTooLargeError,
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

function completeDeepPresentation() {
  return PresentationSchema.parse({
    schemaVersion: 1,
    id: "pres-deep",
    title: "Deep Rich Text",
    palette: {
      colors: [{ id: "accent", name: "Accent", value: "#ff0000" }],
    },
    slides: [{
      id: "slide-deep",
      elements: [{
        id: "root",
        type: "container",
        role: "main",
        style: {
          background: {
            pattern: { image: "radial-gradient(#444 1px, transparent 1px)" },
          },
        },
        layout: { children: { direction: "column", horizontalAlign: "center" } },
        children: [
          {
            id: "title-container",
            type: "container",
            role: "header",
            layout: { children: { direction: "column", horizontalAlign: "center" } },
            children: [{
              id: "title",
              type: "text",
              variant: "title",
              content: "Nested title",
            }],
          },
          { id: "divider", type: "divider" },
          {
            id: "content-container",
            type: "container",
            role: "content",
            layout: { children: { direction: "column", horizontalAlign: "center" } },
            children: [
              {
                id: "topics",
                type: "topics",
                kind: "unordered",
                items: [{
                  id: "topic",
                  content: {
                    id: "topic-slot",
                    children: [{
                      id: "topic-text",
                      type: "text",
                      content: {
                        type: "rich-text",
                        runs: [
                          { text: "Palette " },
                          { text: "word", marks: { color: { kind: "palette", colorId: "accent" } } },
                        ],
                      },
                    }],
                  },
                  children: [],
                }],
              },
              {
                id: "nested-container",
                type: "container",
                layout: { children: { horizontalAlign: "center" } },
                children: [{
                  id: "image",
                  type: "image",
                  src: "/centered.png",
                  alt: "Centered image",
                  fit: "contain",
                }],
              },
            ],
          },
        ],
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

  it("measures UTF-8 bytes and accepts the exact 800 KiB boundary", () => {
    const source = presentation();
    const shortTitle = PresentationSchema.parse({ ...source, title: "a" });
    const shortTitleBytes = new TextEncoder().encode(
      JSON.stringify(shortTitle),
    ).byteLength;
    const exact = PresentationSchema.parse({
      ...source,
      title: "x".repeat(MAX_PRESENTATION_SAFE_BYTES - shortTitleBytes + 1),
    });

    expect(
      new TextEncoder().encode(JSON.stringify(exact)).byteLength,
    ).toBe(MAX_PRESENTATION_SAFE_BYTES);
    expect(() => encodePresentationForFirestore(exact)).not.toThrow();

    const multibyte = PresentationSchema.parse({ ...source, title: "é" });
    expect(new TextEncoder().encode(JSON.stringify(multibyte)).byteLength)
      .toBeGreaterThan(JSON.stringify(multibyte).length);
  });

  it("rejects an over-budget payload and stringifies once per encode", () => {
    const source = PresentationSchema.parse({
      ...presentation(),
      title: "x".repeat(MAX_PRESENTATION_SAFE_BYTES),
    });
    const stringify = vi.spyOn(JSON, "stringify");

    expect(() => encodePresentationForFirestore(source)).toThrow(
      PresentationTooLargeError,
    );
    expect(stringify).toHaveBeenCalledTimes(1);
    stringify.mockRestore();
  });

  it("round-trips the complete deep RichText composition without flattening", () => {
    const source = completeDeepPresentation();
    const record = encodePresentationForFirestore(source);
    const decoded = decodePresentationFromFirestore(record);

    expect(new TextEncoder().encode(record.presentationJson).byteLength)
      .toBeLessThanOrEqual(MAX_PRESENTATION_SAFE_BYTES);
    expect(decoded).toEqual(source);
    expect(record).not.toHaveProperty("presentation");
    expect(record.presentationJson).toContain('"kind":"palette"');
  });
});

function sourceValue() {
  return presentation();
}
