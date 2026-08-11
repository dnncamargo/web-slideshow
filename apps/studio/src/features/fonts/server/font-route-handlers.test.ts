import { describe, expect, it, vi } from "vitest";

import type { ResolvedWebFontFamily, WebFontSummary } from "../web-font-types";
import { WebFontProviderError } from "./font-provider";
import {
  createFontFamilyHandler,
  createFontSearchHandler,
  createFontStatusHandler,
} from "./font-route-handlers";
import type { WebFontService } from "./web-font-service";

const summary: WebFontSummary = {
  provider: "fontsource",
  id: "audiowide",
  family: "Audiowide",
  category: "display",
  weights: [400],
  styles: ["normal"],
  subsets: ["latin"],
  defaultSubset: "latin",
};

const resolved: ResolvedWebFontFamily = {
  ...summary,
  faces: [
    {
      weight: 400,
      style: "normal",
      subset: "latin",
      url: "https://cdn.example.test/audiowide.woff2",
      format: "woff2",
    },
  ],
};

function createService(): WebFontService {
  return {
    search: vi.fn().mockResolvedValue([summary]),
    resolveFamily: vi.fn().mockResolvedValue(resolved),
  };
}

describe("font route handlers", () => {
  it("rejects an invalid provider", async () => {
    const response = await createFontSearchHandler(createService())(
      new Request("http://localhost/api/fonts/search?provider=other&query=audio"),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "invalid_provider",
    });
  });

  it("rejects a query shorter than two characters", async () => {
    const response = await createFontSearchHandler(createService())(
      new Request(
        "http://localhost/api/fonts/search?provider=fontsource&query=a",
      ),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "invalid_query" });
  });

  it.each(["fontsource", "google-fonts"] as const)(
    "returns normalized search results for %s",
    async (provider) => {
      const service = createService();
      const response = await createFontSearchHandler(service)(
        new Request(
          `http://localhost/api/fonts/search?provider=${provider}&query=audio`,
        ),
      );

      expect(response.status).toBe(200);
      await expect(response.json()).resolves.toEqual({ fonts: [summary] });
      expect(service.search).toHaveBeenCalledWith(provider, "audio");
    },
  );

  it("normalizes provider unavailability without exposing secrets", async () => {
    const service = createService();

    vi.mocked(service.search).mockRejectedValue(
      new WebFontProviderError("provider_not_configured", {
        cause: new Error("GOOGLE_FONTS_API_KEY=server-secret"),
      }),
    );

    const response = await createFontSearchHandler(service)(
      new Request(
        "http://localhost/api/fonts/search?provider=google-fonts&query=audio",
      ),
    );
    const body = JSON.stringify(await response.json());

    expect(response.status).toBe(503);
    expect(body).toBe('{"error":"provider_not_configured"}');
    expect(body).not.toContain("server-secret");
  });

  it("returns a stable error when the selected provider is unavailable", async () => {
    const service = createService();

    vi.mocked(service.search).mockRejectedValue(
      new WebFontProviderError("provider_unavailable"),
    );

    const response = await createFontSearchHandler(service)(
      new Request(
        "http://localhost/api/fonts/search?provider=fontsource&query=audio",
      ),
    );

    expect(response.status).toBe(502);
    await expect(response.json()).resolves.toEqual({
      error: "provider_unavailable",
    });
  });

  it("resolves one family through the selected provider", async () => {
    const service = createService();
    const response = await createFontFamilyHandler(service)(
      new Request(
        "http://localhost/api/fonts/family?provider=fontsource&id=audiowide",
      ),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ family: resolved });
    expect(service.resolveFamily).toHaveBeenCalledWith(
      "fontsource",
      "audiowide",
    );
  });

  it("reports provider configuration without exposing credentials", async () => {
    const isConfigured = vi.fn().mockReturnValue(false);
    const response = await createFontStatusHandler(isConfigured)(
      new Request(
        "http://localhost/api/fonts/status?provider=google-fonts",
      ),
    );
    const body = JSON.stringify(await response.json());

    expect(response.status).toBe(200);
    expect(body).toBe('{"available":false}');
    expect(body).not.toContain("GOOGLE_FONTS_API_KEY");
    expect(isConfigured).toHaveBeenCalledWith("google-fonts");
  });
});
