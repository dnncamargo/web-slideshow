import { describe, expect, it, vi } from "vitest";
import { PresentationSchema } from "@powershow/document-schema";
const firebase = vi.hoisted(() => ({ onValue: vi.fn(), ref: vi.fn(), callback: undefined as ((snapshot: { val(): unknown }) => void) | undefined }));
vi.mock("firebase/database", () => ({ onValue: firebase.onValue, ref: firebase.ref }));
import { createLiveScriptedInputTracker, subscribeLiveScriptedInput } from "../src/live-scripted-input";
const presentation = PresentationSchema.parse({ schemaVersion: 1, id: "p", title: "P", description: "", aspectRatio: "16:9", slides: [{ id: "page", elements: [{ id: "s", type: "scripted", title: "S", html: "", css: "", script: "", ports: [{ id: "n", label: "N", kind: "number", direction: "input", min: 0, max: 1, step: .5 }, { id: "b", label: "B", kind: "boolean", direction: "input-output" }] }] }] });
const input = (overrides: Record<string, unknown> = {}) => ({ activationRevision: 7, currentVersionId: "v", revision: 1, pageId: "page", elementId: "s", portId: "n", targetBootId: "boot", targetMountRevision: 2, value: .12, ...overrides });
describe("live Scripted input subscriber", () => it("dispatches a valid decimal once and ignores duplicate revisions", () => {
  const sendScriptedInput = vi.fn(); firebase.ref.mockReturnValue({}); firebase.onValue.mockImplementation((_ref, callback) => { firebase.callback = callback; return vi.fn(); });
  subscribeLiveScriptedInput({} as never, 7, "v", "boot", presentation, { getCurrentIndex: () => 0, sendScriptedInput } as never, () => ({ pageId: "page", elementId: "s", mountRevision: 2 }), createLiveScriptedInputTracker());
  firebase.callback?.({ val: () => ({ 0: { 0: input() } }) }); firebase.callback?.({ val: () => [[input()]] });
  expect(sendScriptedInput).toHaveBeenCalledExactlyOnceWith("s", "n", .12);
}));
