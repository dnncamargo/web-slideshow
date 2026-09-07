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
  isBoolean(): boolean { return typeof this.value === "boolean"; }
  val(): unknown { return this.value; }
}

const rules = JSON.parse(readFileSync(resolve(process.cwd(), "../../database.rules.json"), "utf8")) as { rules: { live: Record<string, unknown> } };
const live = rules.rules.live;
const actionRules = (live.plotAnimationAction as { ".read": boolean; $plotSlot: Record<string, unknown> }).$plotSlot;
const action = (overrides: Record<string, unknown> = {}) => ({ activationRevision: 7, currentVersionId: "version-1", revision: 1, pageId: "page-1", elementId: "plot-1", targetBootId: "boot-a", action: "play", ...overrides });
const root = (overrides: Record<string, unknown> = {}) => ({ live: { current: { revision: 7, currentVersionId: "version-1" }, playerPresence: { current: { bootId: "boot-a", stage: "ready" }, leases: { "boot-a": { bootId: "boot-a", activationRevision: 7, currentVersionId: "version-1", connected: true } } }, ...overrides } });
function evaluate(expression: string, current: unknown, next: unknown, rootValue = root(), authenticated = true): boolean {
  const fn = new Function("auth", "data", "newData", "root", `return Boolean(${expression});`) as (auth: object | null, data: Snapshot, newData: Snapshot, root: Snapshot) => boolean;
  return fn(authenticated ? {} : null, new Snapshot(current), new Snapshot(next), new Snapshot(rootValue));
}

describe("live/plotAnimationAction rules", () => {
  it("requires public reads and authenticated exact records", () => {
    expect(live.plotAnimationAction).toMatchObject({ ".read": true });
    expect(evaluate(actionRules[".write"] as string, null, action(), root(), false)).toBe(false);
    expect(evaluate(actionRules[".validate"] as string, null, action())).toBe(true);
    expect(actionRules.$other).toMatchObject({ ".validate": false });
    const fields = ["activationRevision", "currentVersionId", "revision", "pageId", "elementId", "targetBootId", "action"] as const;
    for (const field of fields) {
      const missing = { ...action() };
      delete missing[field];
      expect(evaluate(actionRules[".validate"] as string, null, missing)).toBe(false);
    }
  });

  it("requires ready matching Player presence and strict action values", () => {
    const validate = actionRules[".validate"] as string;
    expect(evaluate(validate, null, action({ action: "restart" }))).toBe(false);
    expect(evaluate(validate, null, action({ targetBootId: "boot-b" }))).toBe(false);
    expect(evaluate(validate, null, action(), root({ playerPresence: { current: { bootId: "boot-a", stage: "starting" } } }))).toBe(false);
    expect(evaluate(validate, null, action(), root({ playerPresence: { current: { bootId: "boot-a", stage: "ready" }, leases: {} } }))).toBe(false);
    expect(evaluate(validate, null, action(), root({ playerPresence: { current: { bootId: "boot-a", stage: "ready" }, leases: { "boot-a": { bootId: "boot-a", activationRevision: 6, currentVersionId: "version-1", connected: true } } } }))).toBe(false);
    expect(evaluate(validate, null, action(), root({ playerPresence: { current: { bootId: "boot-a", stage: "ready" }, leases: { "boot-a": { bootId: "boot-a", activationRevision: 7, currentVersionId: "old", connected: true } } } }))).toBe(false);
    expect(evaluate(validate, null, action(), root({ playerPresence: { current: { bootId: "boot-a", stage: "ready" }, leases: { "boot-a": { bootId: "boot-b", activationRevision: 7, currentVersionId: "version-1", connected: true } } } }))).toBe(false);
    expect(evaluate(validate, null, action(), root({ playerPresence: { current: { bootId: "boot-a", stage: "ready" }, leases: { "boot-a": { bootId: "boot-a", activationRevision: 7, currentVersionId: "version-1", connected: false } } } }))).toBe(false);
    expect(evaluate(validate, null, action({ activationRevision: 6 }))).toBe(false);
    expect(evaluate(validate, null, action({ currentVersionId: "old" }))).toBe(false);
  });

  it("enforces high-water revisions and identity resets", () => {
    const validate = actionRules[".validate"] as string;
    for (const actionName of ["play", "pause", "reset", "toggle"] as const) {
      expect(evaluate(validate, null, action({ action: actionName }))).toBe(true);
    }
    expect(evaluate(validate, null, action({ revision: 2 }))).toBe(false);
    expect(evaluate(validate, action({ revision: 3 }), action({ revision: 4, action: "pause" }))).toBe(true);
    expect(evaluate(validate, action({ revision: 3 }), action({ revision: 3, action: "pause" }))).toBe(false);
    expect(evaluate(validate, action({ revision: 3 }), action({ revision: 5, action: "pause" }))).toBe(false);
    expect(evaluate(validate, action({ revision: 3 }), action({ revision: 1, pageId: "page-2" }))).toBe(true);
    expect(evaluate(validate, action({ revision: 3 }), action({ revision: 1, elementId: "plot-2" }))).toBe(true);
    expect(evaluate(validate, action({ revision: 3 }), action({ revision: 1, targetBootId: "boot-b" }), root({ playerPresence: { current: { bootId: "boot-b", stage: "ready" }, leases: { "boot-b": { bootId: "boot-b", activationRevision: 7, currentVersionId: "version-1", connected: true } } } }))).toBe(true);
    expect(evaluate(validate, action({ revision: 3 }), action({ revision: 1, currentVersionId: "version-2" }), root({ current: { revision: 7, currentVersionId: "version-2" }, playerPresence: { current: { bootId: "boot-a", stage: "ready" }, leases: { "boot-a": { bootId: "boot-a", activationRevision: 7, currentVersionId: "version-2", connected: true } } } }))).toBe(true);
    expect(evaluate(validate, action({ revision: 3 }), action({ revision: 1, activationRevision: 8 }), root({ current: { revision: 8, currentVersionId: "version-1" }, playerPresence: { current: { bootId: "boot-a", stage: "ready" }, leases: { "boot-a": { bootId: "boot-a", activationRevision: 8, currentVersionId: "version-1", connected: true } } } }))).toBe(true);
    expect(evaluate(validate, action({ revision: 3 }), action({ revision: 1, action: "pause" }))).toBe(false);
  });

  it("keeps whole-Live deletion valid only when the transient root is removed", () => {
    const write = live[".write"] as string;
    const current = { current: { revision: 7 }, plotAnimationAction: { 0: action() } };
    expect(evaluate(write, current, { plotAnimationAction: current.plotAnimationAction })).toBe(false);
    expect(evaluate(write, current, {})).toBe(true);
  });
});
