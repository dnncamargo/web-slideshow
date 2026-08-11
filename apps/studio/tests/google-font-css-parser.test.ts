import { readFile } from "node:fs/promises";

import { beforeAll, describe, expect, it } from "vitest";

import { areFontFacesEquivalent } from "../src/features/editor/font-resource-helpers";
import { parseGoogleFontsStylesheet } from "../src/features/fonts/google-font-css-parser";

let audiowideCss = "";
let multiFamilyCss = "";

beforeAll(async () => {
  audiowideCss = await readFile(
    new URL("./fixtures/google-fonts/audiowide.css", import.meta.url),
    "utf8",
  );
  multiFamilyCss = await readFile(
    new URL("./fixtures/google-fonts/multi-family.css", import.meta.url),
    "utf8",
  );
});

describe("parseGoogleFontsStylesheet", () => {
  it("parses Audiowide and keeps every unicode-range file in one variant", () => {
    const result = parseGoogleFontsStylesheet(audiowideCss);

    expect(result.unsupported).toEqual([]);
    expect(result.families).toHaveLength(1);
    expect(result.families[0]?.family).toBe("Audiowide");
    expect(result.families[0]?.variants).toHaveLength(1);
    expect(result.families[0]?.variants[0]).toMatchObject({
      weight: 400,
      style: "normal",
    });
    expect(result.families[0]?.variants[0]?.faces).toHaveLength(2);
    expect(
      result.families[0]?.variants[0]?.faces.map(
        (face) => face.unicodeRange,
      ),
    ).toEqual([
      "U+0100-02BA, U+02BD-02C5, U+02C7-02CC",
      "U+0000-00FF, U+0131, U+0152-0153",
    ]);
    expect(
      result.families[0]?.variants[0]?.faces.every(
        (face) =>
          face.source.format === "woff2" &&
          face.source.url.startsWith("https://fonts.gstatic.com/"),
      ),
    ).toBe(true);
  });

  it("ignores @import and never treats it as a face", () => {
    const result = parseGoogleFontsStylesheet(audiowideCss);

    expect(result.families).toHaveLength(1);
    expect(JSON.stringify(result)).not.toContain("evil.example");
  });

  it("groups multiple weights, styles, and families in source order", () => {
    const result = parseGoogleFontsStylesheet(multiFamilyCss);

    expect(result.families.map((family) => family.family)).toEqual([
      "Source Sans 3",
      "Roboto Slab",
    ]);
    expect(
      result.families[0]?.variants.map((variant) => [
        variant.weight,
        variant.style,
      ]),
    ).toEqual([
      [400, "normal"],
      [700, "normal"],
      [400, "italic"],
      [700, "italic"],
    ]);
    expect(result.families[1]?.variants).toHaveLength(1);
  });

  it("rejects malicious or non-Google font sources", () => {
    const css = [
      "http://fonts.gstatic.com/font.woff2",
      "data:font/woff2;base64,AAAA",
      "javascript:alert(1)",
      "https://evil.example/font.woff2",
      "https://fonts.gstatic.com.evil.test/font.woff2",
    ]
      .map(
        (url) => `
          @font-face {
            font-family: 'Unsafe';
            font-style: normal;
            font-weight: 400;
            src: url('${url}') format('woff2');
          }
        `,
      )
      .join("\n");
    const result = parseGoogleFontsStylesheet(css);

    expect(result.families).toEqual([]);
    expect(result.unsupported).toHaveLength(5);
    expect(
      result.unsupported.every(
        (face) => face.reason === "unsupported_font_source",
      ),
    ).toBe(true);
  });

  it("prefers the supported WOFF2 entry and ignores other formats", () => {
    const result = parseGoogleFontsStylesheet(`
      @font-face {
        font-family: "Roboto Slab";
        font-style: normal;
        font-weight: 700;
        src:
          url("https://fonts.gstatic.com/font.woff") format("woff"),
          url("https://fonts.gstatic.com/font.woff2") format("woff2");
      }
    `);

    expect(
      result.families[0]?.variants[0]?.faces[0]?.source,
    ).toEqual({
      type: "url",
      url: "https://fonts.gstatic.com/font.woff2",
      format: "woff2",
    });
  });

  it("marks variable weights and unsupported styles without rounding", () => {
    const result = parseGoogleFontsStylesheet(`
      @font-face {
        font-family: 'Variable Font';
        font-style: normal;
        font-weight: 100 900;
        src: url(https://fonts.gstatic.com/variable.woff2) format('woff2');
      }
      @font-face {
        font-family: 'Oblique Font';
        font-style: oblique;
        font-weight: 400;
        src: url(https://fonts.gstatic.com/oblique.woff2) format('woff2');
      }
      @font-face {
        font-family: 'Odd Weight';
        font-style: normal;
        font-weight: 450;
        src: url(https://fonts.gstatic.com/odd.woff2) format('woff2');
      }
    `);

    expect(result.families).toEqual([]);
    expect(result.unsupported).toHaveLength(3);
    expect(
      result.unsupported.every(
        (face) => face.reason === "unsupported_font_variant",
      ),
    ).toBe(true);
    expect(result.unsupported.map((face) => face.weight)).toEqual([
      "100 900",
      "400",
      "450",
    ]);
  });

  it("keeps supported faces when another variant is unsupported", () => {
    const result = parseGoogleFontsStylesheet(`
      @font-face {
        font-family: 'Mixed Font';
        font-style: normal;
        font-weight: 400;
        src: url(https://fonts.gstatic.com/mixed-400.woff2) format('woff2');
      }
      @font-face {
        font-family: 'Mixed Font';
        font-style: normal;
        font-weight: 100 900;
        src: url(https://fonts.gstatic.com/mixed-variable.woff2) format('woff2');
      }
    `);

    expect(result.families[0]?.variants).toHaveLength(1);
    expect(result.families[0]?.variants[0]?.weight).toBe(400);
    expect(result.unsupported).toEqual([
      {
        family: "Mixed Font",
        weight: "100 900",
        style: "normal",
        reason: "unsupported_font_variant",
      },
    ]);
  });

  it("keeps same-URL faces when unicode ranges differ", () => {
    const result = parseGoogleFontsStylesheet(`
      @font-face {
        font-family: 'Range Font';
        font-style: normal;
        font-weight: 400;
        src: url(https://fonts.gstatic.com/range.woff2) format('woff2');
        unicode-range: U+0000-00FF;
      }
      @font-face {
        font-family: 'Range Font';
        font-style: normal;
        font-weight: 400;
        src: url(https://fonts.gstatic.com/range.woff2) format('woff2');
        unicode-range: U+0100-024F;
      }
    `);
    const faces = result.families[0]?.variants[0]?.faces ?? [];

    expect(faces).toHaveLength(2);
    expect(areFontFacesEquivalent(faces[0]!, faces[1]!)).toBe(false);
  });

  it("deduplicates a structurally identical repeated block", () => {
    const block = `
      @font-face {
        font-family: 'Duplicate';
        font-style: normal;
        font-weight: 400;
        src: url(https://fonts.gstatic.com/duplicate.woff2) format('woff2');
        unicode-range: U+0000-00FF;
      }
    `;
    const result = parseGoogleFontsStylesheet(block + block);

    expect(result.families[0]?.variants[0]?.faces).toHaveLength(1);
  });

  it("handles malformed CSS without throwing", () => {
    expect(() =>
      parseGoogleFontsStylesheet(`
        @font-face {
          font-family: 'Broken';
          font-weight: 400;
      `),
    ).not.toThrow();

    const result = parseGoogleFontsStylesheet(
      "@font-face { font-family: 'Broken'; }",
    );

    expect(result.families).toEqual([]);
    expect(result.unsupported).toHaveLength(1);
  });
});
