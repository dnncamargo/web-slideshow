import { describe, expect, it, vi } from "vitest";

import { WebFontProviderError } from "../font-provider";
import {
  GoogleFontsProvider,
  normalizeGoogleCatalog,
} from "./google-fonts-provider";

const googleCatalog = {
  items: [
    {
      family: "Audiowide",
      category: "display",
      variants: ["regular", "italic", "300", "700italic", "100..900"],
      subsets: ["latin", "latin-ext"],
      files: {
        regular: "http://fonts.gstatic.com/audiowide-regular.woff2",
        italic: "https://fonts.gstatic.com/audiowide-italic.woff2",
        300: "https://fonts.gstatic.com/audiowide-300.woff2",
        "700italic": "https://fonts.gstatic.com/audiowide-700-italic.woff2",
        "100..900": "https://fonts.gstatic.com/audiowide-variable.woff2",
      },
    },
  ],
};

describe("GoogleFontsProvider", () => {
  it("keeps the API key server-side and requests WOFF2 capability", async () => {
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValue(Response.json(googleCatalog));
    const provider = new GoogleFontsProvider({
      apiKey: "server-secret",
      fetchImpl,
    });

    const results = await provider.search("audio");
    const requestUrl = new URL(String(fetchImpl.mock.calls[0]?.[0]));

    expect(requestUrl.searchParams.get("key")).toBe("server-secret");
    expect(requestUrl.searchParams.get("capability")).toBe("WOFF2");
    expect(JSON.stringify(results)).not.toContain("server-secret");
  });

  it("normalizes regular, italic, numeric and numeric italic variants", () => {
    const [resolved] = normalizeGoogleCatalog(googleCatalog);

    expect(resolved?.weights).toEqual([400, 300, 700]);
    expect(resolved?.styles).toEqual(["normal", "italic"]);
    expect(resolved?.defaultSubset).toBe("latin");
    expect(resolved?.faces).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ weight: 400, style: "normal" }),
        expect.objectContaining({ weight: 400, style: "italic" }),
        expect.objectContaining({ weight: 300, style: "normal" }),
        expect.objectContaining({ weight: 700, style: "italic" }),
      ]),
    );
    expect(resolved?.faces).toHaveLength(8);
    expect(resolved?.faces[0]?.url).toBe(
      "https://fonts.gstatic.com/audiowide-regular.woff2",
    );
    expect(resolved?.faces.every((face) => face.format === "woff2")).toBe(true);
  });

  it("reports a missing API key without making a request", async () => {
    const fetchImpl = vi.fn<typeof fetch>();
    const provider = new GoogleFontsProvider({ fetchImpl });

    await expect(provider.search("audio")).rejects.toMatchObject({
      code: "provider_not_configured",
    });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("uses its cached catalog for equivalent searches and resolution", async () => {
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValue(Response.json(googleCatalog));
    const provider = new GoogleFontsProvider({
      apiKey: "secret",
      fetchImpl,
    });

    await provider.search("audio");
    await provider.search("Audiowide");
    await provider.resolveFamily("Audiowide");

    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("rejects invalid responses and normalizes network errors", async () => {
    expect(() => normalizeGoogleCatalog({ items: "invalid" })).toThrowError(
      WebFontProviderError,
    );

    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockRejectedValue(new Error("network unavailable"));
    const provider = new GoogleFontsProvider({
      apiKey: "secret",
      fetchImpl,
    });

    await expect(provider.search("audio")).rejects.toMatchObject({
      code: "provider_unavailable",
    });
  });
});

