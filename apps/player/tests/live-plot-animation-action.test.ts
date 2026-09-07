import { describe, expect, it } from "vitest";

import {
  PLOT_ANIMATION_ACTION_ROOT_PATH,
  parseLivePlotAnimationActionRecord,
  parsePlotAnimationActionIndex,
} from "../src/live-plot-animation-action";

const record = (overrides: Record<string, unknown> = {}) => ({
  activationRevision: 7,
  currentVersionId: "version-1",
  revision: 1,
  pageId: "page-1",
  elementId: "plot/[#]",
  targetBootId: "boot-a",
  action: "play",
  ...overrides,
});

describe("live Plot animation action parser", () => {
  it("uses the exact root and accepts all V1 actions", () => {
    expect(PLOT_ANIMATION_ACTION_ROOT_PATH).toBe("live/plotAnimationAction");
    for (const action of ["play", "pause", "reset"] as const) {
      expect(parseLivePlotAnimationActionRecord(record({ action }))?.action).toBe(action);
    }
  });

  it("rejects malformed records and preserves canonical ids", () => {
    expect(parseLivePlotAnimationActionRecord(record())).toMatchObject({ elementId: "plot/[#]" });
    expect(parseLivePlotAnimationActionRecord(record({ action: "restart" }))).toBeNull();
    expect(parseLivePlotAnimationActionRecord(record({ revision: 0 }))).toBeNull();
    expect(parseLivePlotAnimationActionRecord(record({ revision: 1.5 }))).toBeNull();
    expect(parseLivePlotAnimationActionRecord({ ...record(), extra: true })).toBeNull();
    expect(parseLivePlotAnimationActionRecord({ ...record(), pageId: " " })).toBeNull();
    expect(parseLivePlotAnimationActionRecord({ ...record(), elementId: "" })).toBeNull();
    expect(parseLivePlotAnimationActionRecord(record({ activationRevision: -1 }))).toBeNull();
    expect(parseLivePlotAnimationActionRecord(record({ activationRevision: 1.5 }))).toBeNull();
    expect(parseLivePlotAnimationActionRecord(record({ currentVersionId: " " }))).toBeNull();
    expect(parseLivePlotAnimationActionRecord(record({ targetBootId: " " }))).toBeNull();
    const fields = ["activationRevision", "currentVersionId", "revision", "pageId", "elementId", "targetBootId", "action"] as const;
    for (const field of fields) {
      const missing = { ...record() };
      delete missing[field];
      expect(parseLivePlotAnimationActionRecord(missing)).toBeNull();
    }
  });

  it("accepts only canonical non-negative decimal slot keys", () => {
    expect(parsePlotAnimationActionIndex("0")).toBe(0);
    expect(parsePlotAnimationActionIndex("42")).toBe(42);
    for (const key of ["01", "-1", "1.5", "", "plot"]) expect(parsePlotAnimationActionIndex(key)).toBeNull();
  });
});
