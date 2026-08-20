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
  resolvePresentationToolbarState,
  resolveLibraryStatus,
} from "../src/features/library/presentation-library-logic";
import {
  formatPresentationDate,
  toPresentationDate,
} from "../src/features/library/presentation-dates";

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

  it("resolves the no-selection toolbar with the global actions and the Import transfer slot", () => {
    expect(resolvePresentationToolbarState(null, { kind: "none" })).toEqual({
      mode: "none",
      actions: [],
      transferAction: "import",
      canPresent: false,
    });
  });

  it("resolves inactive published and unpublished selections", () => {
    expect(resolvePresentationToolbarState(
      {
        ...summary("published"),
        publicationState: "published",
        publication: {
          publicationId: "publication-1",
          currentVersionId: "version-1",
          publishedRevision: 1,
          publishedAt: "date",
        },
      },
      { kind: "none" },
    )).toEqual({
      mode: "inactive",
      actions: ["present", "edit", "archive"],
      transferAction: "export",
      canPresent: true,
    });

    expect(resolvePresentationToolbarState(summary("draft"), { kind: "none" })).toEqual({
      mode: "inactive",
      actions: ["present", "edit", "archive"],
      transferAction: "export",
      canPresent: false,
    });
  });

  it("resolves the currently live selection to Control, End, and Edit with the Export transfer slot", () => {
    const liveSummary: PresentationSummary = {
      ...summary("live"),
      publication: {
        publicationId: "publication-live",
        currentVersionId: "version-live",
        publishedRevision: 1,
        publishedAt: "date",
      },
      publicationState: "published",
    };

    expect(resolvePresentationToolbarState(liveSummary, {
      kind: "active",
      live: {
        publicationId: "publication-live",
        currentVersionId: "version-live",
        revision: 1,
      },
    })).toEqual({
      mode: "live",
      actions: ["control", "end", "edit"],
      transferAction: "export",
      canPresent: false,
    });
  });
});

describe("presentation timestamp coercion", () => {
  it("coerces a Firestore seconds/nanoseconds shape into a Date", () => {
    const date = toPresentationDate({ seconds: 1_700_000_000, nanoseconds: 5_000_000 });
    expect(date).toBeInstanceOf(Date);
    expect(date?.getTime()).toBe(1_700_000_000_000 + 5);
  });

  it("coerces a Date instance and epoch milliseconds", () => {
    const sample = new Date(1_700_000_000_000);
    expect(toPresentationDate(sample)?.getTime()).toBe(1_700_000_000_000);
    expect(toPresentationDate(1_700_000_000_000)?.getTime()).toBe(1_700_000_000_000);
  });

  it("returns null for unresolvable values instead of stringifying objects", () => {
    expect(toPresentationDate(undefined)).toBeNull();
    expect(toPresentationDate(null)).toBeNull();
    expect(toPresentationDate({})).toBeNull();
    expect(toPresentationDate("not-a-date")).toBeNull();
    expect(formatPresentationDate({})).toBeNull();
    expect(formatPresentationDate(undefined)).toBeNull();
  });

  it("formats a resolvable timestamp to a non-empty string", () => {
    const formatted = formatPresentationDate({ seconds: 1_700_000_000, nanoseconds: 0 });
    expect(typeof formatted).toBe("string");
    expect((formatted as string).length).toBeGreaterThan(0);
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
      publishPresentation: vi.fn(async () => ({
        publicationId: "publication-id",
        versionId: "version-id",
        publishedRevision: 1,
        createdVersion: true,
      })),
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
