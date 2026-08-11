import { describe, expect, it } from "vitest";

import type {
  FontFaceResource,
  FontResource,
} from "@powershow/document-schema";

import { renderFontResources } from "../src/render-font-resources";

function createFace(
  weight: number,
  overrides: Partial<FontFaceResource> = {},
): FontFaceResource {
  return {
    weight,
    style: "normal",
    subset: "latin",
    source: {
      type: "url",
      url: `https://cdn.example.com/inter-${weight}.woff2`,
      format: "woff2",
    },
    ...overrides,
  };
}

function createLegacyFontResource(
  overrides: Partial<FontResource> = {},
): FontResource {
  return {
    id: "inter",
    family: "Inter",
    source: {
      type: "url",
      url: "https://cdn.example.com/inter.woff2",
      format: "woff2",
    },
    ...overrides,
  };
}

function createFacesFontResource(
  faces: FontFaceResource[],
  overrides: Partial<FontResource> = {},
): FontResource {
  return {
    id: "inter",
    family: "Inter",
    faces,
    ...overrides,
  };
}

function countOccurrences(value: string, search: string): number {
  return value.split(search).length - 1;
}

describe("renderFontResources", () => {
  it("renders one face as one font-face declaration", () => {
    const css = renderFontResources([
      createFacesFontResource([createFace(400)]),
    ]);

    expect(countOccurrences(css, "@font-face")).toBe(1);
    expect(css).toContain('font-family:"Inter"');
    expect(css).toContain('format("woff2")');
    expect(css).toContain("font-weight:400");
    expect(css).toContain("font-style:normal");
    expect(css).toContain("font-display:swap");
  });

  it("renders three faces in document order", () => {
    const css = renderFontResources([
      createFacesFontResource([
        createFace(400),
        createFace(700),
        createFace(400, {
          style: "italic",
          source: {
            type: "url",
            url: "https://cdn.example.com/inter-400-italic.woff2",
            format: "woff2",
          },
        }),
      ]),
    ]);

    expect(countOccurrences(css, "@font-face")).toBe(3);
    expect(css.indexOf("inter-400.woff2")).toBeLessThan(
      css.indexOf("inter-700.woff2"),
    );
    expect(css.indexOf("inter-700.woff2")).toBeLessThan(
      css.indexOf("inter-400-italic.woff2"),
    );
  });

  it("renders optional unicode range without quoting it", () => {
    const css = renderFontResources([
      createFacesFontResource([
        createFace(400, {
          unicodeRange: "U+0000-00FF, U+0131",
        }),
      ]),
    ]);

    expect(css).toContain("unicode-range:U+0000-00FF, U+0131");
    expect(css).not.toContain('unicode-range:"');
  });

  it("keeps a legacy Round 1 source as one unspecified face", () => {
    const css = renderFontResources([createLegacyFontResource()]);

    expect(countOccurrences(css, "@font-face")).toBe(1);
    expect(css).toBe(
      '@font-face{font-family:"Inter";' +
        'src:url("https://cdn.example.com/inter.woff2") format("woff2");' +
        "font-display:swap}",
    );
    expect(css).not.toContain("font-weight");
    expect(css).not.toContain("font-style");
  });

  it("does not duplicate structurally identical faces", () => {
    const duplicate = createFace(400);
    const css = renderFontResources([
      createFacesFontResource([
        duplicate,
        { ...duplicate },
        createFace(700),
      ]),
    ]);

    expect(countOccurrences(css, "@font-face")).toBe(2);
    expect(countOccurrences(css, "font-weight:400")).toBe(1);
    expect(countOccurrences(css, "font-weight:700")).toBe(1);
  });

  it("allows faces with different weight, style, subset, or URL", () => {
    const baseFace = createFace(400);
    const css = renderFontResources([
      createFacesFontResource([
        baseFace,
        { ...baseFace, weight: 700 },
        { ...baseFace, style: "italic" },
        { ...baseFace, subset: "latin-ext" },
        {
          ...baseFace,
          source: {
            ...baseFace.source,
            url: "https://cdn.example.com/other.woff2",
          },
        },
      ]),
    ]);

    expect(countOccurrences(css, "@font-face")).toBe(5);
  });

  it("omits unavailable descriptors and format", () => {
    const css = renderFontResources([
      createFacesFontResource([
        {
          source: {
            type: "url",
            url: "https://cdn.example.com/font",
          },
        },
      ]),
    ]);

    expect(css).toContain('src:url("https://cdn.example.com/font");');
    expect(css).not.toContain("format(");
    expect(css).not.toContain("font-weight");
    expect(css).not.toContain("font-style");
    expect(css).not.toContain("unicode-range");
  });

  it("preserves escaping for family, URL, and unicode range", () => {
    const css = renderFontResources([
      createFacesFontResource(
        [
          createFace(400, {
            unicodeRange: "U+0000-00FF;</style>",
            source: {
              type: "url",
              url: 'https://cdn.example.com/font")}.woff2?<tag>',
              format: "woff2",
            },
          }),
        ],
        { family: 'Unsafe"</style>' },
      ),
    ]);

    expect(css).not.toContain("</style>");
    expect(css).not.toContain('font-family:"Unsafe"');
    expect(css).toContain("\\22 ");
    expect(css).toContain("\\3c ");
    expect(css).toContain("\\3e ");
    expect(css).toContain("\\3b ");
  });

  it("renders no CSS when fonts are absent", () => {
    expect(renderFontResources(undefined)).toBe("");
    expect(renderFontResources([])).toBe("");
  });
});
