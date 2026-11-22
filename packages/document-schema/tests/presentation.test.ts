import {
  describe,
  expect,
  it,
} from "vitest";

import {
  PresentationSchema,
} from "../src";

import {
  invalidPresentationFixtures,
} from "./fixtures/invalid-presentation";

import {
  defaultsInput,
  expectedDefaultsOutput,
  validElementFixtures,
  validStructureFixtures,
  validStyleFixtures,
} from "./fixtures/schema-fixtures";

import {
  validPresentation,
} from "./fixtures/valid-presentation";

describe("PresentationSchema", () => {
  it("round-trips Math source and authored properties without changing schemaVersion", () => {
    const source = String.raw`\begin{aligned}x^2&=4\\x&=2\end{aligned}`;
    const input = {
      schemaVersion: 1 as const, id: "math-roundtrip", title: "Math", palette: { colors: [{ id: "accent", name: "Accent", value: "#123456" }] },
      slides: [{ id: "slide", elements: [{ id: "math", type: "math", format: "latex", source, hidden: false,
        layout: { width: 400, margin: 8 }, style: { color: { kind: "palette", colorId: "accent" }, background: { color: "#ffffff" }, borderRadius: 4 },
        typography: { fontSize: 24, textAlign: "center", lineHeight: 1.2 }, effect: { opacity: 0.8 }, link: { kind: "url", href: "https://example.com" } }] }],
    };
    const parsed = PresentationSchema.parse(input);
    const json = JSON.stringify(parsed);
    const restored = PresentationSchema.parse(JSON.parse(json));
    expect(restored.schemaVersion).toBe(1);
    expect(restored.slides[0]?.elements[0]).toMatchObject(input.slides[0]!.elements[0]!);
  });
  describe("valid presentations", () => {
    it("accepts the comprehensive presentation", () => {
      const result =
        PresentationSchema.safeParse(
          validPresentation,
        );

      expect(result.success).toBe(true);
    });

    it("keeps presentation resources optional for existing documents", () => {
      const result = PresentationSchema.parse(defaultsInput);

      expect(result).not.toHaveProperty("resources");
      expect(result).not.toHaveProperty("palette");
    });

    it("accepts a presentation color palette", () => {
      expect(
        PresentationSchema.safeParse({
          ...defaultsInput,
          palette: {
            colors: [
              {
                id: "accent",
                name: "Accent",
                value: "#7c3aed",
              },
              {
                id: "accent-transparent",
                name: "Accent Transparent",
                value: "rgba(124, 58, 237, 0.5)",
              },
            ],
          },
        }).success,
      ).toBe(true);
    });

    it("rejects unsupported palette colors", () => {
      expect(
        PresentationSchema.safeParse({
          ...defaultsInput,
          palette: {
            colors: [
              {
                id: "accent",
                name: "Accent",
                value: "hsl(260, 83%, 58%)",
              },
            ],
          },
        }).success,
      ).toBe(false);
    });

    it("accepts an empty presentation font registry", () => {
      expect(
        PresentationSchema.safeParse({
          ...defaultsInput,
          resources: { fonts: [] },
        }).success,
      ).toBe(true);
    });

    it("accepts a presentation font resource", () => {
      expect(
        PresentationSchema.safeParse({
          ...defaultsInput,
          resources: {
            fonts: [
              {
                id: "inter",
                family: "Inter",
                source: {
                  type: "url",
                  url: "https://cdn.example.com/inter.woff2",
                  format: "woff2",
                },
              },
            ],
          },
        }).success,
      ).toBe(true);
    });

    it("accepts a generic file resource without changing schemaVersion", () => {
      const parsed = PresentationSchema.parse({
        ...defaultsInput,
        resources: {
          files: [{
            id: "file-notes",
            name: "Notes",
            kind: "text",
            representation: "text",
            contentType: "text/plain",
            source: { type: "text", content: "notes" },
          }],
        },
      });

      expect(parsed.schemaVersion).toBe(1);
      expect(parsed.resources?.files?.[0]?.source).toEqual({
        type: "text",
        content: "notes",
      });
    });

    it.each(
      validStructureFixtures,
    )("accepts $name", ({ input }) => {
      const result =
        PresentationSchema.safeParse(
          input,
        );

      expect(result.success).toBe(true);
    });

    it.each(
      validElementFixtures,
    )("accepts $name", ({ input }) => {
      const result =
        PresentationSchema.safeParse(
          input,
        );

      expect(result.success).toBe(true);
    });

    it.each(
      validStyleFixtures,
    )("accepts $name", ({ input }) => {
      const result =
        PresentationSchema.safeParse(
          input,
        );

      expect(result.success).toBe(true);
    });

    it("produces all Zod defaults when parsing minimal input", () => {
      const result =
        PresentationSchema.parse(
          defaultsInput,
        );

      expect(result).toEqual(
        expectedDefaultsOutput,
      );
    });
    
  });

  describe("invalid presentations", () => {
    it.each(
      invalidPresentationFixtures,
    )("rejects $name", ({ input }) => {
      const result =
        PresentationSchema.safeParse(
          input,
        );

      expect(result.success).toBe(false);
    });
  });
});
