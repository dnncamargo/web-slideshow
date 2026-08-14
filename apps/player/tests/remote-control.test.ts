import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  onValue: vi.fn(),
  ref: vi.fn(),
}));

vi.mock("firebase/database", () => ({
  onValue: mocks.onValue,
  ref: mocks.ref,
}));

import {
  createRemoteControlState,
  resolveRemoteCommand,
  subscribeRemoteControl,
  type RemoteControlState,
} from "../src/remote-control";
import type { PlayerController } from "../src/player";

function nextValue(revision: number) {
  return { action: "next", revision };
}

function previousValue(revision: number) {
  return { action: "previous", revision };
}

describe("remote control command resolution", () => {
  it("establishes the baseline on the first snapshot and does NOT navigate", () => {
    const state: RemoteControlState = createRemoteControlState();

    const decision = resolveRemoteCommand(nextValue(1), state);

    expect(decision.shouldNavigate).toBe(false);
    expect(decision.lastRevision).toBe(1);
  });

  it("navigates next once on a later command", () => {
    const state: RemoteControlState = { lastRevision: 1 };

    const decision = resolveRemoteCommand(nextValue(2), state);

    expect(decision.shouldNavigate).toBe(true);
    expect(decision.action).toBe("next");
    expect(decision.lastRevision).toBe(2);
  });

  it("navigates previous once on a later command", () => {
    const state: RemoteControlState = { lastRevision: 1 };

    const decision = resolveRemoteCommand(previousValue(2), state);

    expect(decision.shouldNavigate).toBe(true);
    expect(decision.action).toBe("previous");
    expect(decision.lastRevision).toBe(2);
  });

  it("ignores duplicate revisions (replay)", () => {
    const state: RemoteControlState = { lastRevision: 2 };

    const decision = resolveRemoteCommand(nextValue(2), state);

    expect(decision.shouldNavigate).toBe(false);
    expect(decision.lastRevision).toBe(2);
  });

  it("ignores unknown actions", () => {
    const state: RemoteControlState = { lastRevision: 1 };

    const decision = resolveRemoteCommand({ action: "jump", revision: 2 }, state);

    expect(decision.shouldNavigate).toBe(false);
  });

  it("ignores missing or non-numeric revisions", () => {
    const state: RemoteControlState = { lastRevision: 1 };

    expect(
      resolveRemoteCommand({ action: "next", revision: "x" }, state).shouldNavigate,
    ).toBe(false);
    expect(
      resolveRemoteCommand({ action: "next" }, state).shouldNavigate,
    ).toBe(false);
  });
});

describe("remote control subscription", () => {
  let unsubscribe: () => void;

  beforeEach(() => {
    unsubscribe = vi.fn();
    mocks.ref.mockImplementation((_db, path: string) => ({ path }));
    mocks.onValue.mockReturnValue(unsubscribe);
  });

  it("drives only the existing controller navigation and skips baseline", () => {
    const controller = {
      next: vi.fn(),
      previous: vi.fn(),
    } as unknown as PlayerController;

    const cleanup = subscribeRemoteControl({} as never, "pub-1", controller);

    // Capture the onValue callbacks: [0]=ref, [1]=snapshot callback, [2]=error callback
    const handler = mocks.onValue.mock.calls[0]?.[1];
    const errHandler = mocks.onValue.mock.calls[0]?.[2];

    // Baseline snapshot (revision 1) — no navigation
    const baseline = { val: () => nextValue(1) };
    (handler as (s: { val: () => unknown }) => unknown)(baseline);

    expect(controller.next).not.toHaveBeenCalled();
    expect(controller.previous).not.toHaveBeenCalled();

    // Next command (revision 2) — navigates
    const second = { val: () => nextValue(2) };
    (handler as (s: { val: () => unknown }) => unknown)(second);

    expect(controller.next).toHaveBeenCalledTimes(1);

    // Previous command (revision 3) — navigates
    const third = { val: () => previousValue(3) };
    (handler as (s: { val: () => unknown }) => unknown)(third);

    expect(controller.previous).toHaveBeenCalledTimes(1);

    cleanup();
    expect(unsubscribe).toHaveBeenCalledOnce();
    // errHandler should be a function (does not fail)
    expect(typeof errHandler).toBe("function");
  });
});
