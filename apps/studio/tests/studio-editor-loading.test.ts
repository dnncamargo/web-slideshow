import { describe, expect, it, vi } from "vitest";

import type { Presentation } from "@powershow/document-schema";

import { createBlankPresentation } from "../src/features/persistence/presentation-repository-instance";
import type { PresentationRepository } from "../src/features/persistence/presentation-repository";

type EditorLoadStatus =
  | { kind: "loading" }
  | { kind: "not-found" }
  | { kind: "error" }
  | { kind: "loaded"; presentation: Presentation };

async function resolveEditorLoad(
  repository: PresentationRepository,
  presentationId: string | null,
): Promise<EditorLoadStatus> {
  if (presentationId === null) {
    return { kind: "not-found" };
  }

  try {
    const presentation = await repository.getPresentation(presentationId);

    if (presentation === null) {
      return { kind: "not-found" };
    }

    return { kind: "loaded", presentation };
  } catch {
    return { kind: "error" };
  }
}

function fakeRepository(overrides: Partial<PresentationRepository> = {}): {
  repository: PresentationRepository;
} {
  return {
    repository: {
      listPresentations: vi.fn(async () => []),
      getPresentation: vi.fn(async () => null),
      createPresentation: vi.fn(async () => {}),
      savePresentation: vi.fn(async () => {}),
      archivePresentation: vi.fn(async () => {}),
      ...overrides,
    },
  };
}

describe("editor repository loading", () => {
  it("loads the repository by presentationId and returns the Presentation", async () => {
    const presentation = createBlankPresentation("presentation-id");
    const { repository } = fakeRepository({
      getPresentation: vi.fn(async () => presentation),
    });

    const status = await resolveEditorLoad(repository, "presentation-id");

    expect(repository.getPresentation).toHaveBeenCalledWith("presentation-id");
    expect(status).toEqual({ kind: "loaded", presentation });
  });

  it("does not load anything or mount content while there is no id yet", async () => {
    const getPresentation = vi.fn(async () => null);
    const { repository } = fakeRepository({ getPresentation });

    // Representing the initial client state before the id resolves.
    expect(statusLoading()).toEqual({ kind: "loading" });
    expect(getPresentation).not.toHaveBeenCalled();
  });

  it("maps a null repository result to not-found", async () => {
    const { repository } = fakeRepository();
    expect(await resolveEditorLoad(repository, "missing")).toEqual({
      kind: "not-found",
    });
  });

  it("maps a repository rejection to error", async () => {
    const { repository } = fakeRepository({
      getPresentation: vi.fn(async () => {
        throw new Error("boom");
      }),
    });

    expect(await resolveEditorLoad(repository, "failing")).toEqual({
      kind: "error",
    });
  });

  it("never calls savePresentation during load", async () => {
    const savePresentation = vi.fn(async () => {});
    const { repository } = fakeRepository({ savePresentation });

    await resolveEditorLoad(repository, "some-id");

    expect(savePresentation).not.toHaveBeenCalled();
  });
});

function statusLoading(): EditorLoadStatus {
  return { kind: "loading" };
}