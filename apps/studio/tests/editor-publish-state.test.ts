import { describe, expect, it } from "vitest";

import type { Presentation } from "@powershow/document-schema";

import {
  createInitialEditorPublishState,
  editorPublishReducer,
  isPublishEnabled,
  resolvePublishButtonLabelStatus,
} from "../src/features/editor/editor-publish-state";

function makePresentation(id: string): Presentation {
  const snapshot = {} as Presentation;
  Object.defineProperty(snapshot, "id", { value: id, enumerable: true });
  return snapshot;
}

describe("editor publish-state", () => {
  it("blocks publish when an onPublish callback is absent", () => {
    expect(
      isPublishEnabled(createInitialEditorPublishState(), "clean", false),
    ).toBe(false);
  });

  it("blocks publish while the draft is dirty or saving", () => {
    const state = createInitialEditorPublishState();

    expect(isPublishEnabled(state, "dirty", true)).toBe(false);
    expect(isPublishEnabled(state, "saving", true)).toBe(false);
    expect(isPublishEnabled(state, "error", true)).toBe(false);
  });

  it("allows publish when the draft is clean", () => {
    expect(
      isPublishEnabled(createInitialEditorPublishState(), "clean", true),
    ).toBe(true);
  });

  it("blocks publish after a successful publish of the same snapshot", () => {
    const a = makePresentation("a");
    const success = editorPublishReducer(createInitialEditorPublishState(), {
      type: "publish-success",
      presentation: a,
    });

    expect(isPublishEnabled(success, "clean", true)).toBe(false);
  });

  it("allows error + clean for an explicit retry", () => {
    const error = editorPublishReducer(createInitialEditorPublishState(), {
      type: "publish-error",
    });

    expect(isPublishEnabled(error, "clean", true)).toBe(true);
  });

  it("blocks a duplicate publish while publishing is in flight", () => {
    const publishing = editorPublishReducer(createInitialEditorPublishState(), {
      type: "publish-start",
    });

    expect(isPublishEnabled(publishing, "clean", true)).toBe(false);
  });

  it("tracks success against the exact snapshot", () => {
    const a = makePresentation("a");
    const b = makePresentation("b");
    const success = editorPublishReducer(createInitialEditorPublishState(), {
      type: "publish-success",
      presentation: a,
    });

    expect(resolvePublishButtonLabelStatus(success, a)).toBe("success");
    expect(resolvePublishButtonLabelStatus(success, b)).toBe("idle");
  });

  it("returns to idle when the canonical root changes after success", () => {
    const a = makePresentation("a");
    const b = makePresentation("b");
    const success = editorPublishReducer(createInitialEditorPublishState(), {
      type: "publish-success",
      presentation: a,
    });
    const afterReset = editorPublishReducer(success, { type: "publish-reset" });

    expect(afterReset.status).toBe("idle");
    expect(afterReset.publishedPresentation).toBeNull();
    expect(resolvePublishButtonLabelStatus(afterReset, b)).toBe("idle");
    expect(isPublishEnabled(afterReset, "clean", true)).toBe(true);
  });

  it("allows retry after a failure", () => {
    const error = editorPublishReducer(createInitialEditorPublishState(), {
      type: "publish-error",
    });

    expect(error.status).toBe("error");
    expect(isPublishEnabled(error, "clean", true)).toBe(true);
  });

  it("never publishes automatically", () => {
    const initial = createInitialEditorPublishState();

    expect(initial.status).toBe("idle");
    expect(resolvePublishButtonLabelStatus(initial, makePresentation("a"))).toBe(
      "idle",
    );
  });
});
