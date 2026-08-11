import { describe, expect, it } from "vitest";

import {
  FontResourceSchema,
  PresentationResourcesSchema,
} from "../src";

const createFontResource = (url: string, format = "woff2") => ({
  id: "inter",
  family: "Inter",
  source: {
    type: "url",
    url,
    format,
  },
});

describe("FontResourceSchema", () => {
  it("accepts a direct HTTPS WOFF2 font resource", () => {
    expect(
      FontResourceSchema.parse(
        createFontResource("https://cdn.example.com/fonts/inter.woff2"),
      ),
    ).toEqual(createFontResource("https://cdn.example.com/fonts/inter.woff2"));
  });

  it("accepts an absolute HTTP font URL", () => {
    expect(
      FontResourceSchema.safeParse(
        createFontResource("http://localhost:4173/fonts/inter.woff2"),
      ).success,
    ).toBe(true);
  });

  it.each(["woff2", "woff", "truetype", "opentype"])(
    "accepts the %s format",
    (format) => {
      expect(
        FontResourceSchema.safeParse(
          createFontResource("https://cdn.example.com/font", format),
        ).success,
      ).toBe(true);
    },
  );

  it("trims the id and family", () => {
    const parsed = FontResourceSchema.parse({
      ...createFontResource("https://cdn.example.com/inter.woff2"),
      id: " inter ",
      family: " Inter ",
    });

    expect(parsed.id).toBe("inter");
    expect(parsed.family).toBe("Inter");
  });

  it("rejects empty identifiers, empty families, and unknown formats", () => {
    const fontResource = createFontResource(
      "https://cdn.example.com/inter.woff2",
    );

    expect(FontResourceSchema.safeParse({ ...fontResource, id: " " }).success).toBe(
      false,
    );
    expect(
      FontResourceSchema.safeParse({ ...fontResource, family: " " }).success,
    ).toBe(false);
    expect(
      FontResourceSchema.safeParse({
        ...fontResource,
        source: { ...fontResource.source, format: "ttf" },
      }).success,
    ).toBe(false);
  });

  it.each([
    "not a URL",
    "/fonts/inter.woff2",
    "javascript:alert(1)",
    "data:font/woff2;base64,AA==",
    "ftp://cdn.example.com/inter.woff2",
    "https://fonts.googleapis.com/css2?family=Inter",
    "https://cdn.example.com/fonts.css",
    "https://cdn.example.com/font.js",
  ])("rejects the invalid font URL %s", (url) => {
    expect(FontResourceSchema.safeParse(createFontResource(url)).success).toBe(
      false,
    );
  });

  it("keeps the resource container optional and accepts an empty registry", () => {
    expect(PresentationResourcesSchema.parse({})).toEqual({});
    expect(PresentationResourcesSchema.parse({ fonts: [] })).toEqual({ fonts: [] });
  });
});
