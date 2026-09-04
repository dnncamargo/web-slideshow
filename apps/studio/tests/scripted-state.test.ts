import { describe, expect, it } from "vitest";
import { parseLiveScriptedReportRecord, parseLiveScriptedRuntimeRecord } from "../src/features/live/scripted-state";
describe("Studio Scripted runtime/report parsers", () => {
  it("strictly parses current wire records without altering canonical ids", () => {
    expect(parseLiveScriptedRuntimeRecord({ activationRevision: 1, currentVersionId: " v ", mountRevision: 2, pageId: " p ", elementId: " id ", bootId: " boot " })).toEqual({ activationRevision: 1, currentVersionId: "v", mountRevision: 2, pageId: "p", elementId: " id ", bootId: "boot" });
    expect(parseLiveScriptedReportRecord({ activationRevision: 1, currentVersionId: "v", revision: 2, pageId: "p", elementId: " id ", portId: " port ", sourceBootId: "boot", mountRevision: 2, appliedInputRevision: 1, value: .12 })).toMatchObject({ elementId: " id ", portId: " port ", appliedInputRevision: 1, value: .12 });
  });
  it("rejects malformed correlation records", () => {
    const report = { activationRevision: 1, currentVersionId: "v", revision: 2, pageId: "p", elementId: "id", portId: "port", sourceBootId: "boot", mountRevision: 2, appliedInputRevision: 0, value: true };
    expect(parseLiveScriptedReportRecord({ ...report, appliedInputRevision: -1 })).toBeNull();
    expect(parseLiveScriptedReportRecord({ ...report, appliedInputRevision: .5 })).toBeNull();
    expect(parseLiveScriptedReportRecord({ ...report, extra: true })).toBeNull();
  });
});
