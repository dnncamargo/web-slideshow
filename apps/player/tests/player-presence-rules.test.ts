import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

interface RuleNode {
  ".write": string;
  ".validate"?: string;
  "$other"?: { ".validate": boolean };
}

interface PresenceRules extends RuleNode {
  current: RuleNode;
  leases: { "$bootId": RuleNode };
}

class Snapshot {
  constructor(private readonly value: unknown) {}

  child(path: string): Snapshot {
    let current = this.value;
    for (const part of path.split("/")) {
      current = typeof current === "object" && current !== null
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
) as { rules: { live: { playerPresence: PresenceRules } } };
const presenceRules = rules.rules.live.playerPresence;

function current(bootId: string, overrides: Record<string, unknown> = {}) {
  return {
    activationRevision: 7,
    currentVersionId: "version-1",
    bootId,
    stage: "starting",
    transitionedAt: 123,
    ...overrides,
  };
}

function lease(bootId: string, overrides: Record<string, unknown> = {}) {
  return {
    activationRevision: 7,
    currentVersionId: "version-1",
    bootId,
    connected: true,
    transitionedAt: 123,
    ...overrides,
  };
}

function liveWithLeases(leases: Record<string, unknown> = {}) {
  return {
    current: { revision: 7, currentVersionId: "version-1" },
    playerPresence: { leases },
  };
}

function evaluate(
  expression: string,
  options: {
    authenticated?: boolean;
    current?: unknown;
    next: unknown;
    live?: unknown;
    bootId?: string;
  },
): boolean {
  const evaluateExpression = new Function(
    "auth",
    "data",
    "newData",
    "root",
    "$bootId",
    `return Boolean(${expression});`,
  ) as (
    auth: object | null,
    data: Snapshot,
    newData: Snapshot,
    root: Snapshot,
    bootId: string | undefined,
  ) => boolean;

  return evaluateExpression(
    options.authenticated === true ? {} : null,
    new Snapshot(options.current),
    new Snapshot(options.next),
    new Snapshot({ live: options.live ?? liveWithLeases() }),
    options.bootId,
  );
}

function currentWriteAllowed(options: Parameters<typeof evaluate>[1]): boolean {
  return evaluate(presenceRules.current[".write"], options);
}

function currentValid(next: unknown, live = liveWithLeases()): boolean {
  return evaluate(presenceRules.current[".validate"]!, { next, live });
}

function leaseWriteAllowed(bootId: string, next: unknown, overrides: Partial<Parameters<typeof evaluate>[1]> = {}): boolean {
  return evaluate(presenceRules.leases.$bootId[".write"], { next, bootId, ...overrides });
}

function leaseValid(bootId: string, next: unknown, live = liveWithLeases()): boolean {
  return evaluate(presenceRules.leases.$bootId[".validate"]!, { next, live, bootId });
}

describe("live/playerPresence repository rules", () => {
  it("allows each boot to register and update only its keyed strict lease", () => {
    expect(leaseWriteAllowed("boot-a", lease("boot-a", { connected: false }))).toBe(true);
    expect(leaseWriteAllowed("boot-a", lease("boot-a"))).toBe(true);
    expect(leaseValid("boot-a", lease("boot-a"))).toBe(true);
    expect(leaseWriteAllowed("boot-b", lease("boot-b", { connected: false }))).toBe(true);
    expect(leaseWriteAllowed("boot-b", lease("boot-b"))).toBe(true);
    expect(leaseWriteAllowed("boot-a", lease("boot-b"))).toBe(false);
    expect(leaseValid("boot-a", lease("boot-b"))).toBe(false);
  });

  it("requires a connected matching lease before a boot can claim current", () => {
    const bootA = current("boot-a");

    expect(currentWriteAllowed({ next: bootA })).toBe(false);
    expect(currentWriteAllowed({ next: bootA, live: liveWithLeases({ "boot-a": lease("boot-a", { connected: false }) }) })).toBe(false);
    expect(currentWriteAllowed({ next: bootA, live: liveWithLeases({ "boot-a": lease("boot-a") }) })).toBe(true);
    expect(currentValid(bootA)).toBe(true);
    expect(currentWriteAllowed({ current: bootA, next: current("boot-a", { stage: "ready" }) })).toBe(true);
  });

  it("keeps current B and lease B unchanged when boot A disconnects", () => {
    const bootB = current("boot-b");
    const leases = {
      "boot-a": lease("boot-a"),
      "boot-b": lease("boot-b"),
    };

    expect(currentWriteAllowed({ current: current("boot-a", { stage: "ready" }), next: bootB, live: liveWithLeases(leases) })).toBe(true);
    expect(leaseWriteAllowed("boot-a", lease("boot-a", { connected: false }), { current: leases["boot-a"], live: liveWithLeases(leases) })).toBe(true);
    expect(bootB.bootId).toBe("boot-b");
    expect(leases["boot-b"].connected).toBe(true);
    expect(currentWriteAllowed({ current: bootB, next: current("boot-a", { stage: "ready" }), live: liveWithLeases(leases) })).toBe(false);
  });

  it("allows only current boot B to become ready or report an allowlisted failure", () => {
    const bootB = current("boot-b");
    const ready = current("boot-b", { stage: "ready" });
    const failed = current("boot-b", { stage: "load-failed", errorCode: "presentation-load-failed" });

    expect(currentWriteAllowed({ current: bootB, next: ready })).toBe(true);
    expect(currentValid(ready)).toBe(true);
    expect(currentWriteAllowed({ current: ready, next: failed })).toBe(true);
    expect(currentValid(failed)).toBe(true);
    expect(currentValid(current("boot-b", { stage: "load-failed", errorCode: "raw-error" }))).toBe(false);
  });

  it("rejects stale, malformed, mismatched, and extra-property records", () => {
    expect(leaseWriteAllowed("boot-a", lease("boot-a", { activationRevision: 6 }))).toBe(false);
    expect(leaseWriteAllowed("boot-a", lease("boot-a", { currentVersionId: "old" }))).toBe(false);
    expect(leaseValid("boot-a", { ...lease("boot-a"), transitionedAt: "now" })).toBe(false);
    expect(currentWriteAllowed({ next: current("boot-a", { activationRevision: 6 }), live: liveWithLeases({ "boot-a": lease("boot-a", { activationRevision: 6 }) }) })).toBe(false);
    expect(currentWriteAllowed({ next: current("boot-a", { currentVersionId: "old" }), live: liveWithLeases({ "boot-a": lease("boot-a", { currentVersionId: "old" }) }) })).toBe(false);
    expect(currentValid({ ...current("boot-a"), transitionedAt: "now" })).toBe(false);
    expect(presenceRules.current.$other?.[".validate"]).toBe(false);
    expect(presenceRules.leases.$bootId.$other?.[".validate"]).toBe(false);
  });

  it("preserves authenticated cleanup of the complete subtree", () => {
    expect(evaluate(presenceRules[".write"], { authenticated: true, current: { current: current("boot-a"), leases: { "boot-a": lease("boot-a") } }, next: null })).toBe(true);
  });
});
