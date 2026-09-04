import { describe, expect, it } from "vitest";

import {
  normalizePlayerBaseUrl,
  resolvePublicPlayerUrl,
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

});
