// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  onValue: vi.fn(),
  ref: vi.fn(),
}));

vi.mock("firebase/database", () => ({
  onValue: mocks.onValue,
  ref: mocks.ref,
}));

import {
  FULLSCREEN_REQUEST_PATH,
  parseFullscreenRequest,
  subscribeLiveFullscreenRequest,
} from "../src/live-fullscreen-request";
import type { PlayerController } from "../src/player";

function snapshot(value: unknown) {
  return { val: () => value };
}

function request(revision = 1) {
  return {
    activationRevision: 4,
    currentVersionId: "version-1",
    revision,
  };
}

describe("fullscreen request parsing", () => {
  it("parses the strict request shape and trims the version id", () => {
    expect(
      parseFullscreenRequest({
        activationRevision: 4,
        currentVersionId: " version-1 ",
        revision: 2,
      }),
    ).toEqual(request(2));
  });

  it.each([
    null,
    { activationRevision: 4, currentVersionId: "version-1", revision: 1, extra: true },
    { activationRevision: -1, currentVersionId: "version-1", revision: 1 },
    { activationRevision: 1.5, currentVersionId: "version-1", revision: 1 },
    { activationRevision: 4, currentVersionId: "   ", revision: 1 },
    { activationRevision: 4, currentVersionId: "version-1", revision: 0 },
    { activationRevision: 4, currentVersionId: "version-1", revision: 1.5 },
  ])("rejects malformed value %#", (value) => {
    expect(parseFullscreenRequest(value)).toBeNull();
  });
});

describe("subscribeLiveFullscreenRequest", () => {
  let root: HTMLElement;
  let fullscreenElement: PropertyDescriptor | undefined;

  beforeEach(() => {
    root = document.createElement("div");
    document.body.appendChild(root);
    fullscreenElement = Object.getOwnPropertyDescriptor(document, "fullscreenElement");
    Object.defineProperty(document, "fullscreenElement", {
      configurable: true,
      value: null,
    });
    mocks.onValue.mockReset();
    mocks.ref.mockReset();
    mocks.ref.mockImplementation((_database: unknown, path: string) => ({ path }));
    mocks.onValue.mockReturnValue(vi.fn());
  });

  afterEach(() => {
    if (fullscreenElement) {
      Object.defineProperty(document, "fullscreenElement", fullscreenElement);
    } else {
      Reflect.deleteProperty(document, "fullscreenElement");
    }
    document.body.replaceChildren();
  });

  function subscribe(controller: PlayerController = {
    next: vi.fn(),
    previous: vi.fn(),
    goTo: vi.fn(),
    setTransition: vi.fn(),
    setControlsOptions: vi.fn(),
    setGalleryActiveIndex: vi.fn(),
    setGalleryExpanded: vi.fn(),
    sendScriptedAction: vi.fn(),
    sendScriptedInput: vi.fn(),
    fullscreen: vi.fn().mockResolvedValue(undefined),
    getCurrentIndex: vi.fn(() => 0),
    destroy: vi.fn(),
  }) {
    const cleanup = subscribeLiveFullscreenRequest(
      {} as never,
      4,
      "version-1",
      controller,
      root,
    );
    const handler = mocks.onValue.mock.calls[0]?.[1] as (value: {
      val: () => unknown;
    }) => void;
    return { cleanup, controller, handler };
  }

  it("subscribes to the dedicated path and ignores stale identities", () => {
    const { handler, controller } = subscribe();

    expect(mocks.ref).toHaveBeenCalledWith({}, FULLSCREEN_REQUEST_PATH);
    handler(snapshot({ ...request(), activationRevision: 3 }));
    handler(snapshot({ ...request(), currentVersionId: "version-old" }));

    expect(root.querySelector("button")).toBeNull();
    expect(controller.fullscreen).not.toHaveBeenCalled();
  });

  it("shows one local affordance for a new revision without invoking fullscreen remotely", () => {
    const { handler, controller } = subscribe();

    handler(snapshot(request()));
    handler(snapshot(request()));

    expect(root.querySelectorAll("button")).toHaveLength(1);
    expect(root.textContent).toContain("Enter fullscreen");
    expect(controller.fullscreen).not.toHaveBeenCalled();
  });

  it("calls fullscreen only from the local affordance and dismisses after success", async () => {
    const { handler, controller } = subscribe();
    handler(snapshot(request()));

    (root.querySelector("button") as HTMLButtonElement).click();
    expect(controller.fullscreen).toHaveBeenCalledTimes(1);
    expect(root.querySelector("button")).not.toBeNull();

    await vi.waitFor(() => {
      expect(root.querySelector("button")).toBeNull();
    });

    handler(snapshot(request()));
    expect(root.querySelector("button")).toBeNull();
    handler(snapshot(request(2)));
    expect(root.querySelector("button")).not.toBeNull();
  });

  it("keeps rejected requests retryable", async () => {
    const controller: PlayerController = {
      next: vi.fn(),
      previous: vi.fn(),
      goTo: vi.fn(),
      setTransition: vi.fn(),
      setControlsOptions: vi.fn(),
      setGalleryActiveIndex: vi.fn(),
      setGalleryExpanded: vi.fn(),
      sendScriptedAction: vi.fn(),
      sendScriptedInput: vi.fn(),
      fullscreen: vi.fn()
        .mockRejectedValueOnce(new Error("denied"))
        .mockResolvedValueOnce(undefined),
      getCurrentIndex: vi.fn(() => 0),
      destroy: vi.fn(),
    };
    const { handler } = subscribe(controller);
    handler(snapshot(request()));
    const button = () => root.querySelector<HTMLButtonElement>("button");

    button()?.click();
    await Promise.resolve();
    expect(button()).not.toBeNull();

    button()?.click();
    await vi.waitFor(() => {
      expect(button()).toBeNull();
    });
    expect(controller.fullscreen).toHaveBeenCalledTimes(2);
  });

  it("does not prompt while the Player is already fullscreen", () => {
    Object.defineProperty(document, "fullscreenElement", {
      configurable: true,
      value: root,
    });
    const { handler, controller } = subscribe();

    handler(snapshot(request()));

    expect(root.querySelector("button")).toBeNull();
    expect(controller.fullscreen).not.toHaveBeenCalled();
  });

  it("removes the subscription and affordance during cleanup", () => {
    const unsubscribe = vi.fn();
    mocks.onValue.mockReturnValue(unsubscribe);
    const { cleanup, handler } = subscribe();
    handler(snapshot(request()));

    cleanup();

    expect(unsubscribe).toHaveBeenCalledTimes(1);
    expect(root.querySelector("button")).toBeNull();
  });
});
