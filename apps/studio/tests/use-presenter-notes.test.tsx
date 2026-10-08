// @vitest-environment jsdom

import { act, useRef } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  PresentationSchema,
  type Presentation,
} from "@web-slideshow/document-schema";

import { getDefaultPresentationNotesRepository } from "../src/features/persistence/presentation-notes-repository-instance";
import type { PresentationNotes } from "../src/features/persistence/presentation-notes";
import type { PresentationNotesRepository } from "../src/features/persistence/presentation-notes-repository";
import { usePresenterNotes } from "../src/features/control/presenter/use-presenter-notes";

vi.mock(
  "../src/features/persistence/presentation-notes-repository-instance",
  () => ({
    getDefaultPresentationNotesRepository: vi.fn(),
  }),
);

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

const mockedGetDefaultRepository = vi.mocked(
  getDefaultPresentationNotesRepository,
);

function presentation(id: string): Presentation {
  return PresentationSchema.parse({
    schemaVersion: 1,
    id,
    title: id,
    slides: [{ id: "slide-1", title: "First" }],
  });
}

function NotesHookHarness({ target }: { target: Presentation | null }) {
  const state = usePresenterNotes(target);
  const stateRef = useRef(state);
  stateRef.current = state;
  return <output data-state>{state.kind}</output>;
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

describe("usePresenterNotes", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    document.body.innerHTML = "";
  });

  it("loads through one canonical read path and never writes", async () => {
    const notes: PresentationNotes = {
      bySlideId: {
        "slide-1": {
          text: "private legacy text",
          pointed: [{ id: "pointed-1", text: "pointed", x: 10, y: 20 }],
        },
      },
    };
    const repository: PresentationNotesRepository = {
      getNotes: vi.fn(async () => notes),
      setSlideNotes: vi.fn(async () => undefined),
    };
    mockedGetDefaultRepository.mockReturnValue(repository);

    act(() =>
      root.render(<NotesHookHarness target={presentation("canonical-id")} />),
    );
    await act(async () => Promise.resolve());

    expect(repository.getNotes).toHaveBeenCalledTimes(1);
    expect(repository.getNotes).toHaveBeenCalledWith("canonical-id");
    expect(repository.setSlideNotes).not.toHaveBeenCalled();
    expect(container.querySelector("[data-state]")?.textContent).toBe("ready");
  });

  it("rejects a stale result when the canonical presentation changes", async () => {
    const oldRead = deferred<PresentationNotes>();
    const newRead = deferred<PresentationNotes>();
    const repository: PresentationNotesRepository = {
      getNotes: vi.fn((id) =>
        id === "old-id" ? oldRead.promise : newRead.promise,
      ),
      setSlideNotes: vi.fn(async () => undefined),
    };
    mockedGetDefaultRepository.mockReturnValue(repository);

    act(() =>
      root.render(<NotesHookHarness target={presentation("old-id")} />),
    );
    act(() =>
      root.render(<NotesHookHarness target={presentation("new-id")} />),
    );

    await act(async () => {
      oldRead.resolve({ bySlideId: {} });
      await Promise.resolve();
    });
    expect(container.querySelector("[data-state]")?.textContent).toBe(
      "loading",
    );

    await act(async () => {
      newRead.resolve({ bySlideId: {} });
      await Promise.resolve();
    });
    expect(container.querySelector("[data-state]")?.textContent).toBe("ready");
    expect(repository.getNotes).toHaveBeenNthCalledWith(1, "old-id");
    expect(repository.getNotes).toHaveBeenNthCalledWith(2, "new-id");
    expect(repository.setSlideNotes).not.toHaveBeenCalled();
  });
});
