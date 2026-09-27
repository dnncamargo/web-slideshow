import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

class Snapshot {
  constructor(private readonly value: unknown) {}

  child(path: string): Snapshot {
    return new Snapshot(path.split("/").reduce<unknown>(
      (value, part) => typeof value === "object" && value !== null
        ? (value as Record<string, unknown>)[part]
        : undefined,
      this.value,
    ));
  }

  exists(): boolean { return this.value !== undefined && this.value !== null; }
  hasChildren(paths: string[]): boolean { return paths.every((path) => this.child(path).exists()); }
  isNumber(): boolean { return typeof this.value === "number" && Number.isFinite(this.value); }
  isString(): boolean { return typeof this.value === "string"; }
  val(): unknown { return this.value; }
}

const rules = JSON.parse(readFileSync(resolve(process.cwd(), "../../database.rules.json"), "utf8")) as {
  rules: { live: Record<string, unknown> };
};
const live = rules.rules.live;
const checkboxRules = (live.checkboxControl as {
  ".read": boolean;
  $slot: Record<string, unknown>;
}).$slot;

const record = (overrides: Record<string, unknown> = {}) => ({
  activationRevision: 7,
  currentVersionId: "version-1",
  revision: 1,
  pageId: "page-1",
  elementId: " topics / #% ",
  checkboxId: " item / #% ",
  state: "unchecked",
  ...overrides,
});

const root = (overrides: Record<string, unknown> = {}) => ({
  live: {
    current: { revision: 7, currentVersionId: "version-1" },
    ...overrides,
  },
});

function evaluate(
  expression: string,
  current: unknown,
  next: unknown,
  rootValue = root(),
  authenticated = true,
): boolean {
  const fn = new Function(
    "auth",
    "data",
    "newData",
    "root",
    `return Boolean(${expression});`,
  ) as (auth: object | null, data: Snapshot, newData: Snapshot, root: Snapshot) => boolean;
  return fn(authenticated ? {} : null, new Snapshot(current), new Snapshot(next), new Snapshot(rootValue));
}

describe("live/checkboxControl rules", () => {
  it("is public-readable and requires authenticated exact records", () => {
    expect(live.checkboxControl).toMatchObject({ ".read": true });
    expect(evaluate(checkboxRules[".write"] as string, null, record(), root(), false)).toBe(false);
    expect(evaluate(checkboxRules[".write"] as string, null, record())).toBe(true);
    expect(evaluate(checkboxRules[".validate"] as string, null, record())).toBe(true);
    expect(checkboxRules.$other).toMatchObject({ ".validate": false });

    const fields = ["activationRevision", "currentVersionId", "revision", "pageId", "elementId", "checkboxId", "state"] as const;
    for (const field of fields) {
      const missing = { ...record() };
      delete missing[field];
      expect(evaluate(checkboxRules[".validate"] as string, null, missing)).toBe(false);
    }
  });

  it("requires current Live identity and strict field values", () => {
    const validate = checkboxRules[".validate"] as string;
    expect(evaluate(validate, null, record({ activationRevision: 6 }))).toBe(false);
    expect(evaluate(validate, null, record({ currentVersionId: "old" }))).toBe(false);
    expect(evaluate(validate, null, record({ currentVersionId: "   " }))).toBe(false);
    expect(evaluate(validate, null, record({ pageId: "" }))).toBe(false);
    expect(evaluate(validate, null, record({ elementId: "" }))).toBe(false);
    expect(evaluate(validate, null, record({ checkboxId: "" }))).toBe(false);
    expect(evaluate(validate, null, record({ state: "toggle" }))).toBe(false);
    expect(evaluate(validate, null, record({ state: "mixed" }))).toBe(false);
    expect(evaluate(validate, null, record({ state: true }))).toBe(false);
    expect(evaluate(validate, null, record({ state: "unchecked" }))).toBe(true);
    expect(evaluate(validate, null, record({ state: "intermediate" }))).toBe(true);
    expect(evaluate(validate, null, record({ state: "checked" }))).toBe(true);
    expect(checkboxRules.$other).toMatchObject({ ".validate": false });
  });

  it("requires integer revisions and exact initial sequencing", () => {
    const validate = checkboxRules[".validate"] as string;
    expect(evaluate(validate, null, record({ revision: 0 }))).toBe(false);
    expect(evaluate(validate, null, record({ revision: 1.5 }))).toBe(false);
    expect(evaluate(validate, null, record({ revision: 2 }))).toBe(false);
    expect(evaluate(validate, record({ revision: 3 }), record({ revision: 3 }))).toBe(false);
    expect(evaluate(validate, record({ revision: 3 }), record({ revision: 5 }))).toBe(false);
    expect(evaluate(validate, record({ revision: 3 }), record({ revision: 4, state: "checked" }))).toBe(true);
    expect(evaluate(validate, record({ revision: 3 }), record({ revision: 4, state: "intermediate" }))).toBe(true);
  });

  it("resets revision when any identity member changes", () => {
    const validate = checkboxRules[".validate"] as string;
    expect(evaluate(validate, record({ revision: 3 }), record({ revision: 1, pageId: "page-2" }))).toBe(true);
    expect(evaluate(validate, record({ revision: 3 }), record({ revision: 1, elementId: "topics-2" }))).toBe(true);
    expect(evaluate(validate, record({ revision: 3 }), record({ revision: 1, checkboxId: "item-2" }))).toBe(true);
    expect(evaluate(validate, record({ revision: 3 }), record({ revision: 1, currentVersionId: "version-2" }), root({ current: { revision: 7, currentVersionId: "version-2" } }))).toBe(true);
    expect(evaluate(validate, record({ revision: 3 }), record({ revision: 1, activationRevision: 8 }), root({ current: { revision: 8, currentVersionId: "version-1" } }))).toBe(true);
    expect(evaluate(validate, record({ revision: 3 }), record({ revision: 1, state: "checked" }))).toBe(false);
  });

  it("requires whole-Live cleanup to remove checkboxControl", () => {
    const write = live[".write"] as string;
    const current = { current: { revision: 7 }, checkboxControl: { 0: record() } };
    expect(evaluate(write, current, { checkboxControl: current.checkboxControl })).toBe(false);
    expect(evaluate(write, current, {})).toBe(true);
  });
});
