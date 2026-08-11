import { describe, expect, it, vi } from "vitest";

import { WebFontProviderError } from "../font-provider";
import {
  FontsourceProvider,
  normalizeFontsourceCatalog,
  normalizeFontsourceFamily,
} from "./fontsource-provider";

const catalog = [
  {
    id: "audio-narrow",
    family: "Audio Narrow",
    category: "sans-serif",
    weights: [400, 700],
    styles: ["normal", "italic"],
    subsets: ["latin", "latin-ext"],
    defSubset: "latin",
  },
  {
    id: "audiowide",
    family: "Audiowide",
    category: "display",
    weights: [400],
    styles: ["normal"],
    subsets: ["latin"],
    defSubset: "latin",
  },
  {
    id: "inaudio",
    family: "Inaudio",
    category: "display",
    weights: [400],
    styles: ["normal"],
    subsets: ["latin"],
    defSubset: "latin",
  },
];

const family = {
  ...catalog[0],
  unicodeRange: {
    latin: "U+0000-00FF",
    "latin-ext": "U+0100-024F",
  },
  variants: {
    400: {
      normal: {
        latin: {
          url: {
            woff2:
              "https://cdn.jsdelivr.net/fontsource/fonts/audio-narrow@latest/latin-400-normal.woff2",
          },
        },
      },
      italic: {
        latin: {
          url: {
            woff2:
              "https://cdn.jsdelivr.net/fontsource/fonts/audio-narrow@latest/latin-400-italic.woff2",
          },
        },
      },
    },
    700: {
      normal: {
        "latin-ext": {
          url: {
            woff2:
              "https://cdn.jsdelivr.net/fontsource/fonts/audio-narrow@latest/latin-ext-700-normal.woff2",
          },
        },
      },
    },
  },
};

function jsonResponse(value: unknown): Response {
  return Response.json(value);
}

describe("FontsourceProvider", () => {
  it("normalizes catalog summaries and prioritizes prefix matches", async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(
      jsonResponse(catalog),
    );
    const provider = new FontsourceProvider({ fetchImpl });

    await expect(provider.search("AUDIO")).resolves.toMatchObject([
      { id: "audio-narrow", family: "Audio Narrow", weights: [400, 700] },
      { id: "audiowide", family: "Audiowide", styles: ["normal"] },
      { id: "inaudio", family: "Inaudio" },
    ]);
  });

  it("resolves static WOFF2 faces, styles, subsets and unicode ranges", () => {
    const resolved = normalizeFontsourceFamily(family);

    expect(resolved.defaultSubset).toBe("latin");
    expect(resolved.faces).toHaveLength(3);
    expect(resolved.faces).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          weight: 400,
          style: "normal",
          subset: "latin",
          unicodeRange: "U+0000-00FF",
          format: "woff2",
        }),
        expect.objectContaining({ weight: 400, style: "italic" }),
        expect.objectContaining({
          weight: 700,
          style: "normal",
          subset: "latin-ext",
        }),
      ]),
    );
  });

  it("loads family details only when requested", async () => {
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(jsonResponse(catalog))
      .mockResolvedValueOnce(jsonResponse(family));
    const provider = new FontsourceProvider({ fetchImpl });

    await provider.search("audio");
    expect(fetchImpl).toHaveBeenCalledTimes(1);

    await expect(provider.resolveFamily("audio-narrow")).resolves.toMatchObject({
      family: "Audio Narrow",
      faces: expect.any(Array),
    });
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(String(fetchImpl.mock.calls[1]?.[0])).toContain(
      "/v1/fonts/audio-narrow",
    );
  });

  it("rejects invalid provider responses", () => {
    expect(() => normalizeFontsourceCatalog({ fonts: [] })).toThrowError(
      WebFontProviderError,
    );
    expect(() => normalizeFontsourceFamily({ ...family, variants: null })).toThrowError(
      WebFontProviderError,
    );
  });

  it("normalizes network failures", async () => {
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockRejectedValue(new Error("network unavailable"));
    const provider = new FontsourceProvider({ fetchImpl });

    await expect(provider.search("audio")).rejects.toMatchObject({
      code: "provider_unavailable",
    });
  });
});

