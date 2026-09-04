import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  ref: vi.fn(),
  runTransaction: vi.fn(),
  getDatabase: vi.fn(),
  getCurrentNonAnonymousUser: vi.fn(),
  getApps: vi.fn(() => []),
  initializeApp: vi.fn(() => ({})),
}));

vi.mock("firebase/database", () => ({
  ref: mocks.ref,
  runTransaction: mocks.runTransaction,
  getDatabase: mocks.getDatabase,
  set: vi.fn(),
}));
vi.mock("firebase/app", () => ({
  getApps: mocks.getApps,
  initializeApp: mocks.initializeApp,
  getApp: vi.fn(() => ({})),
}));
vi.mock("../src/features/auth/firebase-auth", () => ({
  getCurrentNonAnonymousUser: mocks.getCurrentNonAnonymousUser,
}));

import {
  buildScriptedActionPath,
  buildScriptedActionRootPath,
  parseLiveScriptedActionRecord,
} from "../src/features/live/scripted-action";
import {
  writeScriptedAction,
  type ScriptedActionRequest,
} from "../src/features/control/control-command-writer";

const record = (overrides: Record<string, unknown> = {}) => ({
  activationRevision: 2,
  currentVersionId: "version-1",
  revision: 1,
  pageId: "page-1",
  elementId: "scripted-1",
  portId: "scroll-down",
  targetBootId: "boot-1",
  ...overrides,
});
const request = (overrides: Partial<ScriptedActionRequest> = {}): ScriptedActionRequest => ({
  activationRevision: 2,
  currentVersionId: "version-1",
  pageId: "page-1",
  scriptedSlot: 0,
  elementId: "scripted-1",
  portIndex: 0,
  portId: "scroll-down",
  targetBootId: "boot-1",
  ...overrides,
});

describe("Scripted action live contract", () => {
  it("builds deterministic numeric paths and rejects invalid indexes", () => {
    expect(buildScriptedActionRootPath()).toBe("live/scriptedAction");
    expect(buildScriptedActionPath(0, 0)).toBe("live/scriptedAction/0/0");
    expect(buildScriptedActionPath(12, 34)).toBe("live/scriptedAction/12/34");
    for (const invalid of [-1, 1.5, NaN, Infinity]) {
      expect(() => buildScriptedActionPath(invalid, 0)).toThrow();
      expect(() => buildScriptedActionPath(0, invalid)).toThrow();
    }
  });

  it("strictly parses only the exact valid record shape", () => {
    expect(parseLiveScriptedActionRecord(record())).toEqual(record());
    expect(parseLiveScriptedActionRecord(record({ elementId: " /.#$[] ", portId: " port/#[] " }))).toMatchObject({ elementId: " /.#$[] ", portId: " port/#[] " });
    for (const invalid of [
      { ...record(), targetBootId: undefined },
      { ...record(), extra: true },
      { activationRevision: 2, currentVersionId: "v", revision: 1, pageId: "p", elementId: "e", portId: "x", unexpected: "b" },
      record({ revision: 0 }),
      record({ revision: 1.5 }),
      record({ currentVersionId: " " }),
      record({ pageId: " " }),
      record({ portId: "" }),
      record({ targetBootId: " " }),
      null,
      [],
    ]) {
      expect(parseLiveScriptedActionRecord(invalid)).toBeNull();
    }
  });
});

describe("Scripted action writer", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("NEXT_PUBLIC_FIREBASE_API_KEY", "key");
    vi.stubEnv("NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN", "domain");
    vi.stubEnv("NEXT_PUBLIC_FIREBASE_PROJECT_ID", "project");
    vi.stubEnv("NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET", "bucket");
    vi.stubEnv("NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID", "sender");
    vi.stubEnv("NEXT_PUBLIC_FIREBASE_APP_ID", "app");
    vi.stubEnv("NEXT_PUBLIC_FIREBASE_DATABASE_URL", "https://example.firebaseio.com");
    mocks.getDatabase.mockReturnValue({});
    mocks.ref.mockImplementation((_database, path: string) => ({ path }));
    mocks.getCurrentNonAnonymousUser.mockReturnValue({ uid: "user-1" });
    mocks.runTransaction.mockImplementation(async (_ref, updater) => {
      const value = updater(null);
      return { committed: true, snapshot: { val: () => value } };
    });
  });

  afterEach(() => vi.unstubAllEnvs());

  it("uses a leaf transaction and increments repeated identical occurrences", async () => {
    let previous: unknown = null;
    mocks.runTransaction.mockImplementation(async (_ref, updater) => {
      const value = updater(previous);
      previous = value;
      return { committed: true, snapshot: { val: () => value } };
    });

    await expect(writeScriptedAction({} as never, request())).resolves.toMatchObject({ revision: 1 });
    await expect(writeScriptedAction({} as never, request())).resolves.toMatchObject({ revision: 2 });
    await expect(writeScriptedAction({} as never, request())).resolves.toMatchObject({ revision: 3 });
    expect(mocks.ref).toHaveBeenCalledWith({}, "live/scriptedAction/0/0");
    expect(mocks.runTransaction).toHaveBeenCalledTimes(3);
  });

  it("restarts at one when any full identity field changes", async () => {
    const previous = record({ revision: 8 });
    for (const changed of [
      { activationRevision: 3 },
      { currentVersionId: "version-2" },
      { pageId: "page-2" },
      { elementId: "scripted-2" },
      { portId: "scroll-up" },
      { targetBootId: "boot-2" },
    ]) {
      mocks.runTransaction.mockImplementationOnce(async (_ref, updater) => {
        const value = updater(previous);
        return { committed: true, snapshot: { val: () => value } };
      });
      await expect(writeScriptedAction({} as never, request(changed))).resolves.toMatchObject({ revision: 1 });
    }
  });

  it("rejects invalid input before transaction", async () => {
    for (const invalid of [
      request({ activationRevision: -1 }),
      request({ scriptedSlot: 0.5 }),
      request({ portIndex: -1 }),
      request({ currentVersionId: " " }),
      request({ pageId: " " }),
      request({ elementId: "" }),
      request({ portId: "" }),
      request({ targetBootId: " " }),
    ]) {
      await expect(writeScriptedAction({} as never, invalid)).rejects.toThrow();
    }
    expect(mocks.runTransaction).not.toHaveBeenCalled();
  });

  it("rejects uncommitted and malformed committed results", async () => {
    mocks.runTransaction.mockResolvedValueOnce({ committed: false, snapshot: { val: () => record() } });
    await expect(writeScriptedAction({} as never, request())).rejects.toThrow(/did not commit/);
    mocks.runTransaction.mockResolvedValueOnce({ committed: true, snapshot: { val: () => record({ revision: 0 }) } });
    await expect(writeScriptedAction({} as never, request())).rejects.toThrow(/malformed/);
  });
});
