import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

class Snapshot {
  constructor(private readonly value: unknown) {}
  child(path: string): Snapshot {
    return new Snapshot(path.split("/").reduce<unknown>((value, part) =>
      typeof value === "object" && value !== null
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
  rules: { live: { fullscreenRequest: { ".read": boolean; ".write": string; ".validate": string; $other: { ".validate": boolean } } } };
};
const fullscreen = rules.rules.live.fullscreenRequest;
const request = (overrides: Record<string, unknown> = {}) => ({
  activationRevision: 7,
  currentVersionId: "version-1",
  revision: 1,
  ...overrides,
});
const root = (overrides: Record<string, unknown> = {}) => ({
  live: { current: { revision: 7, currentVersionId: "version-1" }, ...overrides },
});
function evaluate(expression: string, current: unknown, next: unknown, rootValue = root(), authenticated = true): boolean {
  const fn = new Function("auth", "data", "newData", "root", `return Boolean(${expression});`) as (
    auth: object | null,
    data: Snapshot,
    newData: Snapshot,
    root: Snapshot,
  ) => boolean;
  return fn(authenticated ? {} : null, new Snapshot(current), new Snapshot(next), new Snapshot(rootValue));
}

describe("live/fullscreenRequest rules", () => {
  it("requires public reads, authenticated writes, and the exact record shape", () => {
    expect(fullscreen[".read"]).toBe(true);
    expect(evaluate(fullscreen[".write"], null, request(), root(), false)).toBe(false);
    expect(evaluate(fullscreen[".validate"], null, request())).toBe(true);
    expect(fullscreen.$other[".validate"]).toBe(false);
    expect(evaluate(fullscreen[".validate"], null, request({ activationRevision: 6 }))).toBe(false);
    expect(evaluate(fullscreen[".validate"], null, request({ currentVersionId: "old" }))).toBe(false);
    expect(evaluate(fullscreen[".validate"], null, request({ revision: 0 }))).toBe(false);
  });

  it("allows first writes, increments only within one identity, and resets for a new identity", () => {
    const validate = fullscreen[".validate"];
    expect(evaluate(validate, null, request({ revision: 1 }))).toBe(true);
    expect(evaluate(validate, request({ revision: 4 }), request({ revision: 5 }))).toBe(true);
    expect(evaluate(validate, request({ revision: 4 }), request({ revision: 1, activationRevision: 8 }), root({ current: { revision: 8, currentVersionId: "version-1" } }))).toBe(true);
    expect(evaluate(validate, request({ revision: 4 }), request({ revision: 1, currentVersionId: "version-2" }), root({ current: { revision: 7, currentVersionId: "version-2" } }))).toBe(true);
    expect(evaluate(validate, request({ revision: 4 }), request({ revision: 1 }))).toBe(false);
    expect(evaluate(validate, request({ revision: 4 }), request({ revision: 2, activationRevision: 8 }), root({ current: { revision: 8, currentVersionId: "version-1" } }))).toBe(false);
    expect(evaluate(validate, request({ revision: 4 }), request({ revision: 2, currentVersionId: "version-2" }), root({ current: { revision: 7, currentVersionId: "version-2" } }))).toBe(false);
  });
});
