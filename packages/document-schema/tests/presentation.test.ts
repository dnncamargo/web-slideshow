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
  describe("valid presentations", () => {
    it("accepts the comprehensive PowerShow presentation", () => {
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
