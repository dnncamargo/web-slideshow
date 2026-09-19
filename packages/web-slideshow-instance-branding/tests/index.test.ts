import { describe, expect, it } from "vitest";

import { displayName } from "../src";

describe("instance branding contract", () => {
  it("provides a neutral display name for an uncustomized clone", () => {
    expect(displayName).toBe("Presentation");
    expect(displayName).not.toBe("web-slideshow");
  });
});
