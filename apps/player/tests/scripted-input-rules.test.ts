import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

type Rule = { ".validate": string };
const input = (JSON.parse(readFileSync(resolve(process.cwd(), "../../database.rules.json"), "utf8")) as { rules: { live: { scriptedInput: { ".read": boolean; $scriptedSlot: { $portIndex: Record<string, Rule> & { ".write": string } } } } } }).rules.live.scriptedInput.$scriptedSlot.$portIndex;
const fields = ["activationRevision", "currentVersionId", "revision", "pageId", "elementId", "portId", "targetBootId", "targetMountRevision", "value"] as const;
class Snapshot { constructor(private readonly value: unknown) {} child(path: string): Snapshot { return new Snapshot(path.split("/").reduce<unknown>((v, key) => typeof v === "object" && v !== null ? (v as Record<string, unknown>)[key] : undefined, this.value)); } exists(): boolean { return this.value !== undefined && this.value !== null; } hasChildren(keys: string[]): boolean { return keys.every((key) => this.child(key).exists()); } isNumber(): boolean { return typeof this.value === "number" && Number.isFinite(this.value); } isString(): boolean { return typeof this.value === "string"; } isBoolean(): boolean { return typeof this.value === "boolean"; } val(): unknown { return this.value; } }
const record = (overrides: Record<string, unknown> = {}) => ({ activationRevision: 7, currentVersionId: "v", revision: 1, pageId: "p", elementId: "e", portId: "port", targetBootId: "boot", targetMountRevision: 2, value: true, ...overrides });
const root = (overrides: Record<string, unknown> = {}) => ({ live: { current: { revision: 7, currentVersionId: "v" }, playerPresence: { current: { bootId: "boot", stage: "ready" }, leases: { boot: { bootId: "boot", activationRevision: 7, currentVersionId: "v", connected: true } } }, scriptedRuntime: { 0: { activationRevision: 7, currentVersionId: "v", pageId: "p", elementId: "e", bootId: "boot", mountRevision: 2 } }, ...overrides } });
function evaluate(expression: string, current: unknown, next: unknown, rootValue = root(), auth = true): boolean { const fn = new Function("auth", "data", "newData", "root", "$scriptedSlot", "$portIndex", `return Boolean(${expression});`) as (a: object | null, d: Snapshot, n: Snapshot, r: Snapshot, s: string, p: string) => boolean; return fn(auth ? {} : null, new Snapshot(current), new Snapshot(next), new Snapshot(rootValue), "0", "0"); }

describe("live Scripted input rule structure", () => {
  it("declares each legitimate record child before rejecting other descendants", () => {
    for (const field of fields) expect(input[field]?.[".validate"]).toBeTypeOf("string");
    expect(input.$other?.[".validate"]).toBe(false);
  });
  it("keeps public read and authenticated contextual writes", () => {
    expect((JSON.parse(readFileSync(resolve(process.cwd(), "../../database.rules.json"), "utf8")) as { rules: { live: { scriptedInput: { ".read": boolean } } } }).rules.live.scriptedInput[".read"]).toBe(true);
    expect(input[".write"]).toContain("auth != null");
    expect(input.revision?.[".validate"]).toContain("% 1 == 0");
    expect(input.targetMountRevision?.[".validate"]).toContain(">= 1");
    expect(input.value?.[".validate"]).toContain("isBoolean");
  });
  it("evaluates exact current-runtime access and revision context", () => {
    const contextRule = (input as Record<string, unknown>)[".validate"] as string;
    expect(evaluate(input[".write"], null, record(), root(), false)).toBe(false);
    expect(evaluate(input[".write"], null, record())).toBe(true);
    expect(evaluate(contextRule, null, record())).toBe(true);
    for (const changed of [record({ activationRevision: 6 }), record({ currentVersionId: "old" }), record({ targetBootId: "other" }), record({ revision: 2 })]) expect(evaluate(contextRule, null, changed)).toBe(false);
    expect(evaluate(contextRule, null, record(), root({ playerPresence: { current: { bootId: "boot", stage: "starting" }, leases: { boot: { bootId: "boot", activationRevision: 7, currentVersionId: "v", connected: true } } } }))).toBe(false);
    expect(evaluate(contextRule, null, record(), root({ scriptedRuntime: { 0: { activationRevision: 7, currentVersionId: "v", pageId: "other", elementId: "e", bootId: "boot", mountRevision: 2 } } }))).toBe(false);
    expect(evaluate(contextRule, record({ revision: 4 }), record({ revision: 5 }))).toBe(true);
    expect(evaluate(contextRule, record({ revision: 4 }), record({ revision: 1, targetMountRevision: 3 }), root({ scriptedRuntime: { 0: { activationRevision: 7, currentVersionId: "v", pageId: "p", elementId: "e", bootId: "boot", mountRevision: 3 } } }))).toBe(true);
  });
});
