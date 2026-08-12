import { describe, expect, it } from "vitest";

import {
  isGoogleFontFileUrl,
  validateGoogleFontsCssUrl,
} from "../src/features/fonts/google-font-import-url";

function expectErrorCode(input: string, code: string): void {
  expect(() => validateGoogleFontsCssUrl(input)).toThrowError(code);
}

describe("validateGoogleFontsCssUrl", () => {
  it.each([
    "https://fonts.googleapis.com/css2?family=Audiowide",
    "https://fonts.googleapis.com/css2?family=Audiowide&display=swap",
    "https://fonts.googleapis.com/css2?family=Audiowide&family=Roboto+Slab&display=swap",
  ])("accepts a supported CSS2 URL: %s", (input) => {
    expect(validateGoogleFontsCssUrl(input).hostname).toBe(
      "fonts.googleapis.com",
    );
  });

  it.each([
    "http://fonts.googleapis.com/css2?family=Audiowide",
    "https://example.com/css2?family=Audiowide",
    "https://fonts.googleapis.com.evil.test/css2?family=Audiowide",
    "https://evil.example/?next=https://fonts.googleapis.com/css2?family=Audiowide",
    "https://user:pass@fonts.googleapis.com/css2?family=Audiowide",
    "https://fonts.googleapis.com:8443/css2?family=Audiowide",
    "https://fonts.googleapis.com/css?family=Audiowide",
    "javascript:alert(1)",
    "data:text/css,@font-face{}",
    "file:///tmp/font.css",
    "ftp://fonts.googleapis.com/css2?family=Audiowide",
    "https://fonts.googleapis.com/css2",
    "https://fonts.googleapis.com/css2?family=",
  ])("rejects an invalid or misleading URL: %s", (input) => {
    expectErrorCode(input, "invalid_google_fonts_url");
  });

  it("rejects text-optimized links explicitly", () => {
    expectErrorCode(
      "https://fonts.googleapis.com/css2?family=Audiowide&text=Hello",
      "text_optimized_font_not_supported",
    );
  });

  it("rejects unknown and repeated display parameters", () => {
    expectErrorCode(
      "https://fonts.googleapis.com/css2?family=Audiowide&foo=bar",
      "unsupported_google_fonts_parameter",
    );
    expectErrorCode(
      "https://fonts.googleapis.com/css2?family=Audiowide&display=swap&display=block",
      "unsupported_google_fonts_parameter",
    );
  });
});

describe("isGoogleFontFileUrl", () => {
  it("accepts only exact HTTPS fonts.gstatic.com URLs", () => {
    expect(
      isGoogleFontFileUrl(
        "https://fonts.gstatic.com/s/audiowide/v1/audiowide.woff2",
      ),
    ).toBe(true);
    expect(
      isGoogleFontFileUrl(
        "https://fonts.gstatic.com.evil.test/audiowide.woff2",
      ),
    ).toBe(false);
    expect(
      isGoogleFontFileUrl(
        "http://fonts.gstatic.com/s/audiowide/v1/audiowide.woff2",
      ),
    ).toBe(false);
    expect(isGoogleFontFileUrl("data:font/woff2;base64,AAAA")).toBe(false);
  });
});
