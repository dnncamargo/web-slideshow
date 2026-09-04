import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

class Snapshot {
  constructor(private readonly value: unknown) {}
  child(path: string): Snapshot {
    return new Snapshot(path.split("/").reduce<unknown>((value, part) =>
      typeof value === "object" && value !== null
        ? (value as Record<string, unknown>)[part]
        : undefined, this.value));
  }
  exists(): boolean { return this.value !== undefined && this.value !== null; }
  hasChildren(paths: string[]): boolean { return paths.every((path) => this.child(path).exists()); }
  isNumber(): boolean { return typeof this.value === "number" && Number.isFinite(this.value); }
  isString(): boolean { return typeof this.value === "string"; }
  val(): unknown { return this.value; }
}

interface LeafRules {
  ".read"?: boolean;
  ".write": string;
  ".validate": string;
  $other: { ".validate": boolean };
}

const rules = JSON.parse(
  readFileSync(resolve(process.cwd(), "../../database.rules.json"), "utf8"),
) as { rules: { live: LeafRules & { scriptedAction: { ".read": boolean; $scriptedSlot: { $portIndex: LeafRules } } } } };
const liveRules = rules.rules.live;
const actionRules = liveRules.scriptedAction.$scriptedSlot.$portIndex;

const action = (overrides: Record<string, unknown> = {}) => ({
  activationRevision: 7,
  currentVersionId: "version-1",
  revision: 1,
  pageId: "page-1",
  elementId: "scripted-1",
  portId: "scroll-down",
  targetBootId: "boot-a",
  ...overrides,
});

function root(
  connected = true,
  stage = "ready",
  leaseOverrides: Record<string, unknown> = {},
): unknown {
  return {
    live: {
      current: { revision: 7, currentVersionId: "version-1" },
      playerPresence: {
        current: { bootId: "boot-a", stage },
        leases: {
          "boot-a": {
            bootId: "boot-a",
            activationRevision: 7,
            currentVersionId: "version-1",
            connected,
            ...leaseOverrides,
          },
        },
      },
    },
  };
}

// This structural harness evaluates stored rule expressions. Firebase skips
// `.validate` for deletions, so these tests do not claim deletion rejection.
function evaluate(
  expression: string,
  current: unknown,
  next: unknown,
  rootValue = root(),
  authenticated = true,
): boolean {
  const fn = new Function(
    "auth", "data", "newData", "root",
    `return Boolean(${expression});`,
  ) as (auth: object | null, data: Snapshot, newData: Snapshot, root: Snapshot) => boolean;
  return fn(authenticated ? {} : null, new Snapshot(current), new Snapshot(next), new Snapshot(rootValue));
}

describe("live/scriptedAction repository rules", () => {
  it("allows public reads but requires authenticated writes", () => {
    expect(liveRules.scriptedAction[".read"]).toBe(true);
    expect(evaluate(actionRules[".write"], null, action(), root(), false)).toBe(false);
  });

  it("requires the exact ready current Player and a connected matching lease", () => {
    expect(evaluate(actionRules[".validate"], null, action())).toBe(true);
    expect(evaluate(actionRules[".validate"], null, action({ activationRevision: 6 }))).toBe(false);
    expect(evaluate(actionRules[".validate"], null, action({ currentVersionId: "old" }))).toBe(false);
    expect(evaluate(actionRules[".validate"], null, action({ targetBootId: "boot-b" }))).toBe(false);
    expect(evaluate(actionRules[".validate"], null, action(), root(false))).toBe(false);
    expect(evaluate(actionRules[".validate"], null, action(), root(true, "starting"))).toBe(false);
    expect(evaluate(actionRules[".validate"], null, action(), root(true, "ready", { currentVersionId: "old" }))).toBe(false);
  });

  it("requires revision one initially, increments same identity, and resets changed identity", () => {
    expect(evaluate(actionRules[".validate"], null, action({ revision: 2 }))).toBe(false);
    expect(evaluate(actionRules[".validate"], action({ revision: 4 }), action({ revision: 5 }))).toBe(true);
    expect(evaluate(actionRules[".validate"], action({ revision: 4 }), action({ revision: 4 }))).toBe(false);
    expect(evaluate(actionRules[".validate"], action({ revision: 4 }), action({ revision: 6 }))).toBe(false);
    expect(evaluate(actionRules[".validate"], action({ revision: 4 }), action({ revision: 1, portId: "scroll-up" }))).toBe(true);
  });

  it("rejects malformed and extra records", () => {
    expect(evaluate(actionRules[".validate"], null, action({ portId: "" }))).toBe(false);
    expect(evaluate(actionRules[".validate"], null, action({ revision: 1.5 }))).toBe(false);
    expect(actionRules.$other[".validate"]).toBe(false);
  });

  it("requires scriptedAction cleanup when current live state is removed", () => {
    const current = { current: { revision: 7 }, scriptedAction: { 0: { 0: action() } } };
    expect(evaluate(liveRules[".write"], current, { scriptedAction: current.scriptedAction })).toBe(false);
    expect(evaluate(liveRules[".write"], current, {})).toBe(true);
  });
});
