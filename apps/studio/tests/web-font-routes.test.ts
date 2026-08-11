import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { GET as getFamily } from "../src/app/api/fonts/family/route";
import { GET as searchFonts } from "../src/app/api/fonts/search/route";
import { GET as getStatus } from "../src/app/api/fonts/status/route";
import { resetFontsourceProviderCacheForTests } from "../src/features/fonts/providers/fontsource-provider";
import { resetGoogleFontsProviderCacheForTests } from "../src/features/fonts/providers/google-fonts-provider";

const fontsourceCatalog = [
  {
    id: "audiowide",
    family: "Audiowide",
    category: "display",
    weights: [400],
    styles: ["normal"],
    subsets: ["latin"],
    defSubset: "latin",
  },
];

const fontsourceFamily = {
  ...fontsourceCatalog[0],
  unicodeRange: { latin: "U+0000-00FF" },
  variants: {
    "400": {
      normal: {
        latin: {
          url: {
            woff2:
              "https://cdn.jsdelivr.net/fontsource/fonts/audiowide@latest/latin-400-normal.woff2",
          },
        },
      },
    },
  },
};

const googleCatalog = {
  items: [
    {
      family: "Audiowide",
      variants: ["regular"],
      subsets: ["latin"],
      category: "display",
      files: {
        regular: "https://fonts.gstatic.com/s/audiowide/v22/regular.woff2",
      },
    },
  ],
};

function request(path: string): Request {
  return new Request(`http://studio.test${path}`);
}

beforeEach(() => {
  resetFontsourceProviderCacheForTests();
  resetGoogleFontsProviderCacheForTests();
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("internal web font routes", () => {
  it("rejects invalid providers and queries shorter than two characters", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const providerResponse = await searchFonts(
      request("/api/fonts/search?provider=evil&q=Audiowide"),
    );
    const queryResponse = await searchFonts(
      request("/api/fonts/search?provider=fontsource&q=A"),
    );

    expect(providerResponse.status).toBe(400);
    expect(await providerResponse.json()).toEqual({
      ok: false,
      error: "invalid_provider",
    });
    expect(queryResponse.status).toBe(400);
    expect(await queryResponse.json()).toEqual({
      ok: false,
      error: "invalid_query",
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("returns normalized Fontsource search and family responses", async () => {
    const fetchMock = vi.fn(async (input: URL | RequestInfo) =>
      String(input).endsWith("/audiowide")
        ? Response.json(fontsourceFamily)
        : Response.json(fontsourceCatalog),
    );
    vi.stubGlobal("fetch", fetchMock);

    const searchResponse = await searchFonts(
      request("/api/fonts/search?provider=fontsource&q=AUDIO"),
    );
    const familyResponse = await getFamily(
      request("/api/fonts/family?provider=fontsource&id=audiowide"),
    );

    expect(searchResponse.status).toBe(200);
    expect(await searchResponse.json()).toMatchObject({
      ok: true,
      results: [{ provider: "fontsource", family: "Audiowide" }],
    });
    expect(familyResponse.status).toBe(200);
    expect(await familyResponse.json()).toMatchObject({
      ok: true,
      family: {
        provider: "fontsource",
        family: "Audiowide",
        faces: [{ weight: 400, style: "normal", subset: "latin" }],
      },
    });
  });

  it("returns normalized Google search without leaking the API key", async () => {
    const apiKey = "server-only-key-must-not-leak";
    vi.stubEnv("GOOGLE_FONTS_API_KEY", apiKey);
    vi.stubGlobal("fetch", vi.fn(async () => Response.json(googleCatalog)));

    const response = await searchFonts(
      request("/api/fonts/search?provider=google-fonts&q=Audiowide"),
    );
    const body = await response.json();
    const serialized = JSON.stringify(body);

    expect(response.status).toBe(200);
    expect(body).toMatchObject({
      ok: true,
      results: [{ provider: "google-fonts", family: "Audiowide" }],
    });
    expect(serialized).not.toContain(apiKey);
    expect(serialized).not.toContain("key=");
  });

  it("reports Google Search as unavailable without disabling CSS import", async () => {
    vi.stubEnv("GOOGLE_FONTS_API_KEY", "");
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const statusResponse = getStatus(
      request("/api/fonts/status?provider=google-fonts"),
    );
    const searchResponse = await searchFonts(
      request("/api/fonts/search?provider=google-fonts&q=Audiowide"),
    );

    expect(await statusResponse.json()).toEqual({
      ok: true,
      available: false,
    });
    expect(searchResponse.status).toBe(503);
    expect(await searchResponse.json()).toEqual({
      ok: false,
      error: "provider_not_configured",
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("normalizes provider failures without returning internal details", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("private provider network details");
      }),
    );

    const response = await searchFonts(
      request("/api/fonts/search?provider=fontsource&q=Audiowide"),
    );
    const serialized = JSON.stringify(await response.json());

    expect(response.status).toBe(502);
    expect(serialized).toBe('{"ok":false,"error":"provider_unavailable"}');
    expect(serialized).not.toContain("private");
    expect(serialized).not.toContain("stack");
  });
});
