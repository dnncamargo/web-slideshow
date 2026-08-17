import { describe, expect, it } from "vitest";

import {
  CONTROL_STATE_PATH,
  parseLiveControlState,
  parseLivePlayerState,
  PLAYER_STATE_PATH,
} from "../src/live-state";

describe("live-state path constants", () => {
  it("exposes the exact RTDB paths", () => {
    expect(CONTROL_STATE_PATH).toBe("live/controlState");
    expect(PLAYER_STATE_PATH).toBe("live/playerState");
  });
});

describe("parseLiveControlState", () => {
  it("accepts a well-formed control state", () => {
    expect(
      parseLiveControlState({
        activationRevision: 2,
        currentVersionId: "version-1",
        revision: 1,
        pageId: "page-a",
      }),
    ).toEqual({
      activationRevision: 2,
      currentVersionId: "version-1",
      revision: 1,
      pageId: "page-a",
    });
  });

  it("trims whitespace around strings", () => {
    expect(
      parseLiveControlState({
        activationRevision: 1,
        currentVersionId: "  version-1  ",
        revision: 2,
        pageId: "  page-b  ",
      }),
    ).toEqual({
      activationRevision: 1,
      currentVersionId: "version-1",
      revision: 2,
      pageId: "page-b",
    });
  });

  it("rejects an otherwise-valid state with an extra field", () => {
    expect(
      parseLiveControlState({
        activationRevision: 2,
        currentVersionId: "version-1",
        revision: 1,
        pageId: "page-a",
        extra: true,
      }),
    ).toBeNull();
  });

  it("rejects malformed values", () => {
    for (const value of [
      null,
      {},
      { activationRevision: 2, currentVersionId: "version-1", revision: 1 },
      { activationRevision: "x", currentVersionId: "version-1", revision: 1, pageId: "page-a" },
      { activationRevision: 2, currentVersionId: "", revision: 1, pageId: "page-a" },
      { activationRevision: 2, currentVersionId: "version-1", revision: 0, pageId: "page-a" },
      { activationRevision: 2, currentVersionId: "version-1", revision: -1, pageId: "page-a" },
      { activationRevision: 2, currentVersionId: "version-1", revision: 1.5, pageId: "page-a" },
      { activationRevision: 2, currentVersionId: "version-1", revision: 1, pageId: "" },
    ]) {
      expect(parseLiveControlState(value)).toBeNull();
    }
  });
});

describe("parseLivePlayerState", () => {
  it("accepts a well-formed player state", () => {
    expect(
      parseLivePlayerState({
        activationRevision: 2,
        currentVersionId: "version-1",
        appliedControlRevision: 3,
        pageId: "page-c",
        pageIndex: 2,
      }),
    ).toEqual({
      activationRevision: 2,
      currentVersionId: "version-1",
      appliedControlRevision: 3,
      pageId: "page-c",
      pageIndex: 2,
    });
  });

  it("accepts an appliedControlRevision of zero", () => {
    expect(
      parseLivePlayerState({
        activationRevision: 2,
        currentVersionId: "version-1",
        appliedControlRevision: 0,
        pageId: "page-a",
        pageIndex: 0,
      }),
    ).toEqual({
      activationRevision: 2,
      currentVersionId: "version-1",
      appliedControlRevision: 0,
      pageId: "page-a",
      pageIndex: 0,
    });
  });

  it("trims whitespace around strings", () => {
    expect(
      parseLivePlayerState({
        activationRevision: 1,
        currentVersionId: "  version-1  ",
        appliedControlRevision: 2,
        pageId: "  page-b  ",
        pageIndex: 3,
      }),
    ).toEqual({
      activationRevision: 1,
      currentVersionId: "version-1",
      appliedControlRevision: 2,
      pageId: "page-b",
      pageIndex: 3,
    });
  });

  it("rejects an otherwise-valid state with an extra field", () => {
    expect(
      parseLivePlayerState({
        activationRevision: 2,
        currentVersionId: "version-1",
        appliedControlRevision: 3,
        pageId: "page-c",
        pageIndex: 2,
        extra: true,
      }),
    ).toBeNull();
  });

  it("rejects malformed values", () => {
    for (const value of [
      null,
      {},
      { activationRevision: 2, appliedControlRevision: 3, pageId: "page-c", pageIndex: 2 },
      { activationRevision: "x", currentVersionId: "version-1", appliedControlRevision: 3, pageId: "page-c", pageIndex: 2 },
      { activationRevision: 2, currentVersionId: "", appliedControlRevision: 3, pageId: "page-c", pageIndex: 2 },
      { activationRevision: 2, currentVersionId: "version-1", appliedControlRevision: -1, pageId: "page-c", pageIndex: 2 },
      { activationRevision: 2, currentVersionId: "version-1", appliedControlRevision: 1.5, pageId: "page-c", pageIndex: 2 },
      { activationRevision: 2, currentVersionId: "version-1", appliedControlRevision: 3, pageId: "", pageIndex: 2 },
      { activationRevision: 2, currentVersionId: "version-1", appliedControlRevision: 3, pageId: "page-c", pageIndex: -1 },
      { activationRevision: 2, currentVersionId: "version-1", appliedControlRevision: 3, pageId: "page-c", pageIndex: 2.5 },
    ]) {
      expect(parseLivePlayerState(value)).toBeNull();
    }
  });
});