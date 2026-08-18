import { describe, expect, it } from "vitest";

import type { ResolvedWebFontFamily } from "../src/features/fonts/web-font-types";
import { chooseRecommendedFontFace } from "../src/features/fonts/web-font-face-selection";

function family(faces: ResolvedWebFontFamily["faces"]): ResolvedWebFontFamily {
  return {
    provider: "fontsource",
    id: "sample",
    family: "Sample Font",
    weights: [...new Set(faces.map((face) => face.weight))],
    styles: [...new Set(faces.map((face) => face.style))],
    subsets: [...new Set(faces.map((face) => face.subset ?? ""))],
    faces,
  };
}

function face(
  weight: number,
  style: "normal" | "italic",
  subset?: string,
): ResolvedWebFontFamily["faces"][number] {
  return {
    weight,
    style,
    ...(subset === undefined ? {} : { subset }),
    source: {
      type: "url",
      url: `https://cdn.example.com/fonts/${weight}-${style}-${subset ?? "default"}.woff2`,
      format: "woff2",
    },
  };
}

describe("chooseRecommendedFontFace", () => {
  it("prefers normal style even when italic appears first from the provider", () => {
    const result = chooseRecommendedFontFace(
      family([face(400, "italic", "latin"), face(400, "normal", "latin")]),
    );

    expect(result).toEqual({ weight: 400, style: "normal", subset: "latin" });
  });

  it("uses italic only when no normal face exists", () => {
    const result = chooseRecommendedFontFace(
      family([face(400, "italic", "latin")]),
    );

    expect(result).toEqual({ weight: 400, style: "italic", subset: "latin" });
  });

  it("prefers weight 400 when present", () => {
    const result = chooseRecommendedFontFace(
      family([face(300, "normal", "latin"), face(400, "normal", "latin")]),
    );

    expect(result?.weight).toBe(400);
  });

  it("chooses the nearest weight to 400 when 400 is absent", () => {
    const result = chooseRecommendedFontFace(
      family([face(300, "normal", "latin"), face(700, "normal", "latin")]),
    );

    expect(result?.weight).toBe(300);
  });

  it("breaks equal-distance ties by choosing the lower weight", () => {
    const result = chooseRecommendedFontFace(
      family([face(500, "normal", "latin"), face(300, "normal", "latin")]),
    );

    expect(result?.weight).toBe(300);
  });

  it("prefers the family default subset when it exists for the variant", () => {
    const result = chooseRecommendedFontFace(
      {
        ...family([
          face(400, "normal", "cyrillic"),
          face(400, "normal", "latin"),
        ]),
        defaultSubset: "cyrillic",
      },
    );

    expect(result?.subset).toBe("cyrillic");
  });

  it("ignores a declared default subset that is not available for the variant", () => {
    const result = chooseRecommendedFontFace(
      {
        ...family([face(400, "normal", "cyrillic")]),
        defaultSubset: "latin",
      },
    );

    expect(result?.subset).toBe("cyrillic");
  });

  it("falls back to latin when no default subset is declared", () => {
    const result = chooseRecommendedFontFace(
      family([face(400, "normal", "cyrillic"), face(400, "normal", "latin")]),
    );

    expect(result?.subset).toBe("latin");
  });

  it("uses a stable deterministic ordering for the final fallback subset", () => {
    const result = chooseRecommendedFontFace(
      family([face(400, "normal", "greek"), face(400, "normal", "cyrillic")]),
    );

    expect(result?.subset).toBe("cyrillic");
  });

  it("orders the fallback subset by code units, independent of the runtime locale", () => {
    // localeCompare could reorder these depending on the host locale; the
    // contract mandates plain lexical code-unit ordering ("Zz" < "aa").
    const result = chooseRecommendedFontFace(
      family([face(400, "normal", "aa"), face(400, "normal", "Zz")]),
    );

    expect(result?.subset).toBe("Zz");
  });

  it("always maps the recommendation to an existing face", () => {
    const faces = [
      face(300, "italic", "latin"),
      face(500, "normal", "cyrillic"),
      face(700, "italic", "cyrillic"),
    ];
    const sample = family(faces);

    const result = chooseRecommendedFontFace(sample);

    expect(result).toBeDefined();
    expect(
      faces.some(
        (existing) =>
          existing.weight === result?.weight &&
          existing.style === result?.style &&
          (existing.subset ?? "") === result?.subset,
      ),
    ).toBe(true);
  });

  it("respects preferred style and weight normally used by the Customize editor", () => {
    const sample = family([
      face(400, "normal", "latin"),
      face(400, "italic", "latin"),
      face(700, "normal", "latin"),
    ]);

    expect(
      chooseRecommendedFontFace(sample, { weight: 400, style: "italic" }),
    ).toEqual({ weight: 400, style: "italic", subset: "latin" });

    // Preferred weight that lacks the current style falls back to normal.
    expect(
      chooseRecommendedFontFace(sample, { weight: 700, style: "italic" }),
    ).toEqual({ weight: 700, style: "normal", subset: "latin" });
  });

  it("returns undefined for a family with no faces", () => {
    expect(chooseRecommendedFontFace(family([]))).toBeUndefined();
  });
});