import { describe, expect, it, vi } from "vitest";

import { PresentationSchema, type Presentation } from "@web-slideshow/document-schema";

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

function nullableTablePresentation() {
  return PresentationSchema.parse({
    schemaVersion: 1,
    id: "pres-nullable-table",
    title: "Nullable Table",
    slides: [{
      id: "slide-table",
      elements: [{
        id: "table-container",
        type: "container",
        children: [{
          id: "nullable-table",
          type: "table",
          columns: [
            { key: "label", label: "Label" },
            { key: "value", label: "Value" },
          ],
          rows: [
            { label: "first", value: "alpha" },
            { label: "middle", value: null },
            { label: "last", value: "omega" },
          ],
        }],
      }],
    }],
  });
}

function rootDefinitionPresentation(): Presentation {
  return PresentationSchema.parse({
    ...presentation(),
    id: "pres-root-definition",
    rootDefinitions: [{
      id: "master-foreign",
      name: "Shared master",
      root: {
        id: "master-root",
        type: "container",
        children: [{
          id: "master-content",
          type: "container",
          children: [{ id: "master-text", type: "text", content: "Shared" }],
        }],
      },
      localChildTargetIds: ["master-content"],
    }],
    defaultRootDefinitionId: "master-foreign",
    slides: [{
      id: "slide-root",
      rootDefinitionId: "master-foreign",
      elements: [],
      localRootChildren: [{
        targetContainerId: "master-content",
        children: [{ id: "local-text", type: "text", content: "Local" }],
      }],
    }],
  });
}

function payloadFormPresentation(form: "duplicated" | "referential"): Presentation {
  const slideCount = 6;
  const sharedRoot = {
    id: "shared-root",
    type: "container" as const,
    children: [{ id: "shared-text", type: "text" as const, content: "Repeated structural content" }],
  };

  return PresentationSchema.parse({
    ...presentation(),
    id: `pres-${form}`,
    rootDefinitions: form === "referential" ? [{
      id: "shared-master",
      name: "Shared master",
      root: sharedRoot,
    }] : undefined,
    defaultRootDefinitionId: form === "referential" ? "shared-master" : undefined,
    slides: Array.from({ length: slideCount }, (_, index) => ({
      id: `slide-${form}-${index + 1}`,
      ...(form === "referential"
        ? { rootDefinitionId: "shared-master", elements: [] }
        : {
            elements: [{
              ...sharedRoot,
              id: `shared-root-${index + 1}`,
              children: [{
                id: `shared-text-${index + 1}`,
                type: "text" as const,
                content: "Repeated structural content",
              }],
            }],
          }),
    })),
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

  it("round-trips a referential Root Definition through the generic presentationJson codec", () => {
    const source = rootDefinitionPresentation();
    const record = encodePresentationForFirestore(source);
    const withoutRootDefinitions = PresentationSchema.parse({
      ...source,
      rootDefinitions: undefined,
      defaultRootDefinitionId: undefined,
      slides: [{ id: "slide-root", elements: [] }],
    });

    expect(Object.keys(record)).toEqual(["presentationJson"]);
    expect(decodePresentationFromFirestore(record)).toEqual(source);
    expect(JSON.parse(record.presentationJson)).toMatchObject({
      rootDefinitions: source.rootDefinitions,
      defaultRootDefinitionId: "master-foreign",
      slides: [{
        rootDefinitionId: "master-foreign",
        elements: [],
        localRootChildren: [{ targetContainerId: "master-content" }],
      }],
    });
    expect(new TextEncoder().encode(record.presentationJson).byteLength).toBeGreaterThan(0);
    expect(new TextEncoder().encode(record.presentationJson).byteLength).toBeGreaterThan(
      new TextEncoder().encode(
        encodePresentationForFirestore(withoutRootDefinitions).presentationJson,
      ).byteLength,
    );
  });

  it("shows referential Root Definition payload reduction without enforcing a savings threshold", () => {
    const duplicated = encodePresentationForFirestore(
      payloadFormPresentation("duplicated"),
    );
    const referential = encodePresentationForFirestore(
      payloadFormPresentation("referential"),
    );

    const duplicatedBytes = new TextEncoder().encode(duplicated.presentationJson).byteLength;
    const referentialBytes = new TextEncoder().encode(referential.presentationJson).byteLength;

    expect(referentialBytes).toBeLessThan(duplicatedBytes);
  });

  it("preserves nullable Table cells, positions, and omitted optional values", () => {
    const source = nullableTablePresentation();
    expect(PresentationSchema.safeParse(source).success).toBe(true);

    const record = encodePresentationForFirestore(source);
    const encoded = JSON.parse(record.presentationJson) as {
      slides: Array<{
        elements: Array<{
          children: Array<{
            rows: Array<Record<string, string | null>>;
          }>;
        }>;
      }>;
    };
    const rows = encoded.slides[0]?.elements[0]?.children[0]?.rows;

    expect(rows).toEqual([
      { label: "first", value: "alpha" },
      { label: "middle", value: null },
      { label: "last", value: "omega" },
    ]);
    expect(record.presentationJson).not.toContain("undefined");
    expect(decodePresentationFromFirestore(record)).toEqual(source);
  });
});

function sourceValue() {
  return presentation();
}
