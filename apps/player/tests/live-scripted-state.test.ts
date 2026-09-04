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
      { id: "output", type: "scripted", title: "Output", html: "", css: "", script: "", ports: [{ id: "n", label: "N", kind: "number", direction: "output", step: 0.5 }] },
    ] }],
  }],
});

function publisher() {
  let revision = 0;
  firebase.ref.mockImplementation((_db, path) => ({ path }));
  firebase.set.mockResolvedValue(undefined);
  firebase.runTransaction.mockImplementation(async (_ref, update) => update(null));
  return createLiveScriptedStatePublisher({ database: {} as never, activationRevision: 7, currentVersionId: "v", bootId: "boot", presentation, allocateMountRevision: () => ++revision, isCurrent: () => true });
}

describe("live Scripted state publisher", () => {
  beforeEach(() => vi.clearAllMocks());

  it("strictly parses exact runtime and S7A report records", () => {
    expect(parseLiveScriptedRuntimeRecord({ activationRevision: 7, currentVersionId: " v ", mountRevision: 1, pageId: " p ", elementId: " id ", bootId: " boot " })).toEqual({ activationRevision: 7, currentVersionId: "v", mountRevision: 1, pageId: "p", elementId: " id ", bootId: "boot" });
    expect(parseLiveScriptedRuntimeRecord({ activationRevision: 7, currentVersionId: "v", mountRevision: 0, pageId: "p", elementId: "id", bootId: "boot" })).toBeNull();
    expect(parseLiveScriptedReportRecord({ activationRevision: 7, currentVersionId: "v", revision: 1, pageId: "p", elementId: "id", portId: "out", sourceBootId: "boot", mountRevision: 1, appliedInputRevision: 0, value: 0.12, extra: true })).toBeNull();
    expect(parseLiveScriptedReportRecord({ activationRevision: 7, currentVersionId: "v", revision: 1, pageId: "p", elementId: "id", portId: "out", sourceBootId: "boot", mountRevision: 1, appliedInputRevision: 1, value: true })).toBeNull();
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

  it("does not publish input-only reports", async () => {
    const state = publisher();
    state.onScriptedMount({ pageId: "page", elementId: "input" });
    state.onScriptedReport({ type: "powershow:scripted:report", elementId: "input", portId: "in", value: true });
    await Promise.resolve();
    expect(firebase.runTransaction).not.toHaveBeenCalled();
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
});
