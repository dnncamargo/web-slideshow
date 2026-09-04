// @vitest-environment jsdom

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ getDatabase: vi.fn(), onValue: vi.fn(), ref: vi.fn(), set: vi.fn() }));
vi.mock("firebase/database", () => ({ onValue: mocks.onValue, ref: mocks.ref, set: mocks.set }));
vi.mock("../src/features/control/realtime-db", () => ({ getRealtimeDatabaseOrNull: mocks.getDatabase }));
import { parseLiveSlideTransition, useLiveSlideTransitionControl, type UseLiveSlideTransitionControlResult } from "../src/features/control/use-live-slide-transition-control";

const LIVE = { publicationId: "publication", currentVersionId: "version-1", revision: 7 };
const NEXT_LIVE = { publicationId: "publication", currentVersionId: "version-1", revision: 8 };

describe("useLiveSlideTransitionControl", () => {
  let root: Root;
  let result: UseLiveSlideTransitionControlResult | null = null;
  let liveValue: { publicationId: string; currentVersionId: string; revision: number } | null = LIVE;

  function Harness() {
    result = useLiveSlideTransitionControl(liveValue);
    return null;
  }

  beforeEach(() => {
    liveValue = LIVE;
    const element = document.createElement("div");
    document.body.append(element);
    root = createRoot(element);
    mocks.getDatabase.mockReturnValue({});
    mocks.ref.mockImplementation((_db: unknown, path: string) => ({ path }));
    mocks.onValue.mockImplementation(() => vi.fn());
    mocks.set.mockResolvedValue(undefined);
    act(() => root.render(<Harness />));
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    document.body.replaceChildren();
    vi.clearAllMocks();
  });

  it("accepts exactly fade, slide, and none records", () => {
    expect(parseLiveSlideTransition({ activationRevision: 7, transition: "fade" })).toEqual({ activationRevision: 7, transition: "fade" });
    expect(parseLiveSlideTransition({ activationRevision: 7, transition: "slide" })).toEqual({ activationRevision: 7, transition: "slide" });
    expect(parseLiveSlideTransition({ activationRevision: 7, transition: "none" })).toEqual({ activationRevision: 7, transition: "none" });
    expect(parseLiveSlideTransition({ activationRevision: 7, transition: "zoom" })).toBeNull();
  });

  it("defaults malformed and stale snapshots to fade", () => {
    const callback = mocks.onValue.mock.calls[0]?.[1] as ((snapshot: { val(): unknown }) => void);
    act(() => callback?.({ val: () => ({ activationRevision: 6, transition: "slide" }) }));
    expect(result?.transition).toBe("fade");
    act(() => callback?.({ val: () => ({ transition: "none" }) }));
    expect(result?.transition).toBe("fade");
    act(() => callback?.({ val: () => null }));
    expect(result?.transition).toBe("fade");
  });

  it("writes fade as an exact two-field record", async () => {
    await act(async () => { result?.setTransition("fade"); await Promise.resolve(); });
    expect(mocks.set).toHaveBeenCalledWith({ path: "live/slideTransition" }, { activationRevision: 7, transition: "fade" });
  });

  it("writes slide as an exact two-field record", async () => {
    await act(async () => { result?.setTransition("slide"); await Promise.resolve(); });
    expect(mocks.set).toHaveBeenCalledWith({ path: "live/slideTransition" }, { activationRevision: 7, transition: "slide" });
  });

  it("writes none as an exact two-field record", async () => {
    await act(async () => { result?.setTransition("none"); await Promise.resolve(); });
    expect(mocks.set).toHaveBeenCalledWith({ path: "live/slideTransition" }, { activationRevision: 7, transition: "none" });
  });

  it("writes no currentVersionId or revision fields", async () => {
    await act(async () => { result?.setTransition("slide"); await Promise.resolve(); });
    const payload = mocks.set.mock.calls[0]?.[1] as Record<string, unknown>;
    expect(Object.keys(payload).sort()).toEqual(["activationRevision", "transition"]);
  });

  it("scopes write failure to the current activation", async () => {
    mocks.set.mockRejectedValueOnce(new Error("denied"));
    await act(async () => { result?.setTransition("slide"); await Promise.resolve(); await Promise.resolve(); });
    expect(result?.sendFailed).toBe(true);
    expect(result?.writeInFlight).toBe(false);
  });

  it("keeps a new activation write pending after an old-activation rejection", async () => {
    let rejectWrite!: (error: unknown) => void;
    let resolveNewWrite!: () => void;
    mocks.set.mockImplementationOnce(() => new Promise((_resolve, reject) => { rejectWrite = reject; }));
    act(() => { result?.setTransition("slide"); });
    expect(result?.writeInFlight).toBe(true);

    liveValue = NEXT_LIVE;
    act(() => root.render(<Harness />));
    expect(result?.sendFailed).toBe(false);
    expect(result?.writeInFlight).toBe(false);

    mocks.set.mockImplementationOnce(() => new Promise<void>((resolve) => { resolveNewWrite = resolve; }));
    act(() => { result?.setTransition("none"); });
    expect(result?.writeInFlight).toBe(true);

    await act(async () => rejectWrite(new Error("denied")));
    expect(result?.sendFailed).toBe(false);
    expect(result?.transition).toBe("fade");
    expect(result?.writeInFlight).toBe(true);

    act(() => { result?.setTransition("fade"); });
    expect(mocks.set).toHaveBeenCalledTimes(2);

    await act(async () => resolveNewWrite());
    expect(result?.writeInFlight).toBe(false);
  });

  it("fails closed on a second write while pending", async () => {
    mocks.set.mockImplementationOnce(() => new Promise(() => undefined));
    act(() => { result?.setTransition("slide"); });
    act(() => { result?.setTransition("none"); });
    expect(mocks.set).toHaveBeenCalledTimes(1);
  });
});
