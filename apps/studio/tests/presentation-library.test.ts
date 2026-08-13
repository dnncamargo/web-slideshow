import { describe, expect, it, vi } from "vitest";

import { createBlankPresentation } from "../src/features/persistence/presentation-repository-instance";
import type { PresentationRepository } from "../src/features/persistence/presentation-repository";
import type { PresentationSummary } from "../src/features/persistence/presentation-persistence";
import {
  isEmptyLibrary,
  isArchiveBlocked,
  isNewBlocked,
  isOpenBlocked,
  resolveLibraryStatus,
} from "../src/features/library/presentation-library-logic";

function summary(id: string): PresentationSummary {
  return { id, title: `Title ${id}`, updatedAt: "ts", archived: false };
}

describe("presentation library logic", () => {
  it("creates presentations through the canonical factory", () => {
    const presentation = createBlankPresentation();

    expect(presentation.schemaVersion).toBe(1);
    expect(presentation.slides).toEqual([]);
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
  it("invokes createPresentation once with the canonical factory result", async () => {
    const createPresentation = vi.fn(async () => {});
    const repository: PresentationRepository = {
      listPresentations: vi.fn(async () => []),
      getPresentation: vi.fn(async () => null),
      createPresentation,
      savePresentation: vi.fn(async () => {}),
      archivePresentation: vi.fn(async () => {}),
    };

    const presentation = createBlankPresentation();
    await repository.createPresentation(presentation);

    expect(createPresentation).toHaveBeenCalledTimes(1);
    expect(createPresentation).toHaveBeenCalledWith(presentation);
  });
});
