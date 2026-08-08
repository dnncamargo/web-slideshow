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
