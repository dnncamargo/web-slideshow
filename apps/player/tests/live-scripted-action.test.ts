import { describe, expect, it, vi } from "vitest";
import { PresentationSchema } from "@powershow/document-schema";

const firebase = vi.hoisted(() => ({
  callback: undefined as ((snapshot: { val(): unknown }) => void) | undefined,
  onValue: vi.fn(),
  ref: vi.fn(),
}));

vi.mock("firebase/database", () => ({
  onValue: firebase.onValue,
  ref: firebase.ref,
}));

import {
  SCRIPTED_ACTION_ROOT_PATH,
  createLiveScriptedActionTracker,
  parseLiveScriptedActionRecord,
  parseScriptedActionIndex,
  subscribeLiveScriptedAction,
} from "../src/live-scripted-action";

const presentation = PresentationSchema.parse({
  schemaVersion: 1,
  id: "live-scripted-actions",
  title: "Live Scripted actions",
  description: "",
  aspectRatio: "16:9",
  slides: [
    {
      id: "page-a",
      elements: [
        { id: "text", type: "text", content: "Text" },
        {
          id: "scripted-a", type: "scripted", title: "A", html: "", css: "", script: "",
          ports: [
            { id: "same", label: "Up", kind: "action" },
            { id: "down", label: "Down", kind: "action" },
            { id: "enabled", label: "Enabled", kind: "boolean", direction: "input" },
          ],
        },
        { id: "container", type: "container", children: [{
          id: "scripted-b", type: "scripted", title: "B", html: "", css: "", script: "",
          ports: [{ id: "same", label: "Reset", kind: "action" }],
        }] },
      ],
    },
    { id: "page-b", elements: [] },
  ],
});

function record(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    activationRevision: 7,
    currentVersionId: "version-a",
    revision: 1,
    pageId: "page-a",
    elementId: "scripted-a",
    portId: "same",
    targetBootId: "boot-a",
    ...overrides,
  };
}

function subscribe(index = 0, tracker = createLiveScriptedActionTracker()) {
  const sendScriptedAction = vi.fn();
  const controller = {
    getCurrentIndex: () => index,
    sendScriptedAction,
  };
  const unsubscribe = vi.fn();
  firebase.ref.mockReturnValue({});
  firebase.onValue.mockImplementation((_ref, callback) => {
    firebase.callback = callback;
    return unsubscribe;
  });
  const cleanup = subscribeLiveScriptedAction(
    {} as never, 7, "version-a", "boot-a", presentation, controller as never, tracker,
  );
  return { cleanup, controller, sendScriptedAction, tracker, unsubscribe };
}

function emit(value: unknown): void {
  firebase.callback?.({ val: () => value });
}

describe("live Scripted action subscriber", () => {
  it("uses the exact root and accepts only strict records and canonical numeric keys", () => {
    expect(parseLiveScriptedActionRecord(record({ elementId: 'owner/[#]', portId: 'go.$' }))).toMatchObject({ elementId: 'owner/[#]', portId: 'go.$' });
    expect(parseLiveScriptedActionRecord({ ...record(), extra: true })).toBeNull();
    expect(parseLiveScriptedActionRecord([record()])).toBeNull();
    expect(parseLiveScriptedActionRecord({ revision: 1 })).toBeNull();
    expect(parseScriptedActionIndex("0")).toBe(0);
    expect(parseScriptedActionIndex("42")).toBe(42);
    for (const key of ["01", "-1", "1.5", "", "port"]) expect(parseScriptedActionIndex(key)).toBeNull();

    subscribe();
    expect(firebase.ref).toHaveBeenCalledWith(expect.anything(), SCRIPTED_ACTION_ROOT_PATH);
  });

  it("traverses object and array trees, recovers coalesced revisions, and never lowers high-water", () => {
    const { sendScriptedAction } = subscribe();
    emit({ 0: { 0: record({ revision: 1 }) } });
    emit([[record({ revision: 2 })]]);
    emit({ 0: { 0: record({ revision: 5 }) } });
    emit({ 0: { 0: record({ revision: 5 }) } });
    emit({ 0: { 0: record({ revision: 4 }) } });
    emit({ 0: { 0: record({ revision: 6 }) } });

    expect(sendScriptedAction).toHaveBeenCalledTimes(6);
    expect(sendScriptedAction).toHaveBeenLastCalledWith("scripted-a", "same");
  });

  it("preserves cursor through null, deletion/recreation, and same-boot resubscription", () => {
    const tracker = createLiveScriptedActionTracker();
    const first = subscribe(0, tracker);
    emit({ 0: { 0: record({ revision: 7 }) } });
    emit(null);
    first.cleanup();
    expect(first.unsubscribe).toHaveBeenCalledOnce();

    const second = subscribe(0, tracker);
    emit({ 0: { 0: record({ revision: 1 }) } });
    emit({ 0: { 0: record({ revision: 7 }) } });
    emit({ 0: { 0: record({ revision: 8 }) } });

    expect(first.sendScriptedAction).toHaveBeenCalledTimes(7);
    expect(second.sendScriptedAction).toHaveBeenCalledExactlyOnceWith("scripted-a", "same");
  });

  it("clears only for a new boot and rejects mismatched live identity before tracking", () => {
    const tracker = createLiveScriptedActionTracker();
    const first = subscribe(0, tracker);
    emit({ 0: { 0: record({ revision: 3 }) } });

    const sendScriptedAction = vi.fn();
    firebase.onValue.mockImplementation((_ref, callback) => {
      firebase.callback = callback;
      return vi.fn();
    });
    subscribeLiveScriptedAction({} as never, 7, "version-a", "boot-b", presentation, {
      getCurrentIndex: () => 0, sendScriptedAction,
    } as never, tracker);
    emit({ 0: { 0: record({ targetBootId: "boot-a", revision: 4 }) } });
    emit({ 0: { 0: record({ targetBootId: "boot-b", revision: 1 }) } });
    emit({ 0: { 0: record({ targetBootId: "boot-b", activationRevision: 8, revision: 2 }) } });

    expect(first.sendScriptedAction).toHaveBeenCalledTimes(3);
    expect(sendScriptedAction).toHaveBeenCalledExactlyOnceWith("scripted-a", "same");
  });

  it("consumes wrong-page and invalid canonical targets without later replay", () => {
    const tracker = createLiveScriptedActionTracker();
    const onWrongPage = subscribe(1, tracker);
    emit({ 0: { 0: record({ revision: 2 }) } });
    const onRightPage = subscribe(0, tracker);
    emit({ 0: { 0: record({ revision: 2 }) } });
    emit({ 0: { 0: record({ revision: 3 }) } });
    emit({ 9: { 0: record({ revision: 1 }) }, 1: { 0: record({ revision: 1, elementId: "scripted-b" }) } });
    emit({ 0: { 2: record({ revision: 1, portId: "enabled" }), 1: record({ revision: 1, portId: "same" }) } });

    expect(onWrongPage.sendScriptedAction).not.toHaveBeenCalled();
    expect(onRightPage.sendScriptedAction).toHaveBeenNthCalledWith(1, "scripted-a", "same");
    expect(onRightPage.sendScriptedAction).toHaveBeenNthCalledWith(2, "scripted-b", "same");
    expect(onRightPage.sendScriptedAction).toHaveBeenCalledTimes(2);
  });
});
