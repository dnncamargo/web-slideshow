import { describe, expect, it } from "vitest";
import { parsePlayerPresence, resolveConnectedPlayerLeases, resolvePlayerOperationalStatus } from "../src/features/control/player-presence";

const live = { publicationId: "publication", currentVersionId: "version-1", revision: 4 };
const current = (overrides: Record<string, unknown> = {}) => ({ activationRevision: 4, currentVersionId: "version-1", bootId: "boot-b", stage: "starting", transitionedAt: 1, ...overrides });
const lease = (bootId: string, overrides: Record<string, unknown> = {}) => ({ activationRevision: 4, currentVersionId: "version-1", bootId, connected: true, transitionedAt: 1, ...overrides });
const presence = (currentOverrides: Record<string, unknown> = {}, leases: Record<string, unknown> = { "boot-b": lease("boot-b") }) => ({ current: current(currentOverrides), leases });
const status = (value: unknown) => resolvePlayerOperationalStatus(live, parsePlayerPresence(value));

describe("Player operational status", () => {
  it("never treats absent presence or slide convergence as Player readiness", () => {
    expect(status(null)).toEqual({ kind: "no-report" });
  });

  it("treats missing or stale current as no report", () => {
    expect(status({ leases: { "boot-b": lease("boot-b") } })).toEqual({ kind: "no-report" });
    expect(status(presence({ activationRevision: 3 }))).toEqual({ kind: "no-report" });
    expect(status(presence({ currentVersionId: "old" }))).toEqual({ kind: "no-report" });
  });

  it("requires the exact matching current lease", () => {
    expect(status(presence({}, {}))?.kind).toBe("disconnected");
    expect(status(presence({}, { "boot-b": lease("boot-b", { connected: false }) }))?.kind).toBe("disconnected");
    expect(status(presence({}, { "boot-a": lease("boot-a") }))?.kind).toBe("disconnected");
    expect(status(presence({}, {
      "boot-a": lease("boot-a", { connected: false }),
      "boot-b": lease("boot-b"),
    }))?.kind).toBe("starting");
  });

  it("resolves current stages only while the matching lease is online", () => {
    expect(status(presence())?.kind).toBe("starting");
    expect(status(presence({ stage: "ready" }))?.kind).toBe("ready");
    expect(status(presence({ stage: "load-failed", errorCode: "presentation-load-failed" }))?.kind).toBe("load-failed");
  });

  it("rejects malformed, unallowlisted, and extra persisted current values", () => {
    expect(parsePlayerPresence(presence({ stage: "anything" }))).toBeNull();
    expect(parsePlayerPresence(presence({ extra: true }))).toBeNull();
    expect(parsePlayerPresence(presence({ stage: "load-failed" }))).toBeNull();
  });

  it("ignores unrelated malformed leases", () => {
    expect(status(presence({}, { "boot-a": { malformed: true }, "boot-b": lease("boot-b") }))?.kind).toBe("starting");
  });

  it("discovers all connected leases aligned with the active version", () => {
    const found = resolveConnectedPlayerLeases({
      leases: {
        "boot-z": lease("boot-z"),
        "boot-a": lease("boot-a"),
        offline: lease("offline", { connected: false }),
        stale: lease("stale", { activationRevision: 3 }),
        old: lease("old", { currentVersionId: "version-0" }),
        broken: { nope: true },
      },
    }, live);
    expect(found.map((item) => item.bootId)).toEqual(["boot-a", "boot-z"]);
  });
});
