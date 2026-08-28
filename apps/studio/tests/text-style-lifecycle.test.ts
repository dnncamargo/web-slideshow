import { describe, expect, it } from "vitest";

import {
  PresentationSchema,
  TextElementSchema,
  resolveTextStyle,
} from "@powershow/document-schema";
import { renderPresentation } from "@powershow/renderer";

import {
  detachTextStyle,
  resolveEffectiveTextStyleForAuthoring,
} from "../src/features/editor/text-typography-authoring";

function text(overrides: Record<string, unknown> = {}) {
  return TextElementSchema.parse({
    id: "text",
    type: "text",
    content: "Typography lifecycle",
    ...overrides,
  });
}

function presentation(
  element: ReturnType<typeof text>,
  textStyles?: unknown[],
) {
  return PresentationSchema.parse({
    schemaVersion: 1,
    id: "presentation",
    title: "Typography lifecycle",
    slides: [{ id: "slide", elements: [element] }],
    ...(textStyles === undefined ? {} : { textStyles }),
  });
}

function firstText(presentationValue: ReturnType<typeof presentation>) {
  const element = presentationValue.slides[0]?.elements[0];
  if (!element || element.type !== "text") {
    throw new Error("Expected the fixture to contain one Text element.");
  }
  return element;
}

function jsonRoundTrip(presentationValue: ReturnType<typeof presentation>) {
  return PresentationSchema.parse(JSON.parse(JSON.stringify(presentationValue)));
}

describe("Text Style canonical lifecycle", () => {
  it("propagates attached fundamental changes, preserves local overrides, and detaches canonically", () => {
    const attachedText = text({
      variant: "body",
      typography: {
        fontSize: 22,
        textStroke: { width: 1, color: "#000000" },
        textDecorationColor: "#ff0000",
      },
    });
    const presentationA = presentation(attachedText, [
      { id: "body", typography: { fontFamily: "Inter", fontSize: 18, fontWeight: 400 } },
    ]);
    const presentationB = presentation(attachedText, [
      { id: "body", typography: { fontFamily: "Roboto", fontSize: 20, fontWeight: 500 } },
    ]);
    const beforeRender = structuredClone(presentationA);

    expect(resolveTextStyle(presentationA, attachedText).typography).toMatchObject({
      fontFamily: "Inter",
      fontSize: 22,
      fontWeight: 400,
    });
    expect(attachedText).not.toHaveProperty("styleDetached");
    expect(resolveTextStyle(presentationB, attachedText).typography).toMatchObject({
      fontFamily: "Roboto",
      fontSize: 22,
      fontWeight: 500,
    });

    const renderedA = renderPresentation(presentationA);
    const renderedB = renderPresentation(presentationB);
    expect(renderedA).toContain("font-family:&quot;Inter&quot;");
    expect(renderedA).toContain("font-size:22px");
    expect(renderedA).toContain("font-weight:400");
    expect(renderedB).toContain("font-family:&quot;Roboto&quot;");
    expect(renderedB).toContain("font-size:22px");
    expect(renderedB).toContain("font-weight:500");
    expect(attachedText).toEqual(firstText(presentationA));
    expect(presentationA).toEqual(beforeRender);

    const detachedText = detachTextStyle(presentationB, attachedText);
    expect(detachedText).toMatchObject({
      variant: "body",
      styleDetached: true,
      typography: {
        fontFamily: "Roboto",
        fontSize: 22,
        fontWeight: 500,
        textStroke: { width: 1, color: "#000000" },
        textDecorationColor: "#ff0000",
      },
    });
    expect(detachedText.typography).toHaveProperty("textStroke", { width: 1, color: "#000000" });

    const detachedPresentation = presentation(detachedText, presentationB.textStyles);
    const reloaded = jsonRoundTrip(detachedPresentation);
    const reloadedText = firstText(reloaded);
    expect(reloaded.schemaVersion).toBe(1);
    expect(reloadedText).toEqual(detachedText);
    expect(reloadedText.styleDetached).toBe(true);

    const detachedHtml = renderPresentation(reloaded);
    expect(detachedHtml).toContain("font-family:&quot;Roboto&quot;");
    expect(detachedHtml).toContain("font-size:22px");
    expect(detachedHtml).toContain("font-weight:500");

    const changedAfterDetach = PresentationSchema.parse({
      ...reloaded,
      textStyles: [{ id: "body", typography: { fontFamily: "Another Family", fontSize: 30, fontWeight: 700 } }],
    });
    const changedHtml = renderPresentation(changedAfterDetach);
    expect(changedHtml).toContain("font-family:&quot;Roboto&quot;");
    expect(changedHtml).toContain("font-size:22px");
    expect(changedHtml).toContain("font-weight:500");
    expect(changedHtml).not.toContain("font-family:&quot;Another Family&quot;");
    expect(changedHtml).not.toContain("font-size:30px");
    expect(changedHtml).not.toContain("font-weight:700");
  });

  it("detaches a custom Style to its fundamental role and remains valid after Style removal", () => {
    const source = presentation(
      text({ variant: "quote", typography: { fontSize: 24 } }),
      [
        { id: "body", typography: { fontFamily: "Inter", fontWeight: 700 } },
        {
          id: "quote",
          name: "Quote",
          role: "body",
          typography: { fontFamily: "Fira Code", fontStyle: "italic" },
        },
      ],
    );
    const original = firstText(source);
    const sourceSnapshot = structuredClone(source);

    expect(resolveEffectiveTextStyleForAuthoring(source, original).typography).toMatchObject({
      fontFamily: "Fira Code",
      fontStyle: "italic",
      fontSize: 24,
      fontWeight: 400,
    });
    expect(resolveEffectiveTextStyleForAuthoring(source, original).typography).not.toHaveProperty("fontFamily", "Inter");
    expect(resolveEffectiveTextStyleForAuthoring(source, original).typography).not.toHaveProperty("fontWeight", 700);
    expect(renderPresentation(source)).toContain("font-family:&quot;Fira Code&quot;");

    const detached = detachTextStyle(source, original);
    expect(detached).toMatchObject({
      variant: "body",
      styleDetached: true,
      typography: {
        fontFamily: "Fira Code",
        fontStyle: "italic",
        fontSize: 24,
        fontWeight: 400,
      },
    });
    expect(detached).not.toHaveProperty("variant", "quote");
    expect(source).toEqual(sourceSnapshot);
    expect(original).toEqual(firstText(source));

    const detachedPresentation = presentation(detached, source.textStyles);
    const withoutCustomStyle = PresentationSchema.parse({
      ...detachedPresentation,
      textStyles: detachedPresentation.textStyles?.filter((style) => style.id !== "quote"),
    });
    expect(withoutCustomStyle.textStyles).toEqual([
      { id: "body", typography: { fontFamily: "Inter", fontWeight: 700 } },
    ]);
    const detachedHtml = renderPresentation(withoutCustomStyle);
    expect(detachedHtml).toContain("font-family:&quot;Fira Code&quot;");
    expect(detachedHtml).toContain("font-style:italic");
    expect(detachedHtml).toContain("font-size:24px");
    expect(detachedHtml).toContain("font-weight:400");
    expect(renderPresentation(jsonRoundTrip(withoutCustomStyle))).toBe(detachedHtml);
  });

  it("keeps an absent authored family absent when the Theme baseline is materialized", () => {
    const detached = detachTextStyle(
      presentation(text({ variant: "body" })),
      text({ variant: "body" }),
    );

    expect(detached.styleDetached).toBe(true);
    expect(detached.typography).not.toHaveProperty("fontFamily");

    const reloaded = jsonRoundTrip(presentation(detached));
    expect(reloaded.schemaVersion).toBe(1);
    expect(firstText(reloaded).typography).not.toHaveProperty("fontFamily");
  });
});
