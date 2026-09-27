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
  buildCheckboxControlRootPath,
  buildCheckboxControlSlotPath,
  parseLiveCheckboxControlState,
} from "../src/features/live/checkbox-control";
import { writeCheckboxControlState } from "../src/features/control/control-command-writer";

const valid = (overrides: Record<string, unknown> = {}) => ({
  activationRevision: 2,
  currentVersionId: "v",
  revision: 1,
  pageId: "p",
  elementId: " topics / #% ",
  checkboxId: " item / #% ",
  state: "unchecked",
  ...overrides,
});
const database = {} as never;

describe("checkbox control wire and writer", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("NEXT_PUBLIC_FIREBASE_API_KEY", "k");
    vi.stubEnv("NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN", "d");
    vi.stubEnv("NEXT_PUBLIC_FIREBASE_PROJECT_ID", "p");
    vi.stubEnv("NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET", "b");
    vi.stubEnv("NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID", "m");
    vi.stubEnv("NEXT_PUBLIC_FIREBASE_APP_ID", "a");
    vi.stubEnv("NEXT_PUBLIC_FIREBASE_DATABASE_URL", "https://x");
    mocks.getDatabase.mockReturnValue({});
    mocks.ref.mockImplementation((_database, path) => ({ path }));
    mocks.getCurrentNonAnonymousUser.mockReturnValue({ uid: "u" });
    mocks.runTransaction.mockImplementation(async (_ref, updater) => {
      const value = updater(null);
      return { committed: true, snapshot: { val: () => value } };
    });
  });

  afterEach(() => vi.unstubAllEnvs());

  it("builds the exact root and numeric slot paths", () => {
    expect(buildCheckboxControlRootPath()).toBe("live/checkboxControl");
    expect(buildCheckboxControlSlotPath(0)).toBe("live/checkboxControl/0");
    expect(buildCheckboxControlSlotPath(12)).toBe("live/checkboxControl/12");
    expect(() => buildCheckboxControlSlotPath(-1)).toThrow();
    expect(() => buildCheckboxControlSlotPath(1.5)).toThrow();
  });

  it("strictly parses exactly seven fields and preserves canonical ids", () => {
    expect(parseLiveCheckboxControlState(valid())).toEqual(valid());
    expect(parseLiveCheckboxControlState(valid({ currentVersionId: " v ", pageId: " p " }))).toMatchObject({
      currentVersionId: "v",
      pageId: "p",
    });
    expect(parseLiveCheckboxControlState(valid({ elementId: " topics / #% " }))).toMatchObject({ elementId: " topics / #% " });
    expect(parseLiveCheckboxControlState(valid({ checkboxId: " item / #% " }))).toMatchObject({ checkboxId: " item / #% " });

    for (const value of [
      { ...valid(), extra: true },
      valid({ activationRevision: -1 }),
      valid({ activationRevision: 1.5 }),
      valid({ revision: 0 }),
      valid({ revision: 1.5 }),
      valid({ currentVersionId: "   " }),
      valid({ pageId: "   " }),
      valid({ elementId: "" }),
      valid({ checkboxId: "" }),
      valid({ state: "toggle" }),
      valid({ state: "mixed" }),
      valid({ state: true }),
    ]) {
      expect(parseLiveCheckboxControlState(value)).toBeNull();
    }
  });

  it("writes revision one, increments state-only changes, and emits only absolute state", async () => {
    let previous: unknown = null;
    mocks.runTransaction.mockImplementation(async (_ref, updater) => {
      const value = updater(previous);
      previous = value;
      return { committed: true, snapshot: { val: () => value } };
    });

    const first = await writeCheckboxControlState(database, 2, "v", "p", 0, " topics / #% ", " item / #% ", "unchecked");
    expect(first).toEqual(valid());
    expect(mocks.ref).toHaveBeenCalledWith(database, "live/checkboxControl/0");
    const second = await writeCheckboxControlState(database, 2, "v", "p", 0, " topics / #% ", " item / #% ", "checked");
    expect(second).toMatchObject({ revision: 2, state: "checked" });
    expect(second).not.toHaveProperty("checked");
    expect(second).not.toHaveProperty("indeterminate");
    expect(second).not.toHaveProperty("checkboxMode");
    expect(second).not.toHaveProperty("targetBootId");
  });

  it("resets revision for every changed identity generation", async () => {
    const changes = [
      [2, "v", "page-2", "e", "c"],
      [3, "v", "p", "e", "c"],
      [2, "v2", "p", "e", "c"],
      [2, "v", "p", "e-2", "c"],
      [2, "v", "p", "e", "c-2"],
    ] as const;

    for (const [activationRevision, currentVersionId, pageId, elementId, checkboxId] of changes) {
      mocks.runTransaction.mockImplementationOnce(async (_ref, updater) => {
        const value = updater(valid({ revision: 8 }));
        return { committed: true, snapshot: { val: () => value } };
      });
      await expect(writeCheckboxControlState(
        database,
        activationRevision,
        currentVersionId,
        pageId,
        0,
        elementId,
        checkboxId,
        "intermediate",
      )).resolves.toMatchObject({ revision: 1 });
    }
  });

  it("requires authenticated Control and rejects malformed inputs before transaction", async () => {
    mocks.getCurrentNonAnonymousUser.mockReturnValue(null);
    await expect(writeCheckboxControlState(database, 2, "v", "p", 0, "e", "c", "checked")).rejects.toThrow();
    expect(mocks.runTransaction).not.toHaveBeenCalled();

    mocks.getCurrentNonAnonymousUser.mockReturnValue({ uid: "u" });
    const malformedInputs: ReadonlyArray<ReadonlyArray<unknown>> = [
      [-1, "v", "p", 0, "e", "c", "checked"],
      [2, "v", "p", -1, "e", "c", "checked"],
      [2, "v", "p", 0.5, "e", "c", "checked"],
      [2, "v", "p", 0, "", "c", "checked"],
      [2, "v", "p", 0, "e", "", "checked"],
      [2, "   ", "p", 0, "e", "c", "checked"],
      [2, "v", "   ", 0, "e", "c", "checked"],
      [2, "v", "p", 0, "e", "c", "toggle"],
    ];

    for (const args of malformedInputs) {
      await expect(Reflect.apply(writeCheckboxControlState, null, [{}, ...args])).rejects.toThrow();
    }
    expect(mocks.runTransaction).not.toHaveBeenCalled();
  });

  it("rejects an uncommitted or malformed committed transaction", async () => {
    mocks.runTransaction.mockResolvedValueOnce({ committed: false, snapshot: { val: () => valid() } });
    await expect(writeCheckboxControlState(database, 2, "v", "p", 0, "e", "c", "checked")).rejects.toThrow(/did not commit/);

    mocks.runTransaction.mockResolvedValueOnce({ committed: true, snapshot: { val: () => ({}) } });
    await expect(writeCheckboxControlState(database, 2, "v", "p", 0, "e", "c", "checked")).rejects.toThrow(/malformed/);
  });
});
