import { describe, expect, it } from "vitest";

import {
  buildPlotAnimationActionPath,
  buildPlotAnimationActionRootPath,
  parseLivePlotAnimationActionRecord,
} from "../src/features/live/plot-animation-action";

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

describe("Plot animation action protocol", () => {
  it("builds the numeric slot path", () => {
    expect(buildPlotAnimationActionRootPath()).toBe("live/plotAnimationAction");
    expect(buildPlotAnimationActionPath(3)).toBe("live/plotAnimationAction/3");
    expect(() => buildPlotAnimationActionPath(1.5)).toThrow(/slot/);
    expect(() => buildPlotAnimationActionPath(-1)).toThrow(/slot/);
  });

  it("strictly parses V1 actions and preserves canonical ids", () => {
    for (const action of ["play", "pause", "reset"] as const) {
      expect(parseLivePlotAnimationActionRecord(record({ action }))?.action).toBe(action);
    }
    expect(parseLivePlotAnimationActionRecord(record({ action: "restart" }))).toBeNull();
    expect(parseLivePlotAnimationActionRecord({ ...record(), extra: true })).toBeNull();
    expect(parseLivePlotAnimationActionRecord(record({ revision: 0 }))).toBeNull();
    expect(parseLivePlotAnimationActionRecord(record({ revision: 1.5 }))).toBeNull();
    expect(parseLivePlotAnimationActionRecord(record({ elementId: "" }))).toBeNull();
    expect(parseLivePlotAnimationActionRecord(record({ elementId: "plot/[#]" }))).toMatchObject({ elementId: "plot/[#]" });
  });
});
