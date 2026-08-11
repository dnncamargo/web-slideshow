import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  resetFontsourceProviderCacheForTests,
  resolveFontsourceFamily,
  searchFontsourceFonts,
} from "../src/features/fonts/providers/fontsource-provider";
import { WEB_FONT_CATALOG_TTL_MS } from "../src/features/fonts/web-font-provider-utils";

const catalog = [
  {
    id: "audiowide",
    family: "Audiowide",
    category: "display",
    weights: [400],
    styles: ["normal"],
    subsets: ["latin", "latin-ext"],
    defSubset: "latin",
  },
  {
    id: "audiowide-expanded",
    family: "Audiowide Expanded",
    category: "display",
    weights: [400, 700],
    styles: ["normal"],
    subsets: ["latin"],
    defSubset: "latin",
  },
  {
    id: "radio-audiowide",
    family: "Radio Audiowide",
    category: "display",
    weights: [400],
    styles: ["normal"],
    subsets: ["latin"],
    defSubset: "latin",
  },
];

const familyDetail = {
  ...catalog[0],
  unicodeRange: {
    latin: "U+0000-00FF",
    "latin-ext": "U+0100-024F",
  },
  variants: {
    "400": {
      normal: {
        latin: {
          url: {
            woff2:
              "https://cdn.jsdelivr.net/fontsource/fonts/audiowide@latest/latin-400-normal.woff2",
          },
        },
        "latin-ext": {
          url: {
            woff2:
              "https://cdn.jsdelivr.net/fontsource/fonts/audiowide@latest/latin-ext-400-normal.woff2",
          },
        },
      },
      italic: {
        latin: {
          url: {
            woff2:
              "https://cdn.jsdelivr.net/fontsource/fonts/audiowide@latest/latin-400-italic.woff2",
          },
        },
      },
    },
    "700": {
      normal: {
        latin: {
          url: {
            woff2:
              "https://cdn.jsdelivr.net/fontsource/fonts/audiowide@latest/latin-700-normal.woff2",
          },
        },
      },
    },
  },
  weights: [400, 700],
  styles: ["normal", "italic"],
};

beforeEach(() => {
  resetFontsourceProviderCacheForTests();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("Fontsource provider", () => {
  it("normalizes the catalog and ranks case-insensitive prefix matches first", async () => {
    const fetchMock = vi.fn(async () => Response.json(catalog));

    const results = await searchFontsourceFonts("AUDIO", {
      fetchImpl: fetchMock,
    });

    expect(results.map((result) => result.id)).toEqual([
      "audiowide",
      "audiowide-expanded",
      "radio-audiowide",
    ]);
    expect(results[0]).toEqual({
      provider: "fontsource",
      id: "audiowide",
      family: "Audiowide",
      category: "display",
      weights: [400],
      styles: ["normal"],
      subsets: ["latin", "latin-ext"],
    });
  });

  it("normalizes family variants, subsets, WOFF2 URLs, and Unicode ranges", async () => {
    const fetchMock = vi.fn(async (input: URL | RequestInfo) => {
      String(input);
      return Response.json(familyDetail);
    });

    const family = await resolveFontsourceFamily("audiowide", {
      fetchImpl: fetchMock,
    });

    expect(String(fetchMock.mock.calls[0]?.[0])).toBe(
      "https://api.fontsource.org/v1/fonts/audiowide",
    );
    expect(family.defaultSubset).toBe("latin");
    expect(family.weights).toEqual([400, 700]);
    expect(family.styles).toEqual(["normal", "italic"]);
    expect(family.faces).toContainEqual({
      weight: 400,
      style: "normal",
      subset: "latin-ext",
      unicodeRange: "U+0100-024F",
      source: {
        type: "url",
        url: "https://cdn.jsdelivr.net/fontsource/fonts/audiowide@latest/latin-ext-400-normal.woff2",
        format: "woff2",
      },
    });
    expect(family.faces).toContainEqual(
      expect.objectContaining({ weight: 400, style: "italic" }),
    );
    expect(family.faces).toContainEqual(
      expect.objectContaining({ weight: 700, style: "normal" }),
    );
  });

  it("caches the catalog until its 15-minute TTL expires", async () => {
    let now = 10_000;
    const fetchMock = vi.fn(async () => Response.json(catalog));
    const options = { fetchImpl: fetchMock, now: () => now };

    await searchFontsourceFonts("audio", options);
    await searchFontsourceFonts("radio", options);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    now += WEB_FONT_CATALOG_TTL_MS;
    await searchFontsourceFonts("audio", options);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("rejects invalid responses and normalizes network errors", async () => {
    await expect(
      searchFontsourceFonts("audio", {
        fetchImpl: vi.fn(async () => Response.json({ fonts: catalog })),
      }),
    ).rejects.toMatchObject({ code: "invalid_provider_response" });

    resetFontsourceProviderCacheForTests();

    await expect(
      searchFontsourceFonts("audio", {
        fetchImpl: vi.fn(async () => {
          throw new Error("network detail must stay private");
        }),
      }),
    ).rejects.toMatchObject({ code: "provider_unavailable" });
  });

  it("aborts an external request after the configured timeout", async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn(
      async (_input: URL | RequestInfo, init?: RequestInit) =>
        await new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () => {
            reject(new DOMException("aborted", "AbortError"));
          });
        }),
    );
    const request = searchFontsourceFonts("audio", {
      fetchImpl: fetchMock,
      timeoutMs: 5_000,
    });
    const expectation = expect(request).rejects.toMatchObject({
      code: "provider_timeout",
    });

    await vi.advanceTimersByTimeAsync(5_000);
    await expectation;
  });
});
