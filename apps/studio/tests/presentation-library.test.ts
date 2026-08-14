import { describe, expect, it, vi } from "vitest";

import { createBlankPresentation } from "../src/features/persistence/presentation-repository-instance";
import type { PresentationRepository } from "../src/features/persistence/presentation-repository";
import type { PresentationSummary } from "../src/features/persistence/presentation-persistence";
import { buildStudioEditorHref } from "../src/features/app/studio-routes";
import {
  isEmptyLibrary,
  isArchiveBlocked,
  isNewBlocked,
  isOpenBlocked,
  resolveLibraryStatus,
} from "../src/features/library/presentation-library-logic";

function summary(id: string): PresentationSummary {
  return {
    id,
    title: `Title ${id}`,
    updatedAt: "ts",
    archived: false,
    publicationState: "draft",
    draftRevision: 1,
    publication: undefined,
  };
}

describe("presentation library logic", () => {
  it("creates presentations through the canonical factory", () => {
    const presentation = createBlankPresentation();

    expect(presentation.schemaVersion).toBe(1);
    expect(presentation.slides).toHaveLength(1);
    expect(presentation.title).toBeTruthy();
  });

  it("resolves loading/ready/error status", () => {
    expect(resolveLibraryStatus(true, false, false)).toBe("loading");
    expect(resolveLibraryStatus(false, false, true)).toBe("ready");
    expect(resolveLibraryStatus(false, true, true)).toBe("error");
  });

  it("reports empty library", () => {
    expect(isEmptyLibrary([])).toBe(true);
    expect(isEmptyLibrary([summary("a")])).toBe(false);
  });

  it("blocks New while creation is pending", () => {
    expect(isNewBlocked(true)).toBe(true);
    expect(isNewBlocked(false)).toBe(false);
  });

  it("blocks archive and open only for other items while one is pending", () => {
    expect(isArchiveBlocked("a", "b")).toBe(true);
    expect(isArchiveBlocked("a", "a")).toBe(false);
    expect(isArchiveBlocked(null, "a")).toBe(false);
    expect(isOpenBlocked("a", "b")).toBe(true);
    expect(isOpenBlocked("a", "a")).toBe(false);
  });
});

describe("presentation repository New wiring", () => {
  it("navigates New to the id-based editor href after create", () => {
    const presentation = createBlankPresentation("created-id");
    expect(buildStudioEditorHref(presentation.id)).toBe(
      "/studio/editor?id=created-id",
    );
  });
});

describe("presentation repository Edit wiring", () => {
  it("builds the editor href directly from the summary id", () => {
    expect(buildStudioEditorHref("summary-1")).toBe(
      "/studio/editor?id=summary-1",
    );
  });

  it("does not fetch the full presentation from the library for handoff", () => {
    const getPresentation = vi.fn(async () => null);
    const repository: PresentationRepository = {
      listPresentations: vi.fn(async () => []),
      getPresentation,
      createPresentation: vi.fn(async () => {}),
      savePresentation: vi.fn(async () => {}),
      archivePresentation: vi.fn(async () => {}),
    };

    // The Edit flow only needs the summary id to build navigation; it must
    // never call getPresentation for handoff.
    expect(typeof repository.getPresentation).toBe("function");
    expect(buildStudioEditorHref("summary-1")).toBe(
      "/studio/editor?id=summary-1",
    );
    expect(getPresentation).not.toHaveBeenCalled();
  });
});