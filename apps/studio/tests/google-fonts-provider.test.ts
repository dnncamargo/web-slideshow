import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  parseGoogleFontVariant,
  resetGoogleFontsProviderCacheForTests,
  resolveGoogleFontsFamily,
  searchGoogleFonts,
} from "../src/features/fonts/providers/google-fonts-provider";
import { WEB_FONT_CATALOG_TTL_MS } from "../src/features/fonts/web-font-provider-utils";

const googleCatalog = {
  kind: "webfonts#webfontList",
  items: [
    {
      family: "Audiowide",
      variants: ["regular", "italic", "700", "700italic", "100..900"],
      subsets: ["latin", "latin-ext"],
      category: "display",
      files: {
        regular:
          "http://fonts.gstatic.com/s/audiowide/v22/l7gdbjpo0cum0ckerWCdmA.woff2",
        italic:
          "https://fonts.gstatic.com/s/audiowide/v22/italic.woff2",
        "700": "https://fonts.gstatic.com/s/audiowide/v22/700.woff2",
        "700italic":
          "https://fonts.gstatic.com/s/audiowide/v22/700italic.woff2",
        "100..900":
          "https://fonts.gstatic.com/s/audiowide/v22/variable.woff2",
      },
    },
  ],
};

beforeEach(() => {
  resetGoogleFontsProviderCacheForTests();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("Google Fonts provider", () => {
  it.each([
    ["regular", { weight: 400, style: "normal" }],
    ["italic", { weight: 400, style: "italic" }],
    ["300", { weight: 300, style: "normal" }],
    ["700", { weight: 700, style: "normal" }],
    ["700italic", { weight: 700, style: "italic" }],
  ] as const)("normalizes the %s variant", (variant, expected) => {
    expect(parseGoogleFontVariant(variant)).toEqual(expected);
  });

  it("requests WOFF2 capability server-side and normalizes static faces", async () => {
    const fetchMock = vi.fn(async (input: URL | RequestInfo) => {
      String(input);
      return Response.json(googleCatalog);
    });
    const results = await searchGoogleFonts("audio", {
      apiKey: "server-only-secret",
      fetchImpl: fetchMock,
    });
    const requestUrl = new URL(String(fetchMock.mock.calls[0]?.[0]));

    expect(requestUrl.origin + requestUrl.pathname).toBe(
      "https://www.googleapis.com/webfonts/v1/webfonts",
    );
    expect(requestUrl.searchParams.get("key")).toBe("server-only-secret");
    expect(requestUrl.searchParams.get("capability")).toBe("WOFF2");
    expect(results[0]).toMatchObject({
      provider: "google-fonts",
      family: "Audiowide",
      weights: [400, 700],
      styles: ["normal", "italic"],
      subsets: ["latin", "latin-ext"],
    });

    const family = await resolveGoogleFontsFamily("Audiowide", {
      apiKey: "server-only-secret",
      fetchImpl: fetchMock,
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(family.defaultSubset).toBe("latin");
    expect(family.faces).toContainEqual({
      weight: 400,
      style: "normal",
      subset: "latin",
      source: {
        type: "url",
        url: "https://fonts.gstatic.com/s/audiowide/v22/l7gdbjpo0cum0ckerWCdmA.woff2",
        format: "woff2",
      },
    });
    expect(family.faces).toContainEqual(
      expect.objectContaining({ weight: 700, style: "italic" }),
    );
    expect(family.faces).toHaveLength(8);
  });

  it("reports a missing API key without calling Google", async () => {
    const fetchMock = vi.fn();

    await expect(
      searchGoogleFonts("audio", { apiKey: null, fetchImpl: fetchMock }),
    ).rejects.toMatchObject({ code: "provider_not_configured" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("caches Google separately until the TTL expires", async () => {
    let now = 20_000;
    const fetchMock = vi.fn(async () => Response.json(googleCatalog));
    const options = {
      apiKey: "server-only-secret",
      fetchImpl: fetchMock,
      now: () => now,
    };

    await searchGoogleFonts("audio", options);
    await searchGoogleFonts("wide", options);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    now += WEB_FONT_CATALOG_TTL_MS;
    await searchGoogleFonts("audio", options);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("rejects invalid responses and normalizes network errors", async () => {
    await expect(
      searchGoogleFonts("audio", {
        apiKey: "secret",
        fetchImpl: vi.fn(async () => Response.json({ fonts: [] })),
      }),
    ).rejects.toMatchObject({ code: "invalid_provider_response" });

    resetGoogleFontsProviderCacheForTests();

    await expect(
      searchGoogleFonts("audio", {
        apiKey: "secret",
        fetchImpl: vi.fn(async () => {
          throw new Error("network secret");
        }),
      }),
    ).rejects.toMatchObject({ code: "provider_unavailable" });
  });

  it("times out without exposing the API key", async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn(
      async (_input: URL | RequestInfo, init?: RequestInit) =>
        await new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () => {
            reject(new DOMException("aborted", "AbortError"));
          });
        }),
    );
    const request = searchGoogleFonts("audio", {
      apiKey: "must-not-leak",
      fetchImpl: fetchMock,
      timeoutMs: 5_000,
    });
    const expectation = expect(request).rejects.toMatchObject({
      code: "provider_timeout",
      message: "provider_timeout",
    });

    await vi.advanceTimersByTimeAsync(5_000);
    await expectation;
  });
});
