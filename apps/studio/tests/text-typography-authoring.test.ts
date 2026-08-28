import { describe, expect, it } from "vitest";

import {
  PresentationSchema,
  TextElementSchema,
} from "@powershow/document-schema";

import { resolveEffectiveTextTypographyForAuthoring } from "../src/features/editor/text-typography-authoring";

function presentation(typographyStyles?: unknown[]) {
  return PresentationSchema.parse({
    schemaVersion: 1,
    id: "presentation",
    title: "Presentation",
    slides: [{ id: "slide", elements: [] }],
    ...(typographyStyles === undefined ? {} : { typographyStyles }),
  });
}

function text(overrides: Record<string, unknown> = {}) {
  return TextElementSchema.parse({
    id: "text",
    type: "text",
    content: "Text",
    ...overrides,
  });
}

describe("effective text typography for authoring", () => {
  it("uses the Body baseline for a plain linked fundamental", () => {
    const resolved = resolveEffectiveTextTypographyForAuthoring(
      presentation(),
      text({ variant: "body" }),
    );

    expect(resolved.role).toBe("body");
    expect(resolved.typography).toMatchObject({
      fontSize: 18,
      fontWeight: 400,
      lineHeight: 1.6,
      fontStyle: "normal",
      textAlign: "left",
    });
    expect(resolved.typography).not.toHaveProperty("fontFamily");
  });

  it("lets a linked fundamental Presentation override win over the baseline", () => {
    const resolved = resolveEffectiveTextTypographyForAuthoring(
      presentation([
        { id: "body", typography: { fontFamily: "Inter", fontSize: "1.4rem" } },
      ]),
      text({ variant: "body" }),
    );

    expect(resolved).toMatchObject({
      role: "body",
      typography: {
        fontFamily: "Inter",
        fontSize: "1.4rem",
        fontWeight: 400,
        lineHeight: 1.6,
      },
    });
  });

  it("uses local typography for an independent fundamental without the Presentation override", () => {
    const resolved = resolveEffectiveTextTypographyForAuthoring(
      presentation([
        { id: "body", typography: { fontFamily: "Inter" } },
      ]),
      text({ variant: "body", typography: { fontFamily: "Fira Code" } }),
    );

    expect(resolved).toMatchObject({
      role: "body",
      typography: {
        fontFamily: "Fira Code",
        fontSize: 18,
        lineHeight: 1.6,
      },
    });
    expect(resolved.typography.fontFamily).not.toBe("Inter");
  });

  it("resolves a custom Style from its role baseline without inheriting its fundamental override", () => {
    const resolved = resolveEffectiveTextTypographyForAuthoring(
      presentation([
        { id: "body", typography: { fontFamily: "Inter" } },
        {
          id: "quote",
          name: "Quote",
          role: "body",
          typography: { fontStyle: "italic", fontSize: "1.4rem" },
        },
      ]),
      text({ variant: "quote" }),
    );

    expect(resolved).toMatchObject({
      role: "body",
      typography: {
        fontStyle: "italic",
        fontSize: "1.4rem",
        fontWeight: 400,
        lineHeight: 1.6,
      },
    });
    expect(resolved.typography).not.toHaveProperty("fontFamily");
  });

  it("uses a custom Style's Caption role baseline", () => {
    const resolved = resolveEffectiveTextTypographyForAuthoring(
      presentation([
        {
          id: "note",
          name: "Note",
          role: "caption",
          typography: { textAlign: "center" },
        },
      ]),
      text({ variant: "note" }),
    );

    expect(resolved).toMatchObject({
      role: "caption",
      typography: {
        fontSize: 14,
        fontWeight: 400,
        lineHeight: 1.45,
        textAlign: "center",
      },
    });
  });

  it("preserves element-only typography while adding the role baseline", () => {
    const resolved = resolveEffectiveTextTypographyForAuthoring(
      presentation([
        { id: "quote", name: "Quote", role: "body", typography: {} },
      ]),
      text({
        variant: "quote",
        typography: {
          textStroke: { width: 1, color: "#ffffff" },
          textDecorationColor: "#22d3ee",
        },
      }),
    );

    expect(resolved).toMatchObject({
      role: "body",
      typography: {
        fontSize: 18,
        lineHeight: 1.6,
        textStroke: { width: 1, color: "#ffffff" },
        textDecorationColor: "#22d3ee",
      },
    });
  });
});
