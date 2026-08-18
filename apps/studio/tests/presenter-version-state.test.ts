import { describe, expect, it, vi } from "vitest";

import type { Presentation } from "@powershow/document-schema";

import {
  createBlankPresentation,
  createBlankSlide,
} from "../src/features/persistence/presentation-repository-instance";
import {
  PresenterVersionLoader,
  canUsePointerObservation,
  mapSlideAcrossVersions,
  projectPresenterVersions,
  resolveLiveSlideIndex,
} from "../src/features/control/presenter/presenter-version-state";

function presentation(ids: string[], title = "Presentation"): Presentation {
  return {
    ...createBlankPresentation("presentation-1", title),
    slides: ids.map((id) => createBlankSlide(id)),
  };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

describe("presenter slide mapping", () => {
  it("does not use an older pointer observation after Live changes version", () => {
    expect(
      canUsePointerObservation("version-1", "version-4", "version-3"),
    ).toBe(false);
    expect(
      canUsePointerObservation("version-4", "version-4", "version-5"),
    ).toBe(true);
    expect(
      canUsePointerObservation("version-1", "version-4", "version-4"),
    ).toBe(true);
  });

  it("does not report structural change for content-only publication", () => {
    const oldPresentation = presentation(["a", "b", "c"], "Old content");
    const newPresentation = presentation(["a", "b", "c"], "New content");

    expect(mapSlideAcrossVersions(oldPresentation, newPresentation, 1)).toEqual({
      index: 1,
      structuralChange: false,
      projectedSlideRemoved: false,
    });
  });

  it("maps the logical slide after insertion", () => {
    expect(
      mapSlideAcrossVersions(
        presentation(["a", "b", "c"]),
        presentation(["a", "inserted", "b", "c"]),
        1,
      ),
    ).toEqual({
      index: 2,
      structuralChange: true,
      projectedSlideRemoved: false,
    });
  });

  it("maps the logical slide after reorder", () => {
    expect(
      mapSlideAcrossVersions(
        presentation(["a", "b", "c"]),
        presentation(["c", "a", "b"]),
        2,
      ),
    ).toEqual({
      index: 0,
      structuralChange: true,
      projectedSlideRemoved: false,
    });
  });

  it("uses a clamped fallback and marks removal of the projected slide", () => {
    expect(
      mapSlideAcrossVersions(
        presentation(["a", "b", "c"]),
        presentation(["a"]),
        2,
      ),
    ).toEqual({
      index: 0,
      structuralChange: true,
      projectedSlideRemoved: true,
    });
  });

  it("reports removal without the stronger warning when another slide was removed", () => {
    expect(
      mapSlideAcrossVersions(
        presentation(["a", "b", "c"]),
        presentation(["a", "c"]),
        0,
      ),
    ).toEqual({
      index: 0,
      structuralChange: true,
      projectedSlideRemoved: false,
    });
  });

  it("reconstructs pending state from persisted live and pointer identities", () => {
    const projection = projectPresenterVersions(
      {
        publicationId: "publication-1",
        liveVersionId: "version-1",
        previewVersionId: "version-4",
        livePresentation: presentation(["a", "b"]),
        previewPresentation: presentation(["inserted", "a", "b"]),
      },
      1,
    );

    expect(projection.displayIndex).toBe(2);
    expect(projection.pendingVersion).toEqual({
      targetVersionId: "version-4",
      structuralChange: true,
      projectedSlideRemoved: false,
    });
  });

  it("resolves a known desired pageId to its index in the Live presentation", () => {
    expect(
      resolveLiveSlideIndex(
        {
          publicationId: "publication-1",
          liveVersionId: "version-1",
          previewVersionId: "version-1",
          livePresentation: presentation(["page-a", "page-b", "page-c"]),
          previewPresentation: presentation(["page-a", "page-b", "page-c"]),
        },
        "page-b",
      ),
    ).toBe(1);
  });

  it("returns null for an unknown desired pageId instead of a numeric index", () => {
    expect(
      resolveLiveSlideIndex(
        {
          publicationId: "publication-1",
          liveVersionId: "version-1",
          previewVersionId: "version-1",
          livePresentation: presentation(["page-a", "page-b", "page-c"]),
          previewPresentation: presentation(["page-a", "page-b", "page-c"]),
        },
        "unknown-page",
      ),
    ).toBeNull();
  });

  it("returns null when no desired pageId is set", () => {
    expect(
      resolveLiveSlideIndex(
        {
          publicationId: "publication-1",
          liveVersionId: "version-1",
          previewVersionId: "version-1",
          livePresentation: presentation(["page-a", "page-b", "page-c"]),
          previewPresentation: presentation(["page-a", "page-b", "page-c"]),
        },
        null,
      ),
    ).toBeNull();
  });
});

describe("PresenterVersionLoader", () => {
  it("converges V2 -> V3 -> V4 to only the latest target", async () => {
    const v2 = deferred<Presentation | null>();
    const v3 = deferred<Presentation | null>();
    const v4 = deferred<Presentation | null>();
    const live = presentation(["a"]);
    const latest = presentation(["a", "d"]);
    const getVersion = vi.fn((_publicationId: string, versionId: string) => {
      if (versionId === "version-1") return Promise.resolve(live);
      if (versionId === "version-2") return v2.promise;
      if (versionId === "version-3") return v3.promise;
      return v4.promise;
    });
    const loader = new PresenterVersionLoader({ getVersion });

    const loadV2 = loader.load({
      publicationId: "publication-1",
      liveVersionId: "version-1",
      previewVersionId: "version-2",
    });
    const loadV3 = loader.load({
      publicationId: "publication-1",
      liveVersionId: "version-1",
      previewVersionId: "version-3",
    });
    const loadV4 = loader.load({
      publicationId: "publication-1",
      liveVersionId: "version-1",
      previewVersionId: "version-4",
    });

    v2.resolve(presentation(["a", "b"]));
    v3.resolve(presentation(["a", "c"]));
    v4.resolve(latest);

    await expect(loadV2).resolves.toBeNull();
    await expect(loadV3).resolves.toBeNull();
    await expect(loadV4).resolves.toMatchObject({
      previewVersionId: "version-4",
      previewPresentation: latest,
    });
  });

  it("suppresses an error from a stale async version load", async () => {
    const stale = deferred<Presentation | null>();
    const current = presentation(["a"]);
    const getVersion = vi.fn((_publicationId: string, versionId: string) =>
      versionId === "version-stale"
        ? stale.promise
        : Promise.resolve(current),
    );
    const loader = new PresenterVersionLoader({ getVersion });
    const staleLoad = loader.load({
      publicationId: "publication-1",
      liveVersionId: "version-current",
      previewVersionId: "version-stale",
    });
    const currentLoad = loader.load({
      publicationId: "publication-1",
      liveVersionId: "version-current",
      previewVersionId: "version-current",
    });

    stale.reject(new Error("late failure"));

    await expect(staleLoad).resolves.toBeNull();
    await expect(currentLoad).resolves.toMatchObject({
      previewVersionId: "version-current",
    });
  });
});
