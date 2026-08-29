import { describe, expect, it } from "vitest";

import { clampWatchQrPosition } from "../src/app/watch-qr-position";

describe("Watch QR position", () => {
  const bounds = {
    width: 200,
    height: 180,
    viewportWidth: 800,
    viewportHeight: 600,
    inset: 12,
  };

  it("keeps the entire QR inside the viewport inset", () => {
    expect(clampWatchQrPosition({ x: -20, y: 900 }, bounds)).toEqual({
      x: 12,
      y: 408,
    });
    expect(clampWatchQrPosition({ x: 999, y: -50 }, bounds)).toEqual({
      x: 588,
      y: 12,
    });
  });

  it("keeps the safe inset when the viewport is smaller than the QR", () => {
    expect(clampWatchQrPosition({ x: 40, y: 40 }, {
      ...bounds,
      viewportWidth: 100,
      viewportHeight: 100,
    })).toEqual({ x: 12, y: 12 });
  });
});
