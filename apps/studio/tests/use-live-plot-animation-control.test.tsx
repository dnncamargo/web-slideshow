// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ getRealtimeDatabaseOrNull: vi.fn(), writePlotAnimationAction: vi.fn() }));
vi.mock("../src/features/control/realtime-db", () => ({ getRealtimeDatabaseOrNull: mocks.getRealtimeDatabaseOrNull }));
vi.mock("../src/features/control/control-command-writer", () => ({ writePlotAnimationAction: mocks.writePlotAnimationAction }));

import {
  discoverLivePlotAnimationTargets,
  useLivePlotAnimationControl,
  type UseLivePlotAnimationControlResult,
} from "../src/features/control/use-live-plot-animation-control";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

const LIVE = { publicationId: "publication", currentVersionId: "version-1", revision: 7 };
const READY = { kind: "ready" as const, presence: { activationRevision: 7, currentVersionId: "version-1", bootId: "boot-a", stage: "ready" as const, transitionedAt: 1 } };
const plot = (id: string, source = "  y =   sin(x)  ", animation = true) => ({ id, type: "plot", source, ...(animation ? { animation: { parameter: "t", from: 0, to: 1, durationMs: 1000 } } : {}) });
const presentation = (elements: unknown[], pageB: unknown[] = []) => ({ slides: [{ id: "page-a", elements }, { id: "page-b", elements: pageB }] }) as never;

describe("useLivePlotAnimationControl", () => {
  let container: HTMLDivElement;
  let root: Root;
  let result: UseLivePlotAnimationControlResult | null;
  let input: Parameters<typeof useLivePlotAnimationControl>[0];
  function Harness() { result = useLivePlotAnimationControl(input); return null; }
  const render = async () => { await act(async () => root.render(<Harness />)); };

  beforeEach(async () => {
    container = document.createElement("div"); document.body.appendChild(container); root = createRoot(container); result = null;
    input = { live: LIVE, livePresentation: presentation([plot("plot-a")]), desiredPageId: "page-a", actualPageId: "page-a", controlSynced: true, controlsBlocked: false, playerStatus: READY };
    mocks.getRealtimeDatabaseOrNull.mockReturnValue({ database: true });
    mocks.writePlotAnimationAction.mockResolvedValue({});
    await render();
  });
  afterEach(async () => { await act(async () => root.unmount()); document.body.innerHTML = ""; vi.clearAllMocks(); });

  it("discovers animated Plots in deep canonical order and normalizes labels", () => {
    const targets = discoverLivePlotAnimationTargets(presentation([
      plot("a", " y =   sin(x) "),
      plot("static", "static", false),
      { id: "container", type: "container", children: [plot("b")] },
      { id: "table", type: "table", mode: "structured", columns: [{ id: "column", header: { id: "header", children: [plot("table-plot")] } }], rows: [{ id: "row", cells: [{ id: "cell", children: [plot("cell-plot")] }] }] },
      { id: "topics", type: "topics", items: [{ id: "item", content: { id: "content", children: [{ id: "nested", type: "container", children: [plot("topic-plot")] }] }, children: [] }] },
      plot("c", "z = sin(x+t) * cos(y)"),
    ]), "page-a");
    expect(targets.map(({ plotSlot, elementId, label }) => ({ plotSlot, elementId, label }))).toEqual([
      { plotSlot: 0, elementId: "a", label: "Plot 1 · y = sin(x)" },
      { plotSlot: 1, elementId: "b", label: "Plot 2 · y = sin(x)" },
      { plotSlot: 2, elementId: "table-plot", label: "Plot 3 · y = sin(x)" },
      { plotSlot: 3, elementId: "cell-plot", label: "Plot 4 · y = sin(x)" },
      { plotSlot: 4, elementId: "topic-plot", label: "Plot 5 · y = sin(x)" },
      { plotSlot: 5, elementId: "c", label: "Plot 6 · z = sin(x+t) * cos(y)" },
    ]);
  });

  it.each([
    ["no Live", { live: null }], ["no desired page", { desiredPageId: null }], ["wrong actual page", { actualPageId: "page-b" }],
    ["unsynced", { controlSynced: false }], ["blocked", { controlsBlocked: true }], ["not ready", { playerStatus: { kind: "starting", presence: READY.presence } }],
    ["wrong ready identity", { playerStatus: { kind: "ready", presence: { ...READY.presence, currentVersionId: "old" } } }],
    ["missing boot", { playerStatus: { kind: "ready", presence: { ...READY.presence, bootId: " " } } }],
  ])("disables writes for %s", async (_name, unsafe) => {
    input = { ...input, ...unsafe } as typeof input; await render();
    expect(result?.actionsEnabled).toBe(false);
    await act(async () => result?.triggerAction(result.plotTargets[0]!, "play"));
    expect(mocks.writePlotAnimationAction).not.toHaveBeenCalled();
  });

  it.each(["play", "pause", "reset"] as const)("writes the exact %s request", async (action) => {
    const target = result?.plotTargets[0]!;
    await act(async () => { result?.triggerAction(target, action); await Promise.resolve(); });
    expect(mocks.writePlotAnimationAction).toHaveBeenCalledWith({ database: true }, { activationRevision: 7, currentVersionId: "version-1", pageId: "page-a", targetBootId: "boot-a", plotSlot: 0, elementId: "plot-a", action });
  });

  it("prevents a duplicate pending target and sends all targets independently", async () => {
    let resolveFirst!: () => void;
    mocks.writePlotAnimationAction.mockImplementation((_, request) => request.plotSlot === 0 ? new Promise((resolve) => { resolveFirst = () => resolve({}); }) : Promise.resolve({}));
    input = { ...input, livePresentation: presentation([plot("plot-a"), plot("plot-b")]) }; await render();
    act(() => { result?.triggerAction(result.plotTargets[0]!, "play"); result?.triggerAction(result.plotTargets[0]!, "pause"); });
    expect(mocks.writePlotAnimationAction).toHaveBeenCalledTimes(1);
    act(() => result?.triggerAll("reset"));
    expect(mocks.writePlotAnimationAction).toHaveBeenCalledTimes(1);
    await act(async () => { resolveFirst(); await Promise.resolve(); });
    await act(async () => { result?.triggerAll("reset"); });
    expect(mocks.writePlotAnimationAction).toHaveBeenCalledTimes(3);
    expect(mocks.writePlotAnimationAction.mock.calls.slice(1).map((call) => call[1])).toEqual([
      expect.objectContaining({ plotSlot: 0, elementId: "plot-a", action: "reset" }),
      expect.objectContaining({ plotSlot: 1, elementId: "plot-b", action: "reset" }),
    ]);
  });

  it("attempts every all-action write and reports current-context failure without retry", async () => {
    mocks.writePlotAnimationAction.mockImplementation((_, request) => request.plotSlot === 0 ? Promise.reject(new Error("offline")) : Promise.resolve({}));
    input = { ...input, livePresentation: presentation([plot("plot-a"), plot("plot-b")]) }; await render();
    await act(async () => { result?.triggerAll("pause"); await Promise.resolve(); });
    expect(mocks.writePlotAnimationAction).toHaveBeenCalledTimes(2);
    expect(result?.sendFailed).toBe(true);
  });

  it("sends Play all, Pause all, and Reset all as ordinary per-target writes", async () => {
    input = { ...input, livePresentation: presentation([plot("plot-a"), plot("plot-b")]) }; await render();
    for (const action of ["play", "pause", "reset"] as const) {
      await act(async () => { result?.triggerAll(action); await Promise.resolve(); });
    }
    expect(mocks.writePlotAnimationAction).toHaveBeenCalledTimes(6);
    expect(mocks.writePlotAnimationAction.mock.calls.map((call) => call[1])).toEqual([
      expect.objectContaining({ plotSlot: 0, elementId: "plot-a", action: "play" }),
      expect.objectContaining({ plotSlot: 1, elementId: "plot-b", action: "play" }),
      expect.objectContaining({ plotSlot: 0, elementId: "plot-a", action: "pause" }),
      expect.objectContaining({ plotSlot: 1, elementId: "plot-b", action: "pause" }),
      expect.objectContaining({ plotSlot: 0, elementId: "plot-a", action: "reset" }),
      expect.objectContaining({ plotSlot: 1, elementId: "plot-b", action: "reset" }),
    ]);
  });

  it("ignores a late failure after page and boot context changes", async () => {
    let rejectOld!: (error: unknown) => void;
    mocks.writePlotAnimationAction.mockImplementationOnce(() => new Promise((_, reject) => { rejectOld = reject; }));
    await act(async () => result?.triggerAction(result.plotTargets[0]!, "play"));
    input = { ...input, desiredPageId: "page-b", actualPageId: "page-b", livePresentation: presentation([], [plot("plot-b")]), playerStatus: { ...READY, presence: { ...READY.presence, bootId: "boot-b" } } }; await render();
    await act(async () => { rejectOld(new Error("late")); await Promise.resolve(); });
    expect(result?.sendFailed).toBe(false);
    expect(result?.pendingPlotSlots.size).toBe(0);
  });
});
