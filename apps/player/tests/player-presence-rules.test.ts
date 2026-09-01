import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

interface RulesNode {
  ".write": string;
  ".validate": string;
}

class Snapshot {
  constructor(private readonly value: unknown) {}

  child(path: string): Snapshot {
    let current = this.value;
    for (const part of path.split("/")) {
      current =
        typeof current === "object" && current !== null
          ? (current as Record<string, unknown>)[part]
          : undefined;
    }
    return new Snapshot(current);
  }

  exists(): boolean {
    return this.value !== undefined && this.value !== null;
  }

  hasChild(path: string): boolean {
    return this.child(path).exists();
  }

  hasChildren(paths: string[]): boolean {
    return paths.every((path) => this.hasChild(path));
  }

  isBoolean(): boolean {
    return typeof this.value === "boolean";
  }

  isNumber(): boolean {
    return typeof this.value === "number" && Number.isFinite(this.value);
  }

  isString(): boolean {
    return typeof this.value === "string";
  }

  val(): unknown {
    return this.value;
  }
}

const rules = JSON.parse(
  readFileSync(resolve(process.cwd(), "../../database.rules.json"), "utf8"),
) as { rules: { live: { playerPresence: RulesNode } } };
const presenceRules = rules.rules.live.playerPresence;

function report(bootId: string, overrides: Record<string, unknown> = {}) {
  return {
    activationRevision: 7,
    currentVersionId: "version-1",
    bootId,
    connected: true,
    stage: "starting",
    transitionedAt: 123,
    ...overrides,
  };
}

function evaluate(expression: string, options: {
  authenticated?: boolean;
  current?: unknown;
  next: unknown;
  live?: unknown;
}): boolean {
  const evaluateExpression = new Function(
    "auth",
    "data",
    "newData",
    "root",
    `return Boolean(${expression});`,
  ) as (
    auth: object | null,
    data: Snapshot,
    newData: Snapshot,
    root: Snapshot,
  ) => boolean;

  return evaluateExpression(
    options.authenticated === true ? {} : null,
    new Snapshot(options.current),
    new Snapshot(options.next),
    new Snapshot({
      live: options.live ?? {
        current: { revision: 7, currentVersionId: "version-1" },
      },
    }),
  );
}

function writeAllowed(options: Parameters<typeof evaluate>[1]): boolean {
  return evaluate(presenceRules[".write"], options);
}

function valid(next: unknown): boolean {
  return evaluate(presenceRules[".validate"], { next });
}

describe("live/playerPresence repository rules", () => {
  it("allows a new starting owner but rejects boot A disconnect after boot B owns the record", () => {
    const bootA = report("boot-a");
    const bootB = report("boot-b");

    expect(writeAllowed({ next: bootA })).toBe(true);
    expect(writeAllowed({ current: bootA, next: bootB })).toBe(true);
    expect(
      writeAllowed({
        current: bootB,
        next: report("boot-a", { connected: false }),
      }),
    ).toBe(false);
  });

  it("lets only the owning boot transition to ready or an allowlisted failure", () => {
    const bootB = report("boot-b");
    const ready = report("boot-b", { stage: "ready" });
    const failed = report("boot-b", {
      stage: "load-failed",
      errorCode: "presentation-load-failed",
    });

    expect(writeAllowed({ current: bootB, next: ready })).toBe(true);
    expect(valid(ready)).toBe(true);
    expect(writeAllowed({ current: bootB, next: failed })).toBe(true);
    expect(valid(failed)).toBe(true);
    expect(
      valid(
        report("boot-b", {
          stage: "load-failed",
          errorCode: "raw-error",
        }),
      ),
    ).toBe(false);
  });

  it("requires a replacement owner to start connected without an error", () => {
    const bootA = report("boot-a");

    expect(
      writeAllowed({
        current: bootA,
        next: report("boot-b", { stage: "ready" }),
      }),
    ).toBe(false);
    expect(
      writeAllowed({
        current: bootA,
        next: report("boot-b", { connected: false }),
      }),
    ).toBe(false);
    expect(
      writeAllowed({
        current: bootA,
        next: report("boot-b", {
          errorCode: "presentation-load-failed",
        }),
      }),
    ).toBe(false);
  });

  it("rejects stale activation/version writes and preserves authenticated cleanup", () => {
    const current = report("boot-a");

    expect(
      writeAllowed({
        current,
        next: report("boot-b", { activationRevision: 6 }),
      }),
    ).toBe(false);
    expect(
      writeAllowed({
        current,
        next: report("boot-b", { currentVersionId: "version-old" }),
      }),
    ).toBe(false);
    expect(writeAllowed({ authenticated: true, current, next: null })).toBe(true);
  });
});
