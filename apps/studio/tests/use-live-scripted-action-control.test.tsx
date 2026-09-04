// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PresentationSchema, type Presentation } from "@powershow/document-schema";

const mocks = vi.hoisted(() => ({
  getRealtimeDatabaseOrNull: vi.fn(),
  writeScriptedAction: vi.fn(),
}));

vi.mock("../src/features/control/realtime-db", () => ({
  getRealtimeDatabaseOrNull: mocks.getRealtimeDatabaseOrNull,
}));
vi.mock("../src/features/control/control-command-writer", () => ({
  writeScriptedAction: mocks.writeScriptedAction,
}));

import {
  useLiveScriptedActionControl,
  type UseLiveScriptedActionControlResult,
} from "../src/features/control/use-live-scripted-action-control";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

const LIVE = { publicationId: "publication", currentVersionId: "version-1", revision: 2 };
const READY = { kind: "ready" as const, presence: { activationRevision: 2, currentVersionId: "version-1", bootId: "boot-1", stage: "ready" as const, transitionedAt: 1 } };

function presentation(elements: unknown[] = [], pageBElements: unknown[] = []): Presentation {
  return PresentationSchema.parse({ schemaVersion: 1, id: "presentation", title: "Presentation", slides: [{ id: "page-a", title: "Page A", elements }, { id: "page-b", title: "Page B", elements: pageBElements }] });
}

function scripted(id: string, title: string, ports: unknown[]) {
  return { id, type: "scripted", title, html: "", css: "", script: "", ports };
}

describe("useLiveScriptedActionControl", () => {
  let container: HTMLDivElement;
  let root: Root;
  let result: UseLiveScriptedActionControlResult | null;
  let input: Parameters<typeof useLiveScriptedActionControl>[0];

  function Harness() { result = useLiveScriptedActionControl(input); return null; }
  const render = async () => { await act(async () => { root.render(<Harness />); }); };

  beforeEach(async () => {
    container = document.createElement("div"); document.body.appendChild(container); root = createRoot(container); result = null;
    input = { live: LIVE, livePresentation: presentation([scripted("script-a", "Scroller", [{ id: "up", label: "Scroll up", kind: "action" }, { id: "enabled", label: "Enabled", kind: "boolean", direction: "input" }, { id: "down", label: "Scroll down", kind: "action" }])]), desiredPageId: "page-a", actualPageId: "page-a", controlSynced: true, playerStatus: READY, controlsBlocked: false };
    mocks.getRealtimeDatabaseOrNull.mockReturnValue({ database: true });
    mocks.writeScriptedAction.mockResolvedValue({});
    await render();
  });

  afterEach(async () => { await act(async () => root.unmount()); document.body.innerHTML = ""; vi.clearAllMocks(); });

  it("discovers only action ports in canonical Scripted traversal order and preserves real port indexes", async () => {
    input.livePresentation = presentation([{ id: "container", type: "container", children: [{ id: "text", type: "text", content: "ignored" }, scripted("first", "First", [{ id: "a", label: "A", kind: "action" }]), { id: "nested", type: "container", children: [scripted("second", "Second", [{ id: "flag", label: "Flag", kind: "boolean", direction: "input" }, { id: "b", label: "B", kind: "action" }])] }] }]);
    await render();
    expect(result?.groups).toEqual([
      { scriptedSlot: 0, elementId: "first", title: "First", actions: [{ portIndex: 0, portId: "a", label: "A" }] },
      { scriptedSlot: 1, elementId: "second", title: "Second", actions: [{ portIndex: 1, portId: "b", label: "B" }] },
    ]);
  });

  it("has no groups without the canonical desired slide or action ports", async () => {
    input.livePresentation = null; await render(); expect(result?.groups).toEqual([]);
    input.livePresentation = presentation([scripted("script-a", "Script", [{ id: "flag", label: "Flag", kind: "boolean", direction: "input" }])]); await render(); expect(result?.groups).toEqual([]);
  });

  it("writes the exact canonical action identity with the current ready Player boot id", async () => {
    await act(async () => { result?.triggerAction(0, 2); await Promise.resolve(); });
    expect(mocks.writeScriptedAction).toHaveBeenCalledWith({ database: true }, { activationRevision: 2, currentVersionId: "version-1", pageId: "page-a", scriptedSlot: 0, elementId: "script-a", portIndex: 2, portId: "down", targetBootId: "boot-1" });
  });

  it("permits repeated occurrences and refuses unsafe or stale action descriptors", async () => {
    let resolveWrite: (() => void) | undefined;
    mocks.writeScriptedAction.mockImplementation(() => new Promise<void>((resolve) => { resolveWrite = resolve; }));
    await act(async () => { result?.triggerAction(0, 0); result?.triggerAction(0, 0); result?.triggerAction(0, 0); });
    expect(mocks.writeScriptedAction).toHaveBeenCalledTimes(3);
    input = { ...input, controlSynced: false }; await render();
    await act(async () => { result?.triggerAction(0, 0); result?.triggerAction(9, 9); });
    expect(mocks.writeScriptedAction).toHaveBeenCalledTimes(3);
    await act(async () => { resolveWrite?.(); await Promise.resolve(); });
  });

  it.each([
    ["missing Live", { live: null }],
    ["missing desired page", { desiredPageId: null }],
    ["no Player report", { playerStatus: { kind: "no-report" } }],
    ["Player starting", { playerStatus: { kind: "starting", presence: { ...READY.presence, stage: "starting" } } }],
    ["Player load failure", { playerStatus: { kind: "load-failed", presence: { ...READY.presence, stage: "load-failed", errorCode: "presentation-load-failed" } } }],
    ["Player disconnected", { playerStatus: { kind: "disconnected", presence: READY.presence } }],
    ["Control syncing", { controlSynced: false }],
    ["wrong actual page", { actualPageId: "page-b" }],
    ["version promotion", { controlsBlocked: true }],
  ])("does not write when %s makes delivery unsafe", async (_name, unsafe) => {
    input = { ...input, ...unsafe } as typeof input;
    await render();
    expect(result?.actionsEnabled).toBe(false);
    await act(async () => { result?.triggerAction(0, 0); });
    expect(mocks.writeScriptedAction).not.toHaveBeenCalled();
  });

  it("reports a current-context write failure and clears it before a later eligible attempt", async () => {
    mocks.writeScriptedAction.mockRejectedValueOnce(new Error("offline"));
    await act(async () => { result?.triggerAction(0, 0); await Promise.resolve(); });
    expect(result?.sendFailed).toBe(true);
    let resolveWrite: (() => void) | undefined;
    mocks.writeScriptedAction.mockImplementationOnce(() => new Promise<void>((resolve) => { resolveWrite = resolve; }));
    await act(async () => { result?.triggerAction(0, 0); });
    expect(result?.sendFailed).toBe(false);
    await act(async () => { resolveWrite?.(); await Promise.resolve(); });
  });

  it("updates descriptors and boot identity, and ignores an old-context failure", async () => {
    let rejectOld: ((reason?: unknown) => void) | undefined;
    mocks.writeScriptedAction.mockImplementationOnce(() => new Promise((_, reject) => { rejectOld = reject; }));
    await act(async () => { result?.triggerAction(0, 0); });
    input = { ...input, desiredPageId: "page-b", actualPageId: "page-b", livePresentation: presentation([], [scripted("script-b", "Circuit", [{ id: "reset", label: "Reset", kind: "action" }])]), playerStatus: { ...READY, presence: { ...READY.presence, bootId: "boot-2" } } };
    await render();
    await act(async () => { rejectOld?.(new Error("offline")); await Promise.resolve(); });
    expect(result?.sendFailed).toBe(false);
    await act(async () => { result?.triggerAction(0, 0); await Promise.resolve(); });
    expect(mocks.writeScriptedAction).toHaveBeenLastCalledWith({ database: true }, expect.objectContaining({ pageId: "page-b", elementId: "script-b", portId: "reset", targetBootId: "boot-2" }));
  });
});
