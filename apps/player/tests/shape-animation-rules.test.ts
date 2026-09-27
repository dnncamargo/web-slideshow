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

const live = (JSON.parse(readFileSync(resolve(process.cwd(), "../../database.rules.json"), "utf8")) as { rules: { live: Record<string, unknown> } }).rules.live;
const rules = (live.shapeAnimationAction as { "$shapeSlot": Record<string, unknown> })["$shapeSlot"];
const action = (overrides: Record<string, unknown> = {}) => ({ activationRevision: 7, currentVersionId: "version-1", revision: 1, pageId: "page-1", elementId: "shape-1", targetBootId: "boot-a", action: "play", ...overrides });
const root = (overrides: Record<string, unknown> = {}) => ({ live: { current: { revision: 7, currentVersionId: "version-1" }, playerPresence: { current: { bootId: "boot-a", stage: "ready" }, leases: { "boot-a": { bootId: "boot-a", activationRevision: 7, currentVersionId: "version-1", connected: true } } }, ...overrides } });
function evaluate(expression: string, current: unknown, next: unknown, rootValue = root(), authenticated = true): boolean { const fn = new Function("auth", "data", "newData", "root", `return Boolean(${expression});`) as (auth: object | null, data: Snapshot, newData: Snapshot, root: Snapshot) => boolean; return fn(authenticated ? {} : null, new Snapshot(current), new Snapshot(next), new Snapshot(rootValue)); }

describe("live/shapeAnimationAction rules", () => {
  it("requires the separate exact channel and ready leased Player", () => {
    expect(live.shapeAnimationAction).toMatchObject({ ".read": true });
    const validate = rules[".validate"] as string;
    expect(evaluate(rules[".write"] as string, null, action(), root(), false)).toBe(false);
    expect(evaluate(validate, null, action())).toBe(true);
    expect(evaluate(validate, null, action({ action: "restart" }))).toBe(false);
    expect(rules["$other"]).toMatchObject({ ".validate": false });
    expect(evaluate(validate, null, action(), root({ playerPresence: { current: { bootId: "boot-a", stage: "starting" }, leases: {} } }))).toBe(false);
    expect(evaluate(validate, null, action(), root({ playerPresence: { current: { bootId: "boot-a", stage: "ready" }, leases: { "boot-a": { bootId: "boot-a", activationRevision: 7, currentVersionId: "version-1", connected: false } } } }))).toBe(false);
  });

  it("enforces +1 revisions for the same identity and reset for a new identity", () => {
    const validate = rules[".validate"] as string;
    expect(evaluate(validate, action(), action({ revision: 2, action: "pause" }))).toBe(true);
    expect(evaluate(validate, action(), action({ revision: 3 }))).toBe(false);
    expect(evaluate(validate, action(), action({ revision: 1, elementId: "shape-2" }))).toBe(true);
    expect(evaluate(validate, action(), action({ revision: 1, targetBootId: "boot-b" }), root({ playerPresence: { current: { bootId: "boot-b", stage: "ready" }, leases: { "boot-b": { bootId: "boot-b", activationRevision: 7, currentVersionId: "version-1", connected: true } } } }))).toBe(true);
  });
});
