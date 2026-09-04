// @vitest-environment jsdom

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ getDatabase: vi.fn(), onValue: vi.fn(), ref: vi.fn(), set: vi.fn() }));
vi.mock("firebase/database", () => ({ onValue: mocks.onValue, ref: mocks.ref, set: mocks.set }));
vi.mock("../src/features/control/realtime-db", () => ({ getRealtimeDatabaseOrNull: mocks.getDatabase }));
import {
  parseLivePlayerControls,
  useLivePlayerControlsControl,
  LIVE_PLAYER_CONTROLS_BASELINE,
  type UseLivePlayerControlsControlResult,
} from "../src/features/control/use-live-player-controls-control";

const LIVE = { publicationId: "publication", currentVersionId: "version-1", revision: 7 };
const NEXT_LIVE = { publicationId: "publication", currentVersionId: "version-1", revision: 8 };

const HYDRATED = {
  activationRevision: 7,
  position: "top-left",
  style: "minimal",
  showCounter: false,
  animation: "slide",
} as const;

describe("useLivePlayerControlsControl", () => {
  let root: Root;
  let result: UseLivePlayerControlsControlResult | null = null;
  let liveValue: { publicationId: string; currentVersionId: string; revision: number } | null = LIVE;

  function Harness() {
    result = useLivePlayerControlsControl(liveValue);
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

  it("resolves the Live baseline by default", () => {
    expect(result?.controls).toEqual(LIVE_PLAYER_CONTROLS_BASELINE);
    expect(result?.controls.position).toBe("bottom-right");
    expect(result?.controls.style).toBe("compact");
    expect(result?.controls.showCounter).toBe(true);
    expect(result?.controls.animation).toBe("fade");
  });

  it("lets an exact hydrated record win", () => {
    const callback = mocks.onValue.mock.calls[0]?.[1] as ((snapshot: { val(): unknown }) => void);
    act(() => callback({ val: () => HYDRATED }));
    expect(result?.controls).toEqual({
      position: "top-left",
      style: "minimal",
      showCounter: false,
      animation: "slide",
    });
  });

  it("returns the baseline for stale or malformed records", () => {
    const callback = mocks.onValue.mock.calls[0]?.[1] as ((snapshot: { val(): unknown }) => void);
    act(() => callback({ val: () => ({ ...HYDRATED, activationRevision: 6 }) }));
    expect(result?.controls).toEqual(LIVE_PLAYER_CONTROLS_BASELINE);
    act(() => callback({ val: () => ({ position: "top-left" }) }));
    expect(result?.controls).toEqual(LIVE_PLAYER_CONTROLS_BASELINE);
    act(() => callback({ val: () => null }));
    expect(result?.controls).toEqual(LIVE_PLAYER_CONTROLS_BASELINE);
  });

  it("preserves untouched values on a partial setter", async () => {
    await act(async () => { result?.setControlsOptions({ position: "top-left" }); await Promise.resolve(); });
    expect(result?.controls).toEqual({
      position: "top-left",
      style: "compact",
      showCounter: true,
      animation: "fade",
    });
  });

  it("always writes a full exact five-field record", async () => {
    await act(async () => { result?.setControlsOptions({ position: "top-left" }); await Promise.resolve(); });
    const payload = mocks.set.mock.calls[0]?.[1] as Record<string, unknown>;
    expect(Object.keys(payload).sort()).toEqual([
      "activationRevision",
      "animation",
      "position",
      "showCounter",
      "style",
    ]);
    expect(payload.activationRevision).toBe(7);
    expect(payload.position).toBe("top-left");
    expect(payload.style).toBe("compact");
    expect(payload.showCounter).toBe(true);
    expect(payload.animation).toBe("fade");
  });

  it("writes a full record for a position update", async () => {
    await act(async () => { result?.setControlsOptions({ position: "bottom-right" }); await Promise.resolve(); });
    const payload = mocks.set.mock.calls[0]?.[1] as Record<string, unknown>;
    expect(payload).toEqual({
      activationRevision: 7,
      position: "bottom-right",
      style: "compact",
      showCounter: true,
      animation: "fade",
    });
  });

  it("writes a full record for a style update", async () => {
    await act(async () => { result?.setControlsOptions({ style: "minimal" }); await Promise.resolve(); });
    const payload = mocks.set.mock.calls[0]?.[1] as Record<string, unknown>;
    expect(payload).toEqual({
      activationRevision: 7,
      position: "bottom-right",
      style: "minimal",
      showCounter: true,
      animation: "fade",
    });
  });

  it("writes a full record for a showCounter update", async () => {
    await act(async () => { result?.setControlsOptions({ showCounter: false }); await Promise.resolve(); });
    const payload = mocks.set.mock.calls[0]?.[1] as Record<string, unknown>;
    expect(payload).toEqual({
      activationRevision: 7,
      position: "bottom-right",
      style: "compact",
      showCounter: false,
      animation: "fade",
    });
  });

  it("writes a full record for an animation update", async () => {
    await act(async () => { result?.setControlsOptions({ animation: "slide" }); await Promise.resolve(); });
    const payload = mocks.set.mock.calls[0]?.[1] as Record<string, unknown>;
    expect(payload).toEqual({
      activationRevision: 7,
      position: "bottom-right",
      style: "compact",
      showCounter: true,
      animation: "slide",
    });
  });

  it("fails closed on a second write while pending", async () => {
    mocks.set.mockImplementationOnce(() => new Promise(() => undefined));
    act(() => { result?.setControlsOptions({ position: "top-left" }); });
    act(() => { result?.setControlsOptions({ style: "minimal" }); });
    expect(result?.writeInFlight).toBe(true);
    expect(mocks.set).toHaveBeenCalledTimes(1);
  });

  it("scopes write failure to the current activation", async () => {
    mocks.set.mockRejectedValueOnce(new Error("denied"));
    await act(async () => { result?.setControlsOptions({ position: "top-left" }); await Promise.resolve(); await Promise.resolve(); });
    expect(result?.sendFailed).toBe(true);
    expect(result?.writeInFlight).toBe(false);
  });

  it("ignores an old-activation async failure", async () => {
    let rejectWrite!: (error: unknown) => void;
    mocks.set.mockImplementationOnce(() => new Promise((_resolve, reject) => { rejectWrite = reject; }));
    act(() => { result?.setControlsOptions({ position: "top-left" }); });
    expect(result?.writeInFlight).toBe(true);

    liveValue = NEXT_LIVE;
    act(() => root.render(<Harness />));
    expect(result?.sendFailed).toBe(false);
    expect(result?.writeInFlight).toBe(false);

    await act(async () => rejectWrite(new Error("denied")));
    expect(result?.sendFailed).toBe(false);
    expect(result?.controls).toEqual(LIVE_PLAYER_CONTROLS_BASELINE);
  });

  it("parses exact records and rejects partial or invalid ones", () => {
    expect(parseLivePlayerControls(HYDRATED)).toEqual(HYDRATED);
    expect(parseLivePlayerControls({ ...HYDRATED, position: "middle" })).toBeNull();
    expect(parseLivePlayerControls({ ...HYDRATED, showCounter: 1 })).toBeNull();
    expect(parseLivePlayerControls({ ...HYDRATED, revision: 1 })).toBeNull();
  });
});