import { describe, expect, it } from "vitest";

import {
  FontFaceResourceSchema,
  FontResourceSchema,
  getFontResourceFaces,
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

const createFace = (
  weight: number,
  style: "normal" | "italic" = "normal",
) => ({
  weight,
  style,
  subset: "latin",
  source: {
    type: "url",
    url: `https://cdn.example.com/inter-${weight}-${style}.woff2`,
    format: "woff2",
  },
});

describe("FontResourceSchema", () => {
  it("accepts a legacy Round 1 HTTPS WOFF2 font resource", () => {
    expect(
      FontResourceSchema.parse(
        createFontResource("https://cdn.example.com/fonts/inter.woff2"),
      ),
    ).toEqual(createFontResource("https://cdn.example.com/fonts/inter.woff2"));
  });

  it("accepts a resource with one face", () => {
    expect(
      FontResourceSchema.safeParse({
        id: "inter",
        family: "Inter",
        faces: [createFace(400)],
      }).success,
    ).toBe(true);
  });

  it("accepts a resource with multiple faces", () => {
    const resource = FontResourceSchema.parse({
      id: "inter",
      family: "Inter",
      faces: [createFace(400), createFace(700), createFace(400, "italic")],
    });

    expect(getFontResourceFaces(resource)).toHaveLength(3);
  });

  it("normalizes a legacy source as one unspecified face without mutation", () => {
    const resource = FontResourceSchema.parse(
      createFontResource("https://cdn.example.com/inter.woff2"),
    );
    const faces = getFontResourceFaces(resource);

    expect(faces).toEqual([{ source: resource.source }]);
    expect(resource).not.toHaveProperty("faces");
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

  it.each([100, 200, 300, 400, 500, 600, 700, 800, 900])(
    "accepts face weight %s",
    (weight) => {
      expect(FontFaceResourceSchema.safeParse(createFace(weight)).success).toBe(
        true,
      );
    },
  );

  it.each(["normal", "italic"])("accepts face style %s", (style) => {
    expect(
      FontFaceResourceSchema.safeParse({
        ...createFace(400),
        style,
      }).success,
    ).toBe(true);
  });

  it("preserves optional subset and unicode range", () => {
    const face = FontFaceResourceSchema.parse({
      ...createFace(400),
      subset: " latin-ext ",
      unicodeRange: "U+0100-02BA, U+02BD-02C5",
    });

    expect(face.subset).toBe("latin-ext");
    expect(face.unicodeRange).toBe("U+0100-02BA, U+02BD-02C5");
  });

  it("keeps face descriptors optional", () => {
    expect(
      FontFaceResourceSchema.safeParse({
        source: {
          type: "url",
          url: "https://cdn.example.com/inter.woff2",
        },
      }).success,
    ).toBe(true);
  });

  it.each([
    ["weight 350", { ...createFace(400), weight: 350 }],
    ["weight 950", { ...createFace(400), weight: 950 }],
    ["oblique style", { ...createFace(400), style: "oblique" }],
    ["empty subset", { ...createFace(400), subset: " " }],
  ])("rejects invalid face %s", (_name, face) => {
    expect(FontFaceResourceSchema.safeParse(face).success).toBe(false);
  });

  it("requires exactly one resource representation", () => {
    expect(
      FontResourceSchema.safeParse({ id: "inter", family: "Inter" }).success,
    ).toBe(false);
    expect(
      FontResourceSchema.safeParse({
        id: "inter",
        family: "Inter",
        faces: [],
      }).success,
    ).toBe(false);
    expect(
      FontResourceSchema.safeParse({
        ...createFontResource("https://cdn.example.com/inter.woff2"),
        faces: [createFace(400)],
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
