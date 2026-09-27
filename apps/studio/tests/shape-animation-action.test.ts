import { describe, expect, it } from "vitest";

import {
  buildShapeAnimationActionPath,
  buildShapeAnimationActionRootPath,
  parseLiveShapeAnimationActionRecord,
} from "../src/features/live/shape-animation-action";

const record = (overrides: Record<string, unknown> = {}) => ({
  activationRevision: 7,
  currentVersionId: "version-1",
  revision: 1,
  pageId: "page-1",
  elementId: "shape/[#]",
  targetBootId: "boot-a",
  action: "play",
  ...overrides,
});

describe("Shape animation action protocol", () => {
  it("builds the independent numeric slot path", () => {
    expect(buildShapeAnimationActionRootPath()).toBe("live/shapeAnimationAction");
    expect(buildShapeAnimationActionPath(3)).toBe("live/shapeAnimationAction/3");
    expect(() => buildShapeAnimationActionPath(-1)).toThrow(/slot/);
    expect(() => buildShapeAnimationActionPath(1.5)).toThrow(/slot/);
  });

  it("strictly parses the exact record and normalizes transport identities", () => {
    expect(parseLiveShapeAnimationActionRecord({ ...record(), currentVersionId: " v ", pageId: " p ", targetBootId: " b " })).toMatchObject({ currentVersionId: "v", pageId: "p", targetBootId: "b", elementId: "shape/[#]" });
    for (const action of ["play", "pause", "reset"] as const) expect(parseLiveShapeAnimationActionRecord(record({ action }))?.action).toBe(action);
    expect(parseLiveShapeAnimationActionRecord({ ...record(), extra: true })).toBeNull();
    expect(parseLiveShapeAnimationActionRecord(record({ action: "restart" }))).toBeNull();
    expect(parseLiveShapeAnimationActionRecord(record({ revision: 0 }))).toBeNull();
    expect(parseLiveShapeAnimationActionRecord(record({ revision: 1.5 }))).toBeNull();
    expect(parseLiveShapeAnimationActionRecord(record({ activationRevision: -1 }))).toBeNull();
    for (const field of ["activationRevision", "currentVersionId", "revision", "pageId", "elementId", "targetBootId", "action"] as const) {
      const missing = { ...record() };
      delete missing[field];
      expect(parseLiveShapeAnimationActionRecord(missing)).toBeNull();
    }
  });
});
