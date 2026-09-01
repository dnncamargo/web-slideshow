import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

class Snapshot {
  constructor(private readonly value: unknown) {}
  child(path: string): Snapshot { return new Snapshot(path.split("/").reduce<unknown>((value, part) => typeof value === "object" && value !== null ? (value as Record<string, unknown>)[part] : undefined, this.value)); }
  exists(): boolean { return this.value !== undefined && this.value !== null; }
  hasChildren(paths: string[]): boolean { return paths.every((path) => this.child(path).exists()); }
  isNumber(): boolean { return typeof this.value === "number" && Number.isFinite(this.value); }
  isString(): boolean { return typeof this.value === "string"; }
  val(): unknown { return this.value; }
}

const rules = JSON.parse(readFileSync(resolve(process.cwd(), "../../database.rules.json"), "utf8")) as { rules: { live: { playerRecoveryRequest: { ".write": string; ".read": boolean; ".validate": string; $other: { ".validate": boolean } } } } };
const recovery = rules.rules.live.playerRecoveryRequest;
const request = (overrides: Record<string, unknown> = {}) => ({ activationRevision: 7, currentVersionId: "version-1", revision: 1, targetBootId: "boot-a", action: "reload", requestedAt: 123, ...overrides });
const live = (connected = true) => ({ live: { current: { revision: 7, currentVersionId: "version-1" }, playerPresence: { current: { bootId: "boot-a" }, leases: { "boot-a": { bootId: "boot-a", connected } } } } });
function evaluate(expression: string, current: unknown, next: unknown, root = live(), authenticated = true): boolean {
  // This is an exact-expression harness, not a Firebase Rules emulator.
  const fn = new Function("auth", "data", "newData", "root", `return Boolean(${expression});`) as (auth: object | null, data: Snapshot, newData: Snapshot, root: Snapshot) => boolean;
  return fn(authenticated ? {} : null, new Snapshot(current), new Snapshot(next), new Snapshot(root));
}

describe("live/playerRecoveryRequest repository rules", () => {
  it("preserves public reads and requires authenticated writes", () => {
    expect(recovery[".read"]).toBe(true);
    expect(evaluate(recovery[".write"], null, request(), live(), false)).toBe(false);
  });
  it("accepts only a connected exact current target and sequential revisions", () => {
    expect(evaluate(recovery[".validate"], null, request())).toBe(true);
    expect(evaluate(recovery[".validate"], request(), request({ revision: 2 }))).toBe(true);
    expect(evaluate(recovery[".validate"], request(), request({ revision: 3 }))).toBe(false);
    expect(evaluate(recovery[".validate"], null, request(), live(false))).toBe(false);
    expect(evaluate(recovery[".validate"], null, request({ targetBootId: "boot-b" }))).toBe(false);
  });
  it("rejects stale identities and extra fields while allowing authenticated cleanup", () => {
    expect(evaluate(recovery[".validate"], null, request({ activationRevision: 6 }))).toBe(false);
    expect(evaluate(recovery[".validate"], null, request({ currentVersionId: "old" }))).toBe(false);
    expect(recovery.$other[".validate"]).toBe(false);
    expect(evaluate(recovery[".write"], request(), null)).toBe(true);
  });
});
