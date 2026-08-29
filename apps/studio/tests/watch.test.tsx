// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { Presentation } from "@powershow/document-schema";

import {
  createBlankPresentation,
  createBlankSlide,
} from "../src/features/persistence/presentation-repository-instance";
import type { LiveState } from "../src/features/control/live-current";

const mocks = vi.hoisted(() => ({
  getRealtimeDatabaseOrNull: vi.fn(),
  onValue: vi.fn(),
  ref: vi.fn(),
  subscribeLiveCurrent: vi.fn(),
  reader: {
    getVersion: vi.fn(),
    subscribePointer: vi.fn(),
  },
}));

// The firebase/database mock deliberately exposes only read primitives
// (onValue/ref/get). If the module under test imported a write primitive
// (set/update/runTransaction/push), this test module would fail to load, which
// is itself evidence that Watch performs no RTDB writes.
vi.mock("firebase/database", () => ({
  get: vi.fn(),
  onValue: mocks.onValue,
  ref: mocks.ref,
}));

vi.mock("../src/features/control/realtime-db", () => ({
  getRealtimeDatabaseOrNull: mocks.getRealtimeDatabaseOrNull,
}));

vi.mock("../src/features/control/live-current", () => ({
  subscribeLiveCurrent: mocks.subscribeLiveCurrent,
}));

vi.mock("../src/features/persistence/published-presentation-reader-instance", () => ({
  getDefaultPublishedPresentationReader: () => mocks.reader,
}));

import { WatchPage } from "../src/features/watch/watch-page";
import {
  useWatchSession,
  type WatchViewState,
} from "../src/features/watch/use-watch-session";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

const NO_LIVE_COPY = "Nenhuma apresentação ao vivo";
const WAITING_PLAYER_COPY = "Aguardando Player";

function snapshot(val: unknown) {
  return { val: () => val };
}

function playerState(overrides: Record<string, unknown> = {}) {
  return {
    activationRevision: 1,
    currentVersionId: "version-1",
    appliedControlRevision: 0,
    pageId: "page-a",
    pageIndex: 0,
    ...overrides,
  };
}

function liveState(overrides: Record<string, unknown> = {}): LiveState {
  const live = {
    publicationId: "publication-1",
    currentVersionId: "version-1",
    revision: 1,
    ...overrides,
  };
  return { kind: "active", live };
}

function presentation(
  slideIds: string[],
  id = "publication-1",
): Presentation {
  return {
    ...createBlankPresentation(id, "Watch Presentation"),
    slides: slideIds.map((slideId) => createBlankSlide(slideId)),
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

describe("Watch read model", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);

    mocks.getRealtimeDatabaseOrNull.mockReturnValue({});
    mocks.ref.mockImplementation((_db: unknown, path: string) => ({ path }));
    mocks.onValue.mockImplementation(() => vi.fn());
  });

  afterEach(async () => {
    await act(async () => {
      root.unmount();
    });
    document.body.innerHTML = "";
    vi.clearAllMocks();
  });

  async function mountWatch(): Promise<void> {
    await act(async () => {
      root.render(<WatchPage />);
    });
  }

  async function emitLive(state: LiveState): Promise<void> {
    const handler = mocks.subscribeLiveCurrent.mock.calls.at(-1)?.[0];
    if (!handler) {
      throw new Error("no live/current handler registered");
    }
    await act(async () => {
      handler(state);
    });
  }

  function playerHandler(): (snapshot: { val: () => unknown }) => void {
    const call = [...mocks.onValue.mock.calls]
      .reverse()
      .find((entry) => entry[0]?.path === "live/playerState");

    if (!call) {
      throw new Error("no live/playerState handler registered");
    }

    return call[1] as (snapshot: { val: () => unknown }) => void;
  }

  async function emitPlayer(value: unknown): Promise<void> {
    await act(async () => {
      playerHandler()(snapshot(value));
    });
  }

  function onValuePaths(): string[] {
    return mocks.onValue.mock.calls.map((entry) => entry[0]?.path ?? null);
  }

  function renderedSlideId(): string | null {
    return (
      container
        .querySelector("[data-powershow-slide-id]")
        ?.getAttribute("data-powershow-slide-id") ?? null
    );
  }

  function mockWatchViewport(width: number, height: number): () => void {
    const widthDescriptor = Object.getOwnPropertyDescriptor(
      HTMLElement.prototype,
      "clientWidth",
    );
    const heightDescriptor = Object.getOwnPropertyDescriptor(
      HTMLElement.prototype,
      "clientHeight",
    );

    Object.defineProperty(HTMLElement.prototype, "clientWidth", {
      configurable: true,
      get: () => width,
    });
    Object.defineProperty(HTMLElement.prototype, "clientHeight", {
      configurable: true,
      get: () => height,
    });

    return () => {
      if (widthDescriptor) {
        Object.defineProperty(HTMLElement.prototype, "clientWidth", widthDescriptor);
      } else {
        delete (HTMLElement.prototype as { clientWidth?: number }).clientWidth;
      }

      if (heightDescriptor) {
        Object.defineProperty(HTMLElement.prototype, "clientHeight", heightDescriptor);
      } else {
        delete (HTMLElement.prototype as { clientHeight?: number }).clientHeight;
      }
    };
  }

  it("B: no live/current shows the no-live state without touching playerState or the reader", async () => {
    await mountWatch();
    await emitLive({ kind: "none" });

    expect(container.textContent).toContain(NO_LIVE_COPY);
    expect(renderedSlideId()).toBeNull();
    expect(mocks.onValue).not.toHaveBeenCalled();
    expect(mocks.reader.getVersion).not.toHaveBeenCalled();
  });

  it("C: live V1 + matching playerState page-a loads the exact V1 version and renders page-a", async () => {
    mocks.reader.getVersion.mockResolvedValue(
      presentation(["page-a", "page-b"]),
    );

    await mountWatch();
    await emitLive(liveState());
    await emitPlayer(playerState());

    expect(mocks.reader.getVersion).toHaveBeenCalledWith(
      "publication-1",
      "version-1",
    );
    expect(renderedSlideId()).toBe("page-a");
    expect(container.textContent).not.toContain(WAITING_PLAYER_COPY);
  });

  it("fits the rendered 16:9 slide into the measured Watch viewport", async () => {
    const restoreViewport = mockWatchViewport(528, 318);
    try {
      mocks.reader.getVersion.mockResolvedValue(presentation(["page-a"]));

      await mountWatch();
      await emitLive(liveState());
      await emitPlayer(playerState());

      const stage = container.querySelector("main > div") as HTMLElement;
      const surface = stage.querySelector("div") as HTMLElement;

      expect(stage.style.width).toBe("480px");
      expect(stage.style.height).toBe("270px");
      expect(surface.style.width).toBe("960px");
      expect(surface.style.height).toBe("540px");
      expect(surface.style.transform).toBe("scale(0.5)");
    } finally {
      restoreViewport();
    }
  });

  it("fits the rendered 4:3 slide without changing its logical dimensions", async () => {
    const restoreViewport = mockWatchViewport(528, 408);
    try {
      mocks.reader.getVersion.mockResolvedValue(
        {
          ...presentation(["page-a"]),
          aspectRatio: "4:3",
        },
      );

      await mountWatch();
      await emitLive(liveState());
      await emitPlayer(playerState());

      const stage = container.querySelector("main > div") as HTMLElement;
      const surface = stage.querySelector("div") as HTMLElement;

      expect(stage.style.width).toBe("480px");
      expect(stage.style.height).toBe("360px");
      expect(surface.style.width).toBe("960px");
      expect(surface.style.height).toBe("720px");
      expect(surface.style.transform).toBe("scale(0.5)");
    } finally {
      restoreViewport();
    }
  });

  it("D: matching identity but no playerState stays on the waiting Player state", async () => {
    mocks.reader.getVersion.mockResolvedValue(
      presentation(["page-a", "page-b"]),
    );

    await mountWatch();
    await emitLive(liveState());

    expect(container.textContent).toContain(WAITING_PLAYER_COPY);
    expect(renderedSlideId()).toBeNull();

    await emitPlayer(null);

    expect(container.textContent).toContain(WAITING_PLAYER_COPY);
    expect(renderedSlideId()).toBeNull();
  });

  it("E: mismatched activationRevision never renders the stale page", async () => {
    mocks.reader.getVersion.mockResolvedValue(
      presentation(["page-a", "page-b"]),
    );

    await mountWatch();
    await emitLive(liveState());
    await emitPlayer(playerState({ activationRevision: 2 }));

    expect(container.textContent).toContain(WAITING_PLAYER_COPY);
    expect(renderedSlideId()).toBeNull();
  });

  it("F: mismatched currentVersionId never renders the stale page", async () => {
    mocks.reader.getVersion.mockResolvedValue(
      presentation(["page-a", "page-b"]),
    );

    await mountWatch();
    await emitLive(liveState());
    await emitPlayer(playerState({ currentVersionId: "other-version" }));

    expect(container.textContent).toContain(WAITING_PLAYER_COPY);
    expect(renderedSlideId()).toBeNull();
  });

  it("G: playerState pageId missing from the version shows the waiting state without a pageIndex fallback", async () => {
    mocks.reader.getVersion.mockResolvedValue(
      presentation(["page-a", "page-b"]),
    );

    await mountWatch();
    await emitLive(liveState());
    await emitPlayer(playerState({ pageId: "missing-page", pageIndex: 0 }));

    expect(container.textContent).toContain(WAITING_PLAYER_COPY);
    expect(renderedSlideId()).toBeNull();
  });

  it("H: desired/actual divergence renders only the actual playerState page and never subscribes to controlState", async () => {
    mocks.reader.getVersion.mockResolvedValue(
      presentation(["page-a", "page-b"]),
    );

    await mountWatch();
    await emitLive(liveState());
    await emitPlayer(playerState({ appliedControlRevision: 7 }));

    // controlState desired rev 8 / page-b is never observed by Watch.
    expect(renderedSlideId()).toBe("page-a");
    expect(onValuePaths()).toEqual(["live/playerState"]);
    expect(onValuePaths()).not.toContain("live/controlState");
  });

  it("I: playerState page-a -> page-b changes the rendered slide", async () => {
    mocks.reader.getVersion.mockResolvedValue(
      presentation(["page-a", "page-b"]),
    );

    await mountWatch();
    await emitLive(liveState());
    await emitPlayer(playerState());

    expect(renderedSlideId()).toBe("page-a");

    await emitPlayer(playerState({ pageId: "page-b", pageIndex: 1 }));

    expect(renderedSlideId()).toBe("page-b");
  });

  it("J: Watch never observes the public publication pointer", async () => {
    mocks.reader.getVersion.mockResolvedValue(
      presentation(["page-a", "page-b"]),
    );

    await mountWatch();
    await emitLive(liveState());
    await emitPlayer(playerState());

    expect(renderedSlideId()).toBe("page-a");
    expect(mocks.reader.subscribePointer).not.toHaveBeenCalled();
  });

  it("K: promotion V1 -> V2 loads the exact V2 version only after live/current changes to V2", async () => {
    mocks.reader.getVersion.mockImplementation(
      async (_publicationId: string, versionId: string) =>
        versionId === "version-2"
          ? presentation(["v2-a", "v2-b"])
          : presentation(["page-a", "page-b"]),
    );

    await mountWatch();
    await emitLive(liveState());
    await emitPlayer(playerState());

    expect(renderedSlideId()).toBe("page-a");
    expect(mocks.reader.getVersion).toHaveBeenCalledWith(
      "publication-1",
      "version-1",
    );

    // Control promotes live/current to V2 (activation revision is preserved).
    await emitLive(
      liveState({ currentVersionId: "version-2", revision: 1 }),
    );

    // Transient reset: no matching V2 playerState yet.
    expect(container.textContent).toContain(WAITING_PLAYER_COPY);

    await emitPlayer(
      playerState({
        currentVersionId: "version-2",
        pageId: "v2-a",
        pageIndex: 0,
      }),
    );

    expect(mocks.reader.getVersion).toHaveBeenCalledWith(
      "publication-1",
      "version-2",
    );
    expect(renderedSlideId()).toBe("v2-a");
  });

  it("L: a stale async V1 version load completing after V2 must not replace the V2 state", async () => {
    const v1Load = deferred<Presentation>();
    const v2Load = deferred<Presentation>();

    mocks.reader.getVersion.mockImplementation(
      (_publicationId: string, versionId: string) =>
        versionId === "version-2" ? v2Load.promise : v1Load.promise,
    );

    await mountWatch();
    await emitLive(liveState());
    await emitPlayer(playerState());

    // V1 version still loading; playerState V1 is usable but the version is
    // pending, so Watch stays on the loading state.
    expect(container.textContent).not.toContain(WAITING_PLAYER_COPY);

    // live/current moves to V2 before the V1 load finishes.
    await emitLive(liveState({ currentVersionId: "version-2", revision: 1 }));
    await emitPlayer(
      playerState({
        currentVersionId: "version-2",
        pageId: "v2-a",
        pageIndex: 0,
      }),
    );

    // V2 load completes first.
    await act(async () => {
      v2Load.resolve(presentation(["v2-a", "v2-b"]));
    });

    expect(renderedSlideId()).toBe("v2-a");

    // The stale V1 load completes afterwards and must be ignored.
    await act(async () => {
      v1Load.resolve(presentation(["page-a", "page-b"]));
    });

    expect(renderedSlideId()).toBe("v2-a");
    expect(container.querySelector('[data-powershow-slide-id="page-a"]')).toBe(
      null,
    );
  });

  it("regression: V1 -> V2 with the same logical pageId never resolves V2 against the retained V1 presentation while V2 is unresolved", async () => {
    const v2Load = deferred<Presentation>();
    const presentationV1 = presentation(["page-a", "page-b"], "publication-1");
    const presentationV2 = presentation(["page-a", "page-b"], "publication-1");

    mocks.reader.getVersion.mockImplementation(
      (_publicationId: string, versionId: string) =>
        versionId === "version-2"
          ? v2Load.promise
          : Promise.resolve(presentationV1),
    );

    // Record every derived state, including transient renders that React
    // produces between the identity change and the identity-keyed effects.
    const recorded: WatchViewState[] = [];
    function Harness() {
      const state = useWatchSession();
      recorded.push(state);
      return null;
    }

    function lastState(): WatchViewState {
      const state = recorded.at(-1);
      if (!state) {
        throw new Error("no recorded Watch state");
      }
      return state;
    }

    await act(async () => {
      root.render(<Harness />);
    });

    await emitLive(liveState());
    await emitPlayer(playerState());

    expect(lastState()).toMatchObject({ kind: "ready" });

    // Record only the V2-phase states from here on.
    recorded.length = 0;

    await emitLive(liveState({ currentVersionId: "version-2", revision: 1 }));
    await emitPlayer(
      playerState({
        currentVersionId: "version-2",
        pageId: "page-a",
        pageIndex: 0,
      }),
    );

    // While the V2 version is unresolved, no render may resolve against the
    // still-retained V1 presentation, even though both versions contain the
    // same logical pageId.
    for (const state of recorded) {
      if (state.kind === "ready") {
        expect(state.presentation).toBe(presentationV2);
      }
    }

    expect(lastState().kind).not.toBe("ready");
    expect(lastState().kind).toBe("loading-version");

    // Once V2 resolves, Watch renders V2's page-a.
    await act(async () => {
      v2Load.resolve(presentationV2);
    });

    const finalState = lastState();
    expect(finalState).toMatchObject({ kind: "ready", slide: { id: "page-a" } });
    if (finalState.kind === "ready") {
      expect(finalState.presentation).toBe(presentationV2);
    }
  });

  it("M: ending the Live session removes the prior slide and shows the no-live state", async () => {
    mocks.reader.getVersion.mockResolvedValue(
      presentation(["page-a", "page-b"]),
    );

    await mountWatch();
    await emitLive(liveState());
    await emitPlayer(playerState());

    expect(renderedSlideId()).toBe("page-a");

    await emitLive({ kind: "none" });

    expect(container.textContent).toContain(NO_LIVE_COPY);
    expect(renderedSlideId()).toBeNull();
  });

  it("N: a ready slide is reached using only read primitives, with no RTDB writes", async () => {
    mocks.reader.getVersion.mockResolvedValue(
      presentation(["page-a", "page-b"]),
    );

    await mountWatch();
    await emitLive(liveState());
    await emitPlayer(playerState());

    expect(renderedSlideId()).toBe("page-a");
    expect(mocks.onValue).toHaveBeenCalled();
    expect(onValuePaths()).toEqual(["live/playerState"]);
  });
});
