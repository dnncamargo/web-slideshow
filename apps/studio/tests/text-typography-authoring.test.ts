import { describe, expect, it } from "vitest";

import {
  PresentationSchema,
  TextElementSchema,
} from "@powershow/document-schema";

import {
  detachTextStyle,
  resolveEffectiveTextStyleForAuthoring,
} from "../src/features/editor/text-typography-authoring";

function presentation(textStyles?: unknown[]) {
  return PresentationSchema.parse({
    schemaVersion: 1,
    id: "presentation",
    title: "Presentation",
    slides: [{ id: "slide", elements: [] }],
    ...(textStyles === undefined ? {} : { textStyles }),
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
    const resolved = resolveEffectiveTextStyleForAuthoring(
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
    const resolved = resolveEffectiveTextStyleForAuthoring(
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

  it("merges attached local overrides over the Presentation fundamental Style", () => {
    const resolved = resolveEffectiveTextStyleForAuthoring(
      presentation([
        { id: "body", typography: { fontFamily: "Inter", fontSize: "1.25rem", fontWeight: 500 } },
      ]),
      text({ variant: "body", typography: { fontSize: "1.375rem" } }),
    );

    expect(resolved).toMatchObject({
      role: "body",
      typography: {
        fontFamily: "Inter",
        fontSize: "1.375rem",
        fontWeight: 500,
        lineHeight: 1.6,
      },
    });
  });

  it("propagates Presentation fundamental Style changes while preserving attached local overrides", () => {
    const localText = text({ variant: "body", typography: { fontSize: 22 } });
    const presentationA = presentation([
      { id: "body", typography: { fontFamily: "Inter", fontSize: 18, fontWeight: 400 } },
    ]);
    const presentationB = presentation([
      { id: "body", typography: { fontFamily: "Roboto", fontSize: 20, fontWeight: 500 } },
    ]);

    expect(resolveEffectiveTextStyleForAuthoring(presentationA, localText).typography).toMatchObject({
      fontFamily: "Inter",
      fontSize: 22,
      fontWeight: 400,
    });
    expect(resolveEffectiveTextStyleForAuthoring(presentationB, localText).typography).toMatchObject({
      fontFamily: "Roboto",
      fontSize: 22,
      fontWeight: 500,
    });
  });

  it("does not apply the Presentation fundamental Style to a detached Text", () => {
    const resolved = resolveEffectiveTextStyleForAuthoring(
      presentation([
        { id: "body", typography: { fontFamily: "Inter", fontWeight: 500 } },
      ]),
      text({ variant: "body", styleDetached: true, typography: { fontSize: 22 } }),
    );

    expect(resolved).toMatchObject({
      role: "body",
      typography: {
        fontSize: 22,
        fontWeight: 400,
        lineHeight: 1.6,
      },
    });
    expect(resolved.typography).not.toHaveProperty("fontFamily");
  });

  it("resolves a custom Style from its role baseline without inheriting its fundamental override", () => {
    const resolved = resolveEffectiveTextStyleForAuthoring(
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
    const resolved = resolveEffectiveTextStyleForAuthoring(
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
    const resolved = resolveEffectiveTextStyleForAuthoring(
      presentation([
        { id: "quote", name: "Quote", role: "body" },
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

describe("detach text typography style", () => {
  it("materializes fundamental effective typography and keeps the variant", () => {
    const source = presentation([{ id: "body", typography: { fontFamily: "Inter", fontWeight: 500 } }]);
    const original = text({ variant: "body", typography: { fontSize: 22 } });
    const detached = detachTextStyle(source, original);

    expect(detached).toMatchObject({
      variant: "body",
      styleDetached: true,
      typography: { fontFamily: "Inter", fontSize: 22, fontWeight: 500, lineHeight: 1.6 },
    });
  });

  it("materializes the Theme baseline without inventing a font family", () => {
    const detached = detachTextStyle(presentation(), text({ variant: "body" }));

    expect(detached.typography).toMatchObject({ fontSize: 18, fontWeight: 400, lineHeight: 1.6 });
    expect(detached.typography).not.toHaveProperty("fontFamily");
  });

  it("preserves element-only typography and is idempotent", () => {
    const source = presentation([{ id: "body", typography: { fontFamily: "Inter" } }]);
    const original = text({
      variant: "body",
      typography: {
        fontSize: 22,
        textStroke: { width: 1, color: "#fff" },
        textDecorationColor: "#f00",
      },
    });
    const detached = detachTextStyle(source, original);

    expect(detached.typography).toMatchObject({
      textStroke: { width: 1, color: "#ffffff" },
      textDecorationColor: "#ff0000",
    });
    expect(detachTextStyle(presentation([{ id: "body", typography: { fontFamily: "Other" } }]), detached)).toBe(detached);
  });

  it("converts a custom style to its role and materializes custom typography", () => {
    const source = presentation([
      { id: "body", typography: { fontFamily: "Inter", fontWeight: 700 } },
      { id: "quote", name: "Quote", role: "body", typography: { fontFamily: "Fira Code", fontStyle: "italic" } },
    ]);
    const original = text({ variant: "quote", typography: { fontSize: 24 } });
    const detached = detachTextStyle(source, original);

    expect(detached).toMatchObject({
      variant: "body",
      styleDetached: true,
      typography: { fontFamily: "Fira Code", fontStyle: "italic", fontSize: 24, fontWeight: 400 },
    });
    expect(detached.typography).not.toHaveProperty("fontWeight", 700);
    expect(PresentationSchema.parse({ ...source, slides: [{ id: "slide", elements: [detached] }] })).toBeDefined();
    expect(PresentationSchema.parse({ ...source, textStyles: source.textStyles?.filter((style) => style.id !== "quote"), slides: [{ id: "slide", elements: [detached] }] })).toBeDefined();
  });

  it("does not mutate the source Text, Presentation, or Style definition", () => {
    const source = presentation([{ id: "quote", name: "Quote", role: "body", typography: { fontStyle: "italic" } }]);
    const original = text({ variant: "quote", typography: { fontSize: 24 } });
    const sourceSnapshot = structuredClone(source);
    const originalSnapshot = structuredClone(original);

    detachTextStyle(source, original);

    expect(source).toEqual(sourceSnapshot);
    expect(original).toEqual(originalSnapshot);
  });
});
