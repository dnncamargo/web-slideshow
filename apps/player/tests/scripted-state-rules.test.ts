import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

class Snapshot {
  constructor(private readonly value: unknown) {}
  child(path: string): Snapshot { return new Snapshot(path.split("/").reduce<unknown>((value, key) => typeof value === "object" && value !== null ? (value as Record<string, unknown>)[key] : undefined, this.value)); }
  exists(): boolean { return this.value !== undefined && this.value !== null; }
  hasChildren(keys: string[]): boolean { return keys.every((key) => this.child(key).exists()); }
  isNumber(): boolean { return typeof this.value === "number" && Number.isFinite(this.value); }
  isString(): boolean { return typeof this.value === "string"; }
  isBoolean(): boolean { return typeof this.value === "boolean"; }
  val(): unknown { return this.value; }
}
type Leaf = { ".write": string; ".validate": string; $other: { ".validate": boolean } };
const live = (JSON.parse(readFileSync(resolve(process.cwd(), "../../database.rules.json"), "utf8")) as { rules: { live: { ".write": string; scriptedRuntime: Record<string, Leaf>; scriptedReport: Record<string, Record<string, Leaf>> } } }).rules.live;
const runtime = live.scriptedRuntime.$scriptedSlot!;
const report = live.scriptedReport.$scriptedSlot!.$portIndex!;
const inputRecord = (overrides: Record<string, unknown> = {}) => ({ activationRevision: 7, currentVersionId: "v", revision: 4, pageId: "p", elementId: "element", portId: "out", targetBootId: "boot", targetMountRevision: 1, value: true, ...overrides });
const root = (connected = true, stage = "ready", scriptedInput: Record<string, unknown> = { 0: { 0: inputRecord() } }) => ({ live: { current: { revision: 7, currentVersionId: "v" }, playerPresence: { current: { bootId: "boot", stage }, leases: { boot: { bootId: "boot", activationRevision: 7, currentVersionId: "v", connected } } }, scriptedRuntime: { 0: runtimeRecord() }, scriptedInput } });
const runtimeRecord = (overrides: Record<string, unknown> = {}) => ({ activationRevision: 7, currentVersionId: "v", mountRevision: 1, pageId: "p", elementId: "element", bootId: "boot", ...overrides });
const reportRecord = (overrides: Record<string, unknown> = {}) => ({ activationRevision: 7, currentVersionId: "v", revision: 1, pageId: "p", elementId: "element", portId: "out", sourceBootId: "boot", mountRevision: 1, appliedInputRevision: 0, value: 0.12, ...overrides });
function evaluate(expression: string, current: unknown, next: unknown, rootValue = root(), auth = true): boolean {
  const fn = new Function("auth", "data", "newData", "root", "$scriptedSlot", "$portIndex", `return Boolean(${expression});`) as (a: object | null, d: Snapshot, n: Snapshot, r: Snapshot, slot: string, port: string) => boolean;
  return fn(auth ? {} : null, new Snapshot(current), new Snapshot(next), new Snapshot(rootValue), "0", "0");
}

describe("live Scripted state repository rules", () => {
  it("allows unauthenticated current Player runtime writes, but rejects stale identity and malformed revisions", () => {
    expect(evaluate(runtime[".write"], null, runtimeRecord(), root(), false)).toBe(true);
    expect(evaluate(runtime[".validate"], null, runtimeRecord())).toBe(true);
    expect(evaluate(runtime[".validate"], null, runtimeRecord({ activationRevision: 6 }))).toBe(false);
    expect(evaluate(runtime[".validate"], null, runtimeRecord(), root(false))).toBe(false);
    expect(evaluate(runtime[".validate"], runtimeRecord(), runtimeRecord({ mountRevision: 1 }))).toBe(false);
    expect(evaluate(runtime[".validate"], runtimeRecord(), runtimeRecord({ mountRevision: 2 }))).toBe(true);
    expect(runtime.$other[".validate"]).toBe(false);
  });

  it("requires the exact mounted runtime for unauthenticated reports and validates positive input correlation", () => {
    expect(evaluate(report[".write"], null, reportRecord(), root(), false)).toBe(true);
    expect(evaluate(report[".validate"], null, reportRecord())).toBe(true);
    expect(evaluate(report[".validate"], null, reportRecord({ currentVersionId: "stale" }))).toBe(false);
    expect(evaluate(report[".validate"], null, reportRecord({ sourceBootId: "wrong-boot" }))).toBe(false);
    expect(evaluate(report[".validate"], null, reportRecord({ mountRevision: 2 }))).toBe(false);
    expect(evaluate(report[".validate"], null, reportRecord({ revision: 1.5 }))).toBe(false);
    expect(evaluate(report[".validate"], null, reportRecord(), root(true, "load-failed"))).toBe(false);
    expect(evaluate(report[".validate"], null, reportRecord(), root(false))).toBe(false);
    expect(evaluate(report[".validate"], null, reportRecord({ currentVersionId: "stale" }), root(), true)).toBe(false);
    expect(evaluate(report[".validate"], null, reportRecord({ appliedInputRevision: 1 }))).toBe(true);
    expect(evaluate(report[".validate"], null, reportRecord({ appliedInputRevision: 4 }))).toBe(true);
    expect(evaluate(report[".validate"], null, reportRecord({ appliedInputRevision: 5 }))).toBe(false);
    expect(evaluate(report[".validate"], null, reportRecord({ appliedInputRevision: -1 }))).toBe(false);
    expect(evaluate(report[".validate"], null, reportRecord({ appliedInputRevision: 1.5 }))).toBe(false);
    expect(evaluate(report[".validate"], null, reportRecord({ appliedInputRevision: 1 }), root(true, "ready", { 0: { 0: inputRecord({ pageId: "wrong" }) } }))).toBe(false);
    expect(evaluate(report[".validate"], null, reportRecord({ appliedInputRevision: 1 }), root(true, "ready", { 0: { 0: inputRecord({ elementId: "wrong" }) } }))).toBe(false);
    expect(evaluate(report[".validate"], null, reportRecord({ appliedInputRevision: 1 }), root(true, "ready", { 0: { 0: inputRecord({ portId: "wrong" }) } }))).toBe(false);
    expect(evaluate(report[".validate"], null, reportRecord({ appliedInputRevision: 1 }), root(true, "ready", { 0: { 0: inputRecord({ targetBootId: "wrong" }) } }))).toBe(false);
    expect(evaluate(report[".validate"], null, reportRecord({ appliedInputRevision: 1 }), root(true, "ready", { 0: { 0: inputRecord({ targetMountRevision: 2 }) } }))).toBe(false);
    expect(evaluate(report[".validate"], null, reportRecord({ revision: 2 }))).toBe(false);
    expect(evaluate(report[".validate"], reportRecord({ revision: 4 }), reportRecord({ revision: 5 }))).toBe(true);
    expect(evaluate(report[".validate"], reportRecord({ revision: 4 }), reportRecord({ revision: 1, mountRevision: 2 }), { ...root(), live: { ...root().live, scriptedRuntime: { 0: runtimeRecord({ mountRevision: 2 }) } } })).toBe(true);
    expect(report.$other[".validate"]).toBe(false);
  });

  it("includes both roots in whole-live cleanup", () => {
    const current = { current: { revision: 7 }, scriptedRuntime: { 0: runtimeRecord() }, scriptedReport: { 0: { 0: reportRecord() } } };
    expect(evaluate(live[".write"], current, { scriptedRuntime: current.scriptedRuntime, scriptedReport: current.scriptedReport })).toBe(false);
    expect(evaluate(live[".write"], current, {})).toBe(true);
  });
});
