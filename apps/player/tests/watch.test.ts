// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { PresentationSchema, type Presentation } from "@powershow/document-schema";

import { playerTestPresentation } from "./fixtures/player-presentation";

const mocks = vi.hoisted(() => ({
  getRealtimeDatabaseOrNull: vi.fn(),
  loadPublishedVersion: vi.fn(),
  onValue: vi.fn(),
  ref: vi.fn(),
}));

vi.mock("firebase/database", () => ({
  onValue: mocks.onValue,
  ref: mocks.ref,
  set: vi.fn(),
}));

vi.mock("../src/realtime-db", () => ({
  getRealtimeDatabaseOrNull: mocks.getRealtimeDatabaseOrNull,
}));

vi.mock("../src/published-presentation-loader", () => ({
  loadPublishedVersion: mocks.loadPublishedVersion,
}));

import { startWatch } from "../src/watch-entry";

interface Snapshot {
  exists(): boolean;
  val(): unknown;
}

interface Subscription {
  path: string;
  callback: (snapshot: Snapshot) => void;
  errorCallback?: (error: unknown) => void;
  unsubscribe: ReturnType<typeof vi.fn>;
}

function snapshot(value: unknown, exists = true): Snapshot {
  return { exists: () => exists, val: () => value };
}

function live(overrides: Record<string, unknown> = {}) {
  return {
    publicationId: "publication-1",
    currentVersionId: "version-1",
    revision: 1,
    ...overrides,
  };
}

function playerState(overrides: Record<string, unknown> = {}) {
  return {
    activationRevision: 1,
    currentVersionId: "version-1",
    appliedControlRevision: 0,
    pageId: "slide-1",
    pageIndex: 0,
    ...overrides,
  };
}

function presentation(ids: string[]): Presentation {
  const firstSlide = playerTestPresentation.slides[0];
  if (!firstSlide) throw new Error("Player fixture has no slides.");

  return {
    ...playerTestPresentation,
    slides: ids.map((id) => ({ ...firstSlide, id })),
  };
}

function didacticWatchPresentation(): Presentation {
  return PresentationSchema.parse({
    ...playerTestPresentation,
    id: "watch-blocks",
    slides: [{
      id: "watch-blocks-slide",
      elements: [{
        type: "blocks",
        id: "watch-blocks-element",
        hidden: false,
        items: [
          { id: "watch-start", color: "#f97316", shape: "start", parts: [{ id: "watch-start-text", type: "text", text: "When flag clicked" }], children: [] },
          { id: "watch-statement", color: "#3b82f6", shape: "statement", parts: [{ id: "watch-move-text", type: "text", text: "move" }, { id: "watch-move-count", type: "socket", content: { type: "literal", value: "10" } }], children: [] },
          { id: "watch-scope", color: "#ef4444", shape: "scope", parts: [{ id: "watch-repeat-text", type: "text", text: "repeat" }], children: [{ id: "watch-child", color: "#3b82f6", shape: "statement", parts: [{ id: "watch-child-text", type: "text", text: "turn" }], children: [] }, { id: "watch-set-x", color: "#3b82f6", shape: "statement", parts: [{ id: "watch-set-x-text", type: "text", text: "set x to" }, { id: "watch-value-socket", type: "socket", content: { type: "block", block: { id: "watch-value", color: "#22c55e", shape: "value", parts: [{ id: "watch-value-text", type: "text", text: "x position" }], children: [] } } }], children: [] }] },
          { id: "watch-until", color: "#ef4444", shape: "scope", parts: [{ id: "watch-until-text", type: "text", text: "repeat until" }, { id: "watch-logic-socket", type: "socket", content: { type: "block", block: { id: "watch-logic", color: "#f59e0b", shape: "logic", parts: [{ id: "watch-logic-text", type: "text", text: "touching" }, { id: "watch-logic-target", type: "socket", content: { type: "literal", value: "Sprite2" } }], children: [] } } }], children: [] },
          { id: "watch-end", color: "#64748b", shape: "end", parts: [{ id: "watch-end-text", type: "text", text: "stop all" }], children: [] },
        ],
      }],
    }],
  });
}

describe("Player Watch runtime", () => {
  let root: HTMLElement;
  let controller: { destroy(): void };
  let subscriptions: Subscription[];

  beforeEach(() => {
    document.body.innerHTML = '<div id="app"></div>';
    root = document.querySelector<HTMLElement>("#app") as HTMLElement;
    subscriptions = [];

    mocks.getRealtimeDatabaseOrNull.mockReturnValue({});
    mocks.ref.mockImplementation((_database: unknown, path: string) => ({ path }));
    mocks.onValue.mockImplementation(
      (
        databaseRef: { path: string },
        callback: (snapshot: Snapshot) => void,
        errorCallback?: (error: unknown) => void,
      ) => {
        const subscription: Subscription = {
          path: databaseRef.path,
          callback,
          unsubscribe: vi.fn(),
        };
        if (errorCallback) subscription.errorCallback = errorCallback;
        subscriptions.push(subscription);
        return subscription.unsubscribe;
      },
    );
  });

  afterEach(() => {
    controller?.destroy();
    document.body.replaceChildren();
    vi.clearAllMocks();
  });

  function mount(): void {
    controller = startWatch(root);
  }

  function subscription(path: string): Subscription {
    const found = [...subscriptions].reverse().find((item) => item.path === path);
    if (!found) throw new Error(`No subscription for ${path}`);
    return found;
  }

  async function emitLive(value: unknown, exists = true): Promise<void> {
    subscription("live/current").callback(snapshot(value, exists));
    await Promise.resolve();
  }

  async function emitPlayer(value: unknown): Promise<void> {
    subscription("live/playerState").callback(snapshot(value));
    await Promise.resolve();
  }

  function renderedSlideId(): string | null {
    return root
      .querySelector<HTMLElement>("[data-powershow-slide-id]")
      ?.getAttribute("data-powershow-slide-id") ?? null;
  }

  it("shows no active presentation without subscribing to playerState", () => {
    mount();

    expect(root.textContent).toContain("Nenhuma apresentação ao vivo");
    expect(subscriptions.map(({ path }) => path)).toEqual(["live/current"]);
    expect(mocks.loadPublishedVersion).not.toHaveBeenCalled();
  });

  it("loads the exact live version and waits for the matching Player state", async () => {
    const loaded = presentation(["slide-1", "slide-2"]);
    mocks.loadPublishedVersion.mockResolvedValue({ kind: "ok", presentation: loaded });

    mount();
    await emitLive(live());

    expect(root.textContent).toContain("Aguardando Player");
    expect(mocks.loadPublishedVersion).toHaveBeenCalledWith(
      "publication-1",
      "version-1",
    );

    await emitPlayer(playerState());
    await vi.waitFor(() => expect(renderedSlideId()).toBe("slide-1"));
    expect(root.querySelector(".powershow-player-controls")).toBeNull();
  });

  it("delegates Watch Blocks rendering to the shared projection surface", async () => {
    const loaded = didacticWatchPresentation();
    mocks.loadPublishedVersion.mockResolvedValue({ kind: "ok", presentation: loaded });

    mount();
    await emitLive(live());
    await emitPlayer(playerState({ pageId: "watch-blocks-slide" }));
    await vi.waitFor(() => expect(renderedSlideId()).toBe("watch-blocks-slide"));

    const blocksRoot = root.querySelector<HTMLElement>('[data-powershow-type="blocks"]');
    const stack = blocksRoot?.querySelector<HTMLElement>(":scope > .powershow-blocks-stack");
    if (!blocksRoot || !stack) throw new Error("Watch Blocks projection was not rendered");
    expect(Array.from(stack.children).map((child) => child.getAttribute("data-powershow-block-id"))).toEqual([
      "watch-start", "watch-statement", "watch-scope", "watch-until", "watch-end",
    ]);
    for (const shape of ["start", "statement", "scope", "value", "logic", "end"]) {
      expect(blocksRoot.querySelector(`.powershow-block--${shape}`)).not.toBeNull();
    }
    expect(blocksRoot.textContent).toContain("Sprite2");
    expect(blocksRoot.querySelector('[data-powershow-part-id="watch-value-socket"] > [data-powershow-block-id="watch-value"]')).not.toBeNull();
    expect(blocksRoot.querySelector('[data-powershow-part-id="watch-logic-socket"] > [data-powershow-block-id="watch-logic"]')).not.toBeNull();
    expect(root.querySelectorAll("[onclick]")).toHaveLength(0);
  });

  it("uses pageId as authority, never pageIndex, and never observes controlState or writes RTDB", async () => {
    mocks.loadPublishedVersion.mockResolvedValue({
      kind: "ok",
      presentation: presentation(["slide-1", "slide-2"]),
    });

    mount();
    await emitLive(live());
    await emitPlayer(playerState({ pageId: "slide-2", pageIndex: 0 }));
    await vi.waitFor(() => expect(renderedSlideId()).toBe("slide-2"));

    expect(subscriptions.map(({ path }) => path)).toEqual([
      "live/current",
      "live/playerState",
    ]);
    expect(subscriptions.map(({ path }) => path)).not.toContain("live/controlState");
  });

  it("rejects stale identity and unknown page state without a pageIndex fallback", async () => {
    mocks.loadPublishedVersion.mockResolvedValue({
      kind: "ok",
      presentation: presentation(["slide-1", "slide-2"]),
    });

    mount();
    await emitLive(live());
    await emitPlayer(playerState({ activationRevision: 2, pageId: "slide-1" }));
    expect(root.textContent).toContain("Aguardando Player");
    expect(renderedSlideId()).toBeNull();

    await emitPlayer(playerState({ pageId: "missing", pageIndex: 0 }));
    expect(root.textContent).toContain("Aguardando Player");
    expect(renderedSlideId()).toBeNull();
  });

  it("shows the version error state", async () => {
    mocks.loadPublishedVersion.mockResolvedValue({ kind: "error" });

    mount();
    await emitLive(live());
    await emitPlayer(playerState());

    await vi.waitFor(() =>
      expect(root.textContent).toContain("Não foi possível carregar a apresentação."),
    );
  });

  it("ignores an old version load after live identity changes and removes the slide when Live ends", async () => {
    let resolveV1!: (result: unknown) => void;
    let resolveV2!: (result: unknown) => void;
    const v1 = new Promise<unknown>((resolve) => { resolveV1 = resolve; });
    const v2 = new Promise<unknown>((resolve) => { resolveV2 = resolve; });
    mocks.loadPublishedVersion.mockImplementation(
      (_publicationId: string, versionId: string) =>
        versionId === "version-2" ? v2 : v1,
    );

    mount();
    await emitLive(live());
    const oldPlayerSubscription = subscription("live/playerState");
    await emitPlayer(playerState());

    await emitLive(live({ currentVersionId: "version-2" }));
    await emitPlayer(
      playerState({ currentVersionId: "version-2", pageId: "slide-2", pageIndex: 0 }),
    );

    resolveV2({ kind: "ok", presentation: presentation(["slide-2"]) });
    await vi.waitFor(() => expect(renderedSlideId()).toBe("slide-2"));

    resolveV1({ kind: "ok", presentation: presentation(["slide-1"]) });
    await Promise.resolve();
    expect(renderedSlideId()).toBe("slide-2");

    oldPlayerSubscription.callback(snapshot(playerState({ pageId: "slide-1" })));
    expect(renderedSlideId()).toBe("slide-2");

    await emitLive(null, false);
    expect(root.textContent).toContain("Nenhuma apresentação ao vivo");
    expect(renderedSlideId()).toBeNull();
  });
});
