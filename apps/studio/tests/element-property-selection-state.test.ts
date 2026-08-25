import { describe, expect, it } from "vitest";

import { toElementPropertySelectionMap } from "../src/features/editor/element-property-selection-state";

describe("toElementPropertySelectionMap", () => {
  it("includes true paths and excludes false paths", () => {
    const state = { "text-1": { variant: true, content: false } };

    expect(toElementPropertySelectionMap(state)).toEqual(
      new Map([["text-1", new Set(["variant"])] ]),
    );
  });

  it("preserves an explicit empty selection", () => {
    expect(
      toElementPropertySelectionMap({
        "text-1": { variant: false, content: false },
      }),
    ).toEqual(new Map([["text-1", new Set()]]));
  });

  it("keeps element selections independent", () => {
    expect(
      toElementPropertySelectionMap({
        "text-1": { variant: true },
        "image-1": { src: true, alt: false },
      }),
    ).toEqual(
      new Map([
        ["text-1", new Set(["variant"])],
        ["image-1", new Set(["src"])],
      ]),
    );
  });

  it("does not mutate its input", () => {
    const state = { "text-1": { variant: true } };
    const before = JSON.stringify(state);

    toElementPropertySelectionMap(state);

    expect(JSON.stringify(state)).toBe(before);
  });
});
