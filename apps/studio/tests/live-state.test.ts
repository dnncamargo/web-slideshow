import { describe, expect, it } from "vitest";

import { PresentationSchema } from "@powershow/document-schema";

import {
  buildControlStatePath,
  buildPlayerStatePath,
  parseLiveControlState,
  parseLivePlayerState,
} from "../src/features/live/live-state";
import { resolveLivePageId } from "../src/features/control/presenter/use-presenter-presentation";

describe("live-state path helpers", () => {
  it("exposes the exact RTDB paths", () => {
    expect(buildControlStatePath()).toBe("live/controlState");
    expect(buildPlayerStatePath()).toBe("live/playerState");
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

describe("resolveLivePageId", () => {
  it("resolves against the live presentation rather than the staged preview", () => {
    const state = {
      kind: "ready" as const,
      presentation: PresentationSchema.parse({
        schemaVersion: 1,
        id: "preview",
        title: "Preview",
        description: "",
        aspectRatio: "16:9",
        slides: [
          { id: "preview-a", title: "", summary: "", speakerNotes: "", elements: [] },
          { id: "preview-b", title: "", summary: "", speakerNotes: "", elements: [] },
        ],
      }),
      livePresentation: PresentationSchema.parse({
        schemaVersion: 1,
        id: "live",
        title: "Live",
        description: "",
        aspectRatio: "16:9",
        slides: [
          { id: "page-a", title: "", summary: "", speakerNotes: "", elements: [] },
          { id: "page-b", title: "", summary: "", speakerNotes: "", elements: [] },
          { id: "page-c", title: "", summary: "", speakerNotes: "", elements: [] },
        ],
      }),
      displayIndex: 1,
      pendingVersion: null,
    };

    expect(resolveLivePageId(state, 1)).toBe("page-b");
    expect(resolveLivePageId(state, 2)).toBe("page-c");
  });
});
