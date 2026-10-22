// @vitest-environment jsdom

import { act, StrictMode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { Presentation } from "@web-slideshow/document-schema";

import type { PresenterPresentationState } from "../src/features/control/presenter/use-presenter-presentation";
import type { PublishedPresentationPointer } from "../src/features/persistence/published-presentation-reader";
import { FirestoreOperationError } from "../src/features/persistence/persistence-errors";
import {
  createBlankPresentation,
  createBlankSlide,
} from "../src/features/persistence/presentation-repository-instance";

const reader = vi.hoisted(() => ({
  getVersion: vi.fn(),
  subscribePointer: vi.fn(),
}));

vi.mock(
  "../src/features/persistence/published-presentation-reader-instance",
  () => ({
    getDefaultPublishedPresentationReader: () => reader,
  }),
);

import {
  resolveLivePageId,
  usePresenterPresentation,
} from "../src/features/control/presenter/use-presenter-presentation";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

const SLIDE_IDS = [
  "slide-mstp2tn0-x2p1fs",
  "slide",
  "slide-2",
  "slide-3",
];

function presentation(firstSlideColor: string): Presentation {
  return {
    ...createBlankPresentation("presentation-1"),
    slides: SLIDE_IDS.map((id, index) => ({
      ...createBlankSlide(id),
      ...(index === 0 ? { background: { color: firstSlideColor } } : {}),
    })),
  };
}
describe("usePresenterPresentation", () => {
  let container: HTMLDivElement;
  let root: Root;
  let onPointer:
    | ((pointer: PublishedPresentationPointer | null) => void)
    | null;
  let state: PresenterPresentationState | null;

  beforeEach(() => {
    container = document.createElement("div");
    root = createRoot(container);
    onPointer = null;
    state = null;
    reader.subscribePointer.mockImplementation(
      (
        _publicationId: string,
        nextPointer: (pointer: PublishedPresentationPointer | null) => void,
      ) => {
        onPointer = nextPointer;
        return vi.fn();
      },
    );
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it("recovers a transient published-version read without changing session identity or remounting", async () => {
    vi.useFakeTimers();
    const live = presentation("#ffd400");
    const offline = new FirestoreOperationError(
      "Failed to read published version.",
      Object.assign(new Error("client is offline"), { code: "unavailable" }),
    );
    reader.getVersion.mockRejectedValueOnce(offline).mockResolvedValue(live);

    function Harness() {
      state = usePresenterPresentation(
        {
          kind: "active",
          live: {
            publicationId: "publication-1",
            currentVersionId: "version-1",
            revision: 13,
          },
        },
        SLIDE_IDS[0]!,
      );
      return null;
    }

    await act(async () => root.render(<Harness />));
    expect(state).toMatchObject({ kind: "loading" });
    expect(reader.getVersion).toHaveBeenCalledTimes(1);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(500);
    });

    expect(state).toMatchObject({
      kind: "ready",
      livePresentation: live,
      presentation: live,
    });
    expect(reader.getVersion).toHaveBeenCalledTimes(2);
    expect(reader.getVersion).toHaveBeenNthCalledWith(1, "publication-1", "version-1");
    expect(reader.getVersion).toHaveBeenNthCalledWith(2, "publication-1", "version-1");
  });

  it("keeps the final read failure in error state after the single retry is exhausted", async () => {
    vi.useFakeTimers();
    const offline = new FirestoreOperationError(
      "Failed to read published version.",
      Object.assign(new Error("client is offline"), { code: "unavailable" }),
    );
    reader.getVersion.mockRejectedValue(offline);

    function Harness() {
      state = usePresenterPresentation(
        {
          kind: "active",
          live: {
            publicationId: "publication-1",
            currentVersionId: "version-1",
            revision: 13,
          },
        },
        SLIDE_IDS[0]!,
      );
      return null;
    }

    await act(async () => root.render(<Harness />));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(500);
    });

    expect(state).toMatchObject({ kind: "error" });
    expect(reader.getVersion).toHaveBeenCalledTimes(2);
  });

  it("does not surface a replaced session's unavailable error after switching during retry wait", async () => {
    vi.useFakeTimers();
    const staleRead = deferred<Presentation | null>();
    const offline = new FirestoreOperationError(
      "Failed to read published version.",
      Object.assign(new Error("client is offline"), { code: "unavailable" }),
    );
    const current = presentation("#22d3ee");
    reader.getVersion.mockImplementation(
      (_publicationId: string, versionId: string) =>
        versionId === "version-old" ? staleRead.promise : Promise.resolve(current),
    );

    function Harness({ publicationId, versionId }: { publicationId: string; versionId: string }) {
      state = usePresenterPresentation(
        {
          kind: "active",
          live: { publicationId, currentVersionId: versionId, revision: 13 },
        },
        SLIDE_IDS[0]!,
      );
      return null;
    }

    await act(async () => root.render(<Harness publicationId="publication-old" versionId="version-old" />));
    await act(async () => {
      staleRead.reject(offline);
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(vi.getTimerCount()).toBe(1);

    await act(async () => root.render(<Harness publicationId="publication-new" versionId="version-new" />));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(500);
    });

    expect(state).toMatchObject({ kind: "ready", livePresentation: current });
    expect(reader.getVersion).toHaveBeenCalledTimes(2);
    expect(reader.getVersion).toHaveBeenCalledWith("publication-new", "version-new");
  });

  it("previews a content-only V2 pointer update without a structural warning", async () => {
    const v1 = presentation("#ffd400");
    const v2 = presentation("#22d3ee");
    reader.getVersion.mockImplementation(
      (_publicationId: string, versionId: string) =>
        Promise.resolve(versionId === "version-1" ? v1 : v2),
    );

    function Harness() {
      state = usePresenterPresentation(
        {
          kind: "active",
          live: {
            publicationId: "publication-1",
            currentVersionId: "version-1",
            revision: 13,
          },
        },
        SLIDE_IDS[0]!,
      );
      return null;
    }

    await act(async () =>
      root.render(
        <StrictMode>
          <Harness />
        </StrictMode>,
      ),
    );

    await act(async () => {
      onPointer?.({ ownerUid: "owner-a", currentVersionId: "version-1", publishedRevision: 1 });
    });
    expect(state).toMatchObject({ kind: "ready", pendingVersion: null });

    await act(async () => {
      onPointer?.({ ownerUid: "owner-a", currentVersionId: "version-2", publishedRevision: 2 });
    });

    expect(state).toMatchObject({
      kind: "ready",
      presentation: v2,
      pendingVersion: {
        targetVersionId: "version-2",
        structuralChange: false,
        projectedSlideRemoved: false,
      },
    });
  });

  it("resolves outgoing Live navigation pageId against the immutable V1 live presentation, not the reordered V2 preview", async () => {
    const v1 = {
      ...createBlankPresentation("presentation-1"),
      slides: ["A", "B", "C"].map((id) => createBlankSlide(id)),
    };
    const v2 = {
      ...createBlankPresentation("presentation-1"),
      slides: ["C", "A", "B"].map((id) => createBlankSlide(id)),
    };
    reader.getVersion.mockImplementation(
      (_publicationId: string, versionId: string) =>
        Promise.resolve(versionId === "version-1" ? v1 : v2),
    );

    function Harness() {
      state = usePresenterPresentation(
        {
          kind: "active",
          live: {
            publicationId: "publication-1",
            currentVersionId: "version-1",
            revision: 13,
          },
        },
        "B",
      );
      return null;
    }

    await act(async () =>
      root.render(
        <StrictMode>
          <Harness />
        </StrictMode>,
      ),
    );

    await act(async () => {
      onPointer?.({ ownerUid: "owner-a", currentVersionId: "version-2", publishedRevision: 2 });
    });

    if (state?.kind !== "ready") {
      throw new Error("expected ready state");
    }

    // The Control UI previews the reordered V2...
    expect(state.presentation.slides.map((slide) => slide.id)).toEqual([
      "C",
      "A",
      "B",
    ]);
    // ...but the outgoing command is still scoped to the owner Live current V1, so the
    // queued index 1 must resolve to V1's "B", never V2's "A".
    expect(state.livePresentation.slides.map((slide) => slide.id)).toEqual([
      "A",
      "B",
      "C",
    ]);
    expect(resolveLivePageId(state, 1)).toBe("B");
    expect(resolveLivePageId(state, 1)).not.toBe("A");
  });

  it("derives displayIndex from the canonical desiredPageId once the live Presentation loads", async () => {
    const live = {
      ...createBlankPresentation("presentation-1"),
      slides: ["page-a", "page-b", "page-c"].map((id) => createBlankSlide(id)),
    };
    const pending = deferred<Presentation | null>();
    reader.getVersion.mockReturnValue(pending.promise);

    function Harness() {
      state = usePresenterPresentation(
        {
          kind: "active",
          live: {
            publicationId: "publication-1",
            currentVersionId: "version-1",
            revision: 13,
          },
        },
        "page-b",
      );
      return null;
    }

    await act(async () =>
      root.render(
        <StrictMode>
          <Harness />
        </StrictMode>,
      ),
    );

    // The canonical desired pageId is already known, but the immutable
    // presentation is still loading.
    expect(state).toMatchObject({ kind: "loading" });

    // The Presentation finishes loading with page-b at index 1. No new
    // LiveControl/player/control event occurs.
    await act(async () => {
      pending.resolve(live);
    });

    expect(state).toMatchObject({
      kind: "ready",
      displayIndex: 1,
    });
  });

  it("keeps displayIndex null when the desiredPageId is absent from the live Presentation", async () => {
    const live = {
      ...createBlankPresentation("presentation-1"),
      slides: ["page-a", "page-b", "page-c"].map((id) => createBlankSlide(id)),
    };
    reader.getVersion.mockResolvedValue(live);

    function Harness() {
      state = usePresenterPresentation(
        {
          kind: "active",
          live: {
            publicationId: "publication-1",
            currentVersionId: "version-1",
            revision: 13,
          },
        },
        "unknown-page",
      );
      return null;
    }

    await act(async () =>
      root.render(
        <StrictMode>
          <Harness />
        </StrictMode>,
      ),
    );

    expect(state).toMatchObject({
      kind: "ready",
      displayIndex: null,
    });
  });

  it("maps the desired Live page by logical ID into the reordered V2 preview", async () => {
    const v1 = {
      ...createBlankPresentation("presentation-1"),
      slides: ["A", "B", "C"].map((id) => createBlankSlide(id)),
    };
    const v2 = {
      ...createBlankPresentation("presentation-1"),
      slides: ["C", "A", "B"].map((id) => createBlankSlide(id)),
    };
    reader.getVersion.mockImplementation(
      (_publicationId: string, versionId: string) =>
        Promise.resolve(versionId === "version-1" ? v1 : v2),
    );

    function Harness() {
      state = usePresenterPresentation(
        {
          kind: "active",
          live: {
            publicationId: "publication-1",
            currentVersionId: "version-1",
            revision: 13,
          },
        },
        "B",
      );
      return null;
    }

    await act(async () =>
      root.render(
        <StrictMode>
          <Harness />
        </StrictMode>,
      ),
    );

    await act(async () => {
      onPointer?.({ ownerUid: "owner-a", currentVersionId: "version-2", publishedRevision: 2 });
    });

    if (state?.kind !== "ready") {
      throw new Error("expected ready state");
    }

    // Desired "B" is resolved against the immutable V1 (index 1), then mapped
    // by logical ID into the reordered V2 where "B" sits at index 2.
    expect(state.presentation.slides.map((slide) => slide.id)).toEqual([
      "C",
      "A",
      "B",
    ]);
    expect(state.displayIndex).toBe(2);
    expect(state.pendingVersion).toMatchObject({
      targetVersionId: "version-2",
      structuralChange: true,
    });
  });
});

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}
