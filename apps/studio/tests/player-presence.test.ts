import { describe, expect, it } from "vitest";
import { parsePlayerPresence, resolvePlayerOperationalStatus } from "../src/features/control/player-presence";

const live = { publicationId: "publication", currentVersionId: "version-1", revision: 4 };
const presence = (overrides: Record<string, unknown> = {}) => ({ activationRevision: 4, currentVersionId: "version-1", bootId: "boot-new", connected: true, stage: "starting", transitionedAt: 1, ...overrides });

describe("Player operational status", () => {
  it("never treats slide-state absence or equality as Player readiness", () => expect(resolvePlayerOperationalStatus(live, null)).toEqual({ kind: "no-report" }));
  it("resolves current connected boot stages", () => {
    expect(resolvePlayerOperationalStatus(live, parsePlayerPresence(presence()))?.kind).toBe("starting");
    expect(resolvePlayerOperationalStatus(live, parsePlayerPresence(presence({ stage: "ready" })) )?.kind).toBe("ready");
    expect(resolvePlayerOperationalStatus(live, parsePlayerPresence(presence({ stage: "load-failed", errorCode: "presentation-load-failed" })) )?.kind).toBe("load-failed");
  });
  it("ignores stale activations and versions and marks an observed offline boot disconnected", () => {
    expect(resolvePlayerOperationalStatus(live, parsePlayerPresence(presence({ activationRevision: 3 })) )).toEqual({ kind: "no-report" });
    expect(resolvePlayerOperationalStatus(live, parsePlayerPresence(presence({ currentVersionId: "old" })) )).toEqual({ kind: "no-report" });
    expect(resolvePlayerOperationalStatus(live, parsePlayerPresence(presence({ connected: false })) )?.kind).toBe("disconnected");
  });
  it("rejects malformed, unallowlisted, and extra persisted values", () => {
    expect(parsePlayerPresence(presence({ stage: "anything" }))).toBeNull();
    expect(parsePlayerPresence(presence({ extra: true }))).toBeNull();
    expect(parsePlayerPresence(presence({ stage: "load-failed" }))).toBeNull();
  });
});
