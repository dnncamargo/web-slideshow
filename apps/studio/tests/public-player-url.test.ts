import { describe, expect, it } from "vitest";

import {
  normalizePlayerBaseUrl,
  resolvePublicPlayerUrl,
  withPlayerLogsEnabled,
} from "../src/features/public-player/public-player-url";

describe("public Player URL", () => {
  it("normalizes configured trailing slashes", () => {
    expect(normalizePlayerBaseUrl("https://player.example.com///")).toBe("https://player.example.com");
  });

  it("uses the development fallback but stays unavailable in production without configuration", () => {
    expect(resolvePublicPlayerUrl(undefined, "development")).toEqual({
      available: true,
      baseUrl: "http://localhost:5173",
    });
    expect(resolvePublicPlayerUrl(undefined, "production")).toEqual({
      available: false,
      baseUrl: null,
    });
  });

  it("adds logs to a Player URL without an existing query", () => {
    expect(withPlayerLogsEnabled("https://player.example")).toBe(
      "https://player.example/?logs=true",
    );
  });

  it("preserves unrelated query parameters and a hash", () => {
    expect(
      withPlayerLogsEnabled("https://player.example/?foo=bar&view=main#slides"),
    ).toBe("https://player.example/?foo=bar&view=main&logs=true#slides");
  });

  it("replaces an existing logs value instead of duplicating it", () => {
    const url = new URL(
      withPlayerLogsEnabled("https://player.example/?foo=bar&logs=false#slides"),
    );

    expect(url.searchParams.getAll("logs")).toEqual(["true"]);
    expect(url.searchParams.get("foo")).toBe("bar");
    expect(url.hash).toBe("#slides");
  });
});
