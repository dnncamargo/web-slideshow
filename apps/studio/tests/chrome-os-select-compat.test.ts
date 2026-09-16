import { describe, expect, it } from "vitest";

import { isChromeOsNativeSelectCompatUserAgent } from "../src/features/editor/chrome-os-select-compat";

describe("ChromeOS native select compatibility detection", () => {
  it.each([
    ["Chrome on ChromeOS", "Mozilla/5.0 (X11; CrOS x86_64 14541.0.0) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36"],
  ])("enables spacing for %s", (_label, userAgent) => {
    expect(isChromeOsNativeSelectCompatUserAgent(userAgent)).toBe(true);
  });

  it.each([
    ["Chrome on Linux", "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36"],
    ["Chrome on Windows", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36"],
    ["Chrome on macOS", "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36"],
    ["Edge on ChromeOS", "Mozilla/5.0 (X11; CrOS x86_64 14541.0.0) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36 Edg/120.0.0.0"],
    ["Opera on ChromeOS", "Mozilla/5.0 (X11; CrOS x86_64 14541.0.0) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36 OPR/105.0.0.0"],
    ["Firefox on ChromeOS", "Mozilla/5.0 (X11; CrOS x86_64 14541.0.0; rv:121.0) Gecko/20100101 Firefox/121.0"],
  ])("does not enable spacing for %s", (_label, userAgent) => {
    expect(isChromeOsNativeSelectCompatUserAgent(userAgent)).toBe(false);
  });
});
