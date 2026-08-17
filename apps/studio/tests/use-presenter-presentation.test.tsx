// @vitest-environment jsdom

import { act, StrictMode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { Presentation } from "@powershow/document-schema";

import type { PresenterPresentationState } from "../src/features/control/presenter/use-presenter-presentation";
import type { PublishedPresentationPointer } from "../src/features/persistence/published-presentation-reader";
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

import { usePresenterPresentation } from "../src/features/control/presenter/use-presenter-presentation";

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
    vi.clearAllMocks();
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
        0,
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
      onPointer?.({ currentVersionId: "version-1", publishedRevision: 1 });
    });
    expect(state).toMatchObject({ kind: "ready", pendingVersion: null });

    await act(async () => {
      onPointer?.({ currentVersionId: "version-2", publishedRevision: 2 });
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
});
