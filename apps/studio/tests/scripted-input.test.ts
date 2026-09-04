import { describe, expect, it } from "vitest";
import { buildScriptedInputPath, parseLiveScriptedInputRecord } from "../src/features/live/scripted-input";

const record = (overrides: Record<string, unknown> = {}) => ({ activationRevision: 7, currentVersionId: " v ", revision: 1, pageId: " p ", elementId: " id /# ", portId: " port .$ ", targetBootId: " boot ", targetMountRevision: 1, value: 0.12, ...overrides });
describe("Scripted input contract", () => {
  it("strictly parses finite transport records without altering canonical ids", () => {
    expect(parseLiveScriptedInputRecord(record())).toEqual({ ...record(), currentVersionId: "v", pageId: "p", targetBootId: "boot" });
    expect(parseLiveScriptedInputRecord(record({ extra: true }))).toBeNull();
    expect(parseLiveScriptedInputRecord(record({ revision: 0 }))).toBeNull();
    expect(parseLiveScriptedInputRecord(record({ revision: 1.5 }))).toBeNull();
    expect(parseLiveScriptedInputRecord(record({ targetMountRevision: 0 }))).toBeNull();
    expect(parseLiveScriptedInputRecord(record({ value: Infinity }))).toBeNull();
  });
  it("uses numeric RTDB addresses", () => expect(buildScriptedInputPath(1, 2)).toBe("live/scriptedInput/1/2"));
});
