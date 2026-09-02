import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  CONTROL_LATENCY_SNAPSHOT_KEY,
  parseControlLatencySnapshot,
  readControlLatencySnapshot,
  recordControlLatencyMeasurement,
  writeControlLatencySnapshot,
  type ControlLatencySnapshot,
} from "../src/features/control/control-latency-snapshot";

function createStorage() {
  const values = new Map<string, string>();
  return {
    values,
    getItem: vi.fn((key: string) => values.get(key) ?? null),
    setItem: vi.fn((key: string, value: string) => {
      values.set(key, value);
    }),
  };
}

const snapshot = (
  overrides: Partial<ControlLatencySnapshot> = {},
): ControlLatencySnapshot => ({
  publicationId: "publication-1",
  activationRevision: 7,
  currentVersionId: "version-1",
  latencyMs: 45.4,
  measuredAt: 1234,
  ...overrides,
});

const identity = {
  publicationId: "publication-1",
  activationRevision: 7,
  currentVersionId: "version-1",
};

describe("Control latency snapshot", () => {
  beforeEach(() => {
    vi.stubGlobal("sessionStorage", createStorage());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("strictly round-trips one matching latest snapshot", () => {
    const value = snapshot();

    writeControlLatencySnapshot(value);

    expect(readControlLatencySnapshot(identity)).toEqual(value);
    const raw = sessionStorage.getItem(CONTROL_LATENCY_SNAPSHOT_KEY);
    expect(raw).not.toBeNull();
    expect(Array.isArray(JSON.parse(raw ?? "null") as unknown)).toBe(false);
  });

  it("rejects extra fields and malformed values", () => {
    expect(
      parseControlLatencySnapshot({ ...snapshot(), extra: true }),
    ).toBeNull();

    for (const value of [
      null,
      [],
      { ...snapshot(), publicationId: "" },
      { ...snapshot(), publicationId: " publication-1" },
      { ...snapshot(), activationRevision: 1.5 },
      { ...snapshot(), currentVersionId: "" },
      { ...snapshot(), measuredAt: "now" },
      { ...snapshot(), measuredAt: -1 },
    ]) {
      expect(parseControlLatencySnapshot(value)).toBeNull();
    }
  });

  it.each([-1, Number.NaN, Number.POSITIVE_INFINITY])(
    "rejects invalid latency %s",
    (latencyMs) => {
      expect(parseControlLatencySnapshot(snapshot({ latencyMs }))).toBeNull();
    },
  );

  it.each([
    [{ ...identity, publicationId: "publication-2" }, "publication"],
    [{ ...identity, activationRevision: 8 }, "activation"],
    [{ ...identity, currentVersionId: "version-2" }, "version"],
  ] as const)("ignores the wrong %s identity", (wrongIdentity, _label) => {
    writeControlLatencySnapshot(snapshot());
    expect(readControlLatencySnapshot(wrongIdentity)).toBeNull();
  });

  it("treats throwing sessionStorage reads and writes as unavailable", () => {
    vi.stubGlobal("sessionStorage", {
      getItem: () => {
        throw new Error("read unavailable");
      },
      setItem: () => {
        throw new Error("write unavailable");
      },
    });

    expect(readControlLatencySnapshot(identity)).toBeNull();
    expect(() => writeControlLatencySnapshot(snapshot())).not.toThrow();
  });

  it("writes only synced numeric measurements and preserves the last measurement otherwise", () => {
    const storage = sessionStorage as Storage & {
      setItem: ReturnType<typeof vi.fn>;
    };

    recordControlLatencyMeasurement(identity, { kind: "syncing" }, 2000);
    recordControlLatencyMeasurement(identity, { kind: "synced" }, 2000);
    expect(storage.setItem).not.toHaveBeenCalled();

    recordControlLatencyMeasurement(
      identity,
      { kind: "synced", latencyMs: 45 },
      2000,
    );
    expect(readControlLatencySnapshot(identity)).toEqual(
      snapshot({ latencyMs: 45, measuredAt: 2000 }),
    );

    recordControlLatencyMeasurement(identity, { kind: "synced" }, 3000);
    expect(readControlLatencySnapshot(identity)).toEqual(
      snapshot({ latencyMs: 45, measuredAt: 2000 }),
    );
    expect(storage.setItem).toHaveBeenCalledTimes(1);
  });

  it("replaces the single snapshot instead of accumulating history", () => {
    recordControlLatencyMeasurement(
      identity,
      { kind: "synced", latencyMs: 20 },
      1000,
    );
    recordControlLatencyMeasurement(
      identity,
      { kind: "synced", latencyMs: 30 },
      2000,
    );

    expect(readControlLatencySnapshot(identity)).toEqual(
      snapshot({ latencyMs: 30, measuredAt: 2000 }),
    );
    const stored = JSON.parse(
      sessionStorage.getItem(CONTROL_LATENCY_SNAPSHOT_KEY) ?? "null",
    ) as unknown;
    expect(Array.isArray(stored)).toBe(false);
  });
});
