import { describe, expect, it } from "vitest";

import type { FontResource } from "@powershow/document-schema";

import { renderFontResources } from "../src/render-font-resources";

function createFontResource(
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

function countOccurrences(value: string, search: string): number {
  return value.split(search).length - 1;
}

describe("renderFontResources", () => {
  it("renders one font face with the fixed swap behavior", () => {
    const css = renderFontResources([createFontResource()]);

    expect(countOccurrences(css, "@font-face")).toBe(1);
    expect(css).toContain('font-family:"Inter"');
    expect(css).toContain(
      'src:url("https://cdn.example.com/inter.woff2") format("woff2")',
    );
    expect(css).toContain("font-display:swap");
    expect(css).not.toContain("@import");
  });

  it("renders exactly one declaration per registered resource", () => {
    const css = renderFontResources([
      createFontResource(),
      createFontResource({
        id: "source-sans-3",
        family: "Source Sans 3",
        source: {
          type: "url",
          url: "https://cdn.example.com/source-sans-3.otf",
          format: "opentype",
        },
      }),
    ]);

    expect(countOccurrences(css, "@font-face")).toBe(2);
    expect(css).toContain('font-family:"Source Sans 3"');
    expect(css).toContain('format("opentype")');
  });

  it("omits a format hint when the resource does not define one", () => {
    const css = renderFontResources([
      createFontResource({
        source: {
          type: "url",
          url: "https://cdn.example.com/font",
        },
      }),
    ]);

    expect(css).toContain('src:url("https://cdn.example.com/font");');
    expect(css).not.toContain("format(");
  });

  it("escapes family and URL strings without breaking the CSS block", () => {
    const css = renderFontResources([
      createFontResource({
        family: 'Unsafe"</style>',
        source: {
          type: "url",
          url: 'https://cdn.example.com/font\")}.woff2?<tag>',
          format: "woff2",
        },
      }),
    ]);

    expect(css).not.toContain("</style>");
    expect(css).not.toContain('font-family:"Unsafe"');
    expect(css).toContain("\\22 ");
    expect(css).toContain("\\3c ");
    expect(css).toContain("\\3e ");
  });

  it("renders no CSS when fonts are absent", () => {
    expect(renderFontResources(undefined)).toBe("");
    expect(renderFontResources([])).toBe("");
  });
});
