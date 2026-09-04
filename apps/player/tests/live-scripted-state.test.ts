import { beforeEach, describe, expect, it, vi } from "vitest";
import { PresentationSchema } from "@powershow/document-schema";

const firebase = vi.hoisted(() => ({ ref: vi.fn(), set: vi.fn(), runTransaction: vi.fn() }));
vi.mock("firebase/database", () => firebase);

import {
  createLiveScriptedStatePublisher,
  parseLiveScriptedReportRecord,
  parseLiveScriptedRuntimeRecord,
  SCRIPTED_REPORT_ROOT_PATH,
  SCRIPTED_RUNTIME_ROOT_PATH,
} from "../src/live-scripted-state";

const presentation = PresentationSchema.parse({
  schemaVersion: 1, id: "p", title: "P", description: "", aspectRatio: "16:9", slides: [{
    id: "page", elements: [{ id: "outer", type: "container", children: [
      { id: "input", type: "scripted", title: "Input", html: "", css: "", script: "", ports: [{ id: "in", label: "In", kind: "boolean", direction: "input" }] },
      { id: "output", type: "scripted", title: "Output", html: "", css: "", script: "", ports: [{ id: "n", label: "N", kind: "number", direction: "output", step: 0.5 }, { id: "ready", label: "Ready", kind: "boolean", direction: "output" }, { id: "both", label: "Both", kind: "boolean", direction: "input-output" }] },
    ] }],
  }, { id: "page-b", elements: [] }],
});

function publisher(getCurrentPageId: () => string | null = () => "page") {
  let revision = 0;
  firebase.ref.mockImplementation((_db, path) => ({ path }));
  firebase.set.mockResolvedValue(undefined);
  firebase.runTransaction.mockImplementation(async (_ref, update) => update(null));
  return createLiveScriptedStatePublisher({ database: {} as never, activationRevision: 7, currentVersionId: "v", bootId: "boot", presentation, allocateMountRevision: () => ++revision, isCurrent: () => true, getCurrentPageId });
}

describe("live Scripted state publisher", () => {
  beforeEach(() => vi.clearAllMocks());

  it("strictly parses exact runtime and S7A report records", () => {
    expect(parseLiveScriptedRuntimeRecord({ activationRevision: 7, currentVersionId: " v ", mountRevision: 1, pageId: " p ", elementId: " id ", bootId: " boot " })).toEqual({ activationRevision: 7, currentVersionId: "v", mountRevision: 1, pageId: "p", elementId: " id ", bootId: "boot" });
    expect(parseLiveScriptedRuntimeRecord({ activationRevision: 7, currentVersionId: "v", mountRevision: 0, pageId: "p", elementId: "id", bootId: "boot" })).toBeNull();
    expect(parseLiveScriptedReportRecord({ activationRevision: 7, currentVersionId: "v", revision: 1, pageId: "p", elementId: "id", portId: "out", sourceBootId: "boot", mountRevision: 1, appliedInputRevision: 0, value: 0.12, extra: true })).toBeNull();
    expect(parseLiveScriptedReportRecord({ activationRevision: 7, currentVersionId: "v", revision: 1, pageId: "p", elementId: "id", portId: "out", sourceBootId: "boot", mountRevision: 1, appliedInputRevision: 1, value: true })).toMatchObject({ appliedInputRevision: 1 });
    expect(parseLiveScriptedReportRecord({ activationRevision: 7, currentVersionId: "v", revision: 1, pageId: "p", elementId: "id", portId: "out", sourceBootId: "boot", mountRevision: 1, appliedInputRevision: -1, value: true })).toBeNull();
    expect(parseLiveScriptedReportRecord({ activationRevision: 7, currentVersionId: "v", revision: 1, pageId: "p", elementId: "id", portId: "out", sourceBootId: "boot", mountRevision: 1, appliedInputRevision: 0.5, value: true })).toBeNull();
  });

  it("assigns every mount a Player-owned revision in canonical nested traversal order", () => {
    const state = publisher();
    state.onScriptedMount({ pageId: "page", elementId: "input" });
    state.onScriptedMount({ pageId: "page", elementId: "output" });
    expect(firebase.set).toHaveBeenNthCalledWith(1, { path: `${SCRIPTED_RUNTIME_ROOT_PATH}/0` }, expect.objectContaining({ mountRevision: 1, elementId: "input" }));
    expect(firebase.set).toHaveBeenNthCalledWith(2, { path: `${SCRIPTED_RUNTIME_ROOT_PATH}/1` }, expect.objectContaining({ mountRevision: 2, elementId: "output" }));
  });

  it("preserves finite output numbers without step quantization and starts reports at revision one", async () => {
    const state = publisher();
    state.onScriptedMount({ pageId: "page", elementId: "output" });
    state.onScriptedReport({ type: "powershow:scripted:report", elementId: "output", portId: "n", value: 0.12 });
    await vi.waitFor(() => expect(firebase.runTransaction).toHaveBeenCalledOnce());
    expect(firebase.runTransaction).toHaveBeenCalledWith({ path: `${SCRIPTED_REPORT_ROOT_PATH}/1/0` }, expect.any(Function));
    const update = firebase.runTransaction.mock.calls[0]?.[1] as (value: unknown) => unknown;
    expect(update(null)).toMatchObject({ revision: 1, mountRevision: 1, appliedInputRevision: 0, value: 0.12 });
  });

  it("publishes boolean output and input-output reports", async () => {
    const state = publisher();
    state.onScriptedMount({ pageId: "page", elementId: "output" });
    state.onScriptedReport({ type: "powershow:scripted:report", elementId: "output", portId: "ready", value: true });
    state.onScriptedReport({ type: "powershow:scripted:report", elementId: "output", portId: "both", value: false });
    await vi.waitFor(() => expect(firebase.runTransaction).toHaveBeenCalledTimes(2));
    expect(firebase.runTransaction.mock.calls.map(([target]) => target.path)).toEqual([
      `${SCRIPTED_REPORT_ROOT_PATH}/1/1`, `${SCRIPTED_REPORT_ROOT_PATH}/1/2`,
    ]);
  });

  it("correlates reports with the latest dispatched input for the exact mount and snapshots it at receipt", async () => {
    let resolveRuntime!: () => void;
    const state = publisher();
    firebase.set.mockReturnValue(new Promise<void>((resolve) => { resolveRuntime = resolve; }));
    state.onScriptedMount({ pageId: "page", elementId: "output" });
    state.markAppliedInput({ scriptedSlot: 1, portIndex: 2, pageId: "page", elementId: "output", portId: "both", mountRevision: 1, revision: 1 });
    state.onScriptedReport({ type: "powershow:scripted:report", elementId: "output", portId: "both", value: true });
    state.markAppliedInput({ scriptedSlot: 1, portIndex: 2, pageId: "page", elementId: "output", portId: "both", mountRevision: 1, revision: 2 });
    state.markAppliedInput({ scriptedSlot: 1, portIndex: 2, pageId: "page", elementId: "output", portId: "both", mountRevision: 1, revision: 1 });
    resolveRuntime();
    await vi.waitFor(() => expect(firebase.runTransaction).toHaveBeenCalledOnce());
    const firstUpdate = firebase.runTransaction.mock.calls[0]?.[1] as (value: unknown) => unknown;
    expect(firstUpdate(null)).toMatchObject({ appliedInputRevision: 1 });

    state.onScriptedReport({ type: "powershow:scripted:report", elementId: "output", portId: "both", value: false });
    await vi.waitFor(() => expect(firebase.runTransaction).toHaveBeenCalledTimes(2));
    const secondUpdate = firebase.runTransaction.mock.calls[1]?.[1] as (value: unknown) => unknown;
    expect(secondUpdate(null)).toMatchObject({ appliedInputRevision: 2 });
  });

  it("resets input correlation for a replacement mount and never applies it to output-only ports", async () => {
    const state = publisher();
    state.onScriptedMount({ pageId: "page", elementId: "output" });
    state.markAppliedInput({ scriptedSlot: 1, portIndex: 2, pageId: "page", elementId: "output", portId: "both", mountRevision: 1, revision: 3 });
    state.onScriptedMount({ pageId: "page", elementId: "output" });
    state.onScriptedReport({ type: "powershow:scripted:report", elementId: "output", portId: "both", value: true });
    state.onScriptedReport({ type: "powershow:scripted:report", elementId: "output", portId: "ready", value: true });
    await vi.waitFor(() => expect(firebase.runTransaction).toHaveBeenCalledTimes(2));
    for (const [, update] of firebase.runTransaction.mock.calls) {
      expect((update as (value: unknown) => unknown)(null)).toMatchObject({ mountRevision: 2, appliedInputRevision: 0 });
    }
  });

  it("increments reports in one runtime", async () => {
    const state = publisher();
    state.onScriptedMount({ pageId: "page", elementId: "output" });
    state.onScriptedReport({ type: "powershow:scripted:report", elementId: "output", portId: "n", value: 1 });
    state.onScriptedReport({ type: "powershow:scripted:report", elementId: "output", portId: "n", value: 2 });
    await vi.waitFor(() => expect(firebase.runTransaction).toHaveBeenCalledTimes(2));
    const update = firebase.runTransaction.mock.calls[1]?.[1] as (value: unknown) => unknown;
    expect(update({ activationRevision: 7, currentVersionId: "v", revision: 1, pageId: "page", elementId: "output", portId: "n", sourceBootId: "boot", mountRevision: 1, appliedInputRevision: 0, value: 1 })).toMatchObject({ revision: 2, value: 2 });
  });

  it("does not publish input-only reports", async () => {
    const state = publisher();
    state.onScriptedMount({ pageId: "page", elementId: "input" });
    state.onScriptedReport({ type: "powershow:scripted:report", elementId: "input", portId: "in", value: true });
    await Promise.resolve();
    expect(firebase.runTransaction).not.toHaveBeenCalled();
  });

  it("does not start a report transaction when the page changes before runtime publication", async () => {
    let resolveRuntime!: () => void;
    let page = "page";
    const state = publisher(() => page);
    firebase.set.mockReturnValue(new Promise<void>((resolve) => { resolveRuntime = resolve; }));
    state.onScriptedMount({ pageId: "page", elementId: "output" });
    state.onScriptedReport({ type: "powershow:scripted:report", elementId: "output", portId: "n", value: 1 });
    page = "page-b";
    resolveRuntime();
    await Promise.resolve();
    await Promise.resolve();
    expect(firebase.runTransaction).not.toHaveBeenCalled();
  });

  it("aborts a transaction updater when the page changes after runtime publication", async () => {
    let page = "page";
    let updater: ((value: unknown) => unknown) | undefined;
    const state = publisher(() => page);
    firebase.runTransaction.mockImplementation((_ref, update) => {
      updater = update;
      return Promise.resolve();
    });
    state.onScriptedMount({ pageId: "page", elementId: "output" });
    state.onScriptedReport({ type: "powershow:scripted:report", elementId: "output", portId: "n", value: 1 });
    await vi.waitFor(() => expect(firebase.runTransaction).toHaveBeenCalledOnce());
    page = "page-b";
    expect(updater?.(null)).toBeUndefined();
  });

  it("resets occurrence revision when a replacement mount reports", async () => {
    const state = publisher();
    state.onScriptedMount({ pageId: "page", elementId: "output" });
    state.onScriptedReport({ type: "powershow:scripted:report", elementId: "output", portId: "n", value: 1 });
    await vi.waitFor(() => expect(firebase.runTransaction).toHaveBeenCalledOnce());
    state.onScriptedMount({ pageId: "page", elementId: "output" });
    state.onScriptedReport({ type: "powershow:scripted:report", elementId: "output", portId: "n", value: 2 });
    await vi.waitFor(() => expect(firebase.runTransaction).toHaveBeenCalledTimes(2));
    const update = firebase.runTransaction.mock.calls[1]?.[1] as (value: unknown) => unknown;
    expect(update({ activationRevision: 7, currentVersionId: "v", revision: 8, pageId: "page", elementId: "output", portId: "n", sourceBootId: "boot", mountRevision: 1, appliedInputRevision: 0, value: 1 })).toMatchObject({ revision: 1, mountRevision: 2 });
  });

  it("allocates a new mount revision after navigating away and back in one boot", () => {
    const state = publisher();
    state.onScriptedMount({ pageId: "page", elementId: "output" });
    // page-b has no Scripted frame; returning to page mounts output again.
    state.onScriptedMount({ pageId: "page", elementId: "output" });
    expect(firebase.set.mock.calls.map(([, record]) => (record as { mountRevision: number }).mountRevision)).toEqual([1, 2]);
  });

  it("does not publish after a runtime write failure and emits only the runtime diagnostic", async () => {
    const onRuntimeWriteError = vi.fn();
    const onReportWriteError = vi.fn();
    firebase.set.mockRejectedValue(new Error("denied"));
    const state = createLiveScriptedStatePublisher({ database: {} as never, activationRevision: 7, currentVersionId: "v", bootId: "boot", presentation, allocateMountRevision: () => 1, isCurrent: () => true, getCurrentPageId: () => "page", onRuntimeWriteError, onReportWriteError });
    state.onScriptedMount({ pageId: "page", elementId: "output" });
    state.onScriptedReport({ type: "powershow:scripted:report", elementId: "output", portId: "n", value: 1 });
    await vi.waitFor(() => expect(onRuntimeWriteError).toHaveBeenCalledOnce());
    expect(firebase.runTransaction).not.toHaveBeenCalled();
    expect(onReportWriteError).not.toHaveBeenCalled();
  });
});
