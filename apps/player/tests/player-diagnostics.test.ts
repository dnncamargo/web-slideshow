// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const STORAGE_KEY = "powershow:player-diagnostics:v1";

const PANEL_ELEMENT_ID = "powershow-player-diagnostics";

function makeStorage() {
  const map = new Map<string, string>();

  return {
    getItem: (key: string) => (map.has(key) ? (map.get(key) ?? null) : null),
    setItem: (key: string, value: string) => void map.set(key, value),
    map,
  };
}

beforeEach(() => {
  // Each test starts from a fresh module instance (fresh in-memory state),
  // while localStorage survives — matching a real page reload boundary.
  vi.resetModules();

  document.body.innerHTML = '<div id="app"></div>';
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe("player diagnostics (observability-only)", () => {
  it("does not touch storage or render a panel when disabled", async () => {
    const storage = makeStorage() as ReturnType<typeof makeStorage>;
    vi.stubGlobal("localStorage", storage);

    const diagnostics = await import("../src/player-diagnostics");

    diagnostics.configurePlayerDiagnostics(false);
    diagnostics.recordPlayerDiagnostic("BOOT");
    diagnostics.recordPlayerDiagnostic("FIRESTORE_LOAD_ERROR", {
      error: new Error("boom"),
    });

    expect(storage.map.has(STORAGE_KEY)).toBe(false);

    const panel = document.getElementById(PANEL_ELEMENT_ID);

    expect(panel).toBeNull();
  });

  it("persists events and renders an updating panel outside #app when enabled", async () => {
    const storage = makeStorage() as ReturnType<typeof makeStorage>;
    vi.stubGlobal("localStorage", storage);

    const diagnostics = await import("../src/player-diagnostics");

    diagnostics.configurePlayerDiagnostics(true);
    diagnostics.recordPlayerDiagnostic("FIRESTORE_LOAD_OK", { durationMs: 3 });

    const panel = document.getElementById(PANEL_ELEMENT_ID);

    expect(panel).not.toBeNull();

    // The panel is a sibling of #app, never a child of it, so Player rendering
    // (root.innerHTML replacement) cannot remove it.
    expect(panel?.parentNode).not.toBe(document.getElementById("app"));

    const stored = JSON.parse(storage.map.get(STORAGE_KEY) ?? "[]") as Array<{
      sequence: number;
      timestamp: string;
      sessionId: string;
      code: string;
      details?: unknown;
    }>;

    expect(stored).toHaveLength(1);
    expect(stored[0]?.code).toBe("FIRESTORE_LOAD_OK");
    expect(stored[0]?.details).toEqual({ durationMs: 3 });

    // The panel reflects the recorded event.
    const loadOkLines = document.querySelectorAll(
      `[data-diagnostics-code="FIRESTORE_LOAD_OK"]`,
    );

    expect(loadOkLines.length).toBeGreaterThanOrEqual(1);

    // Recording another event updates both storage and the rendered panel.
    diagnostics.recordPlayerDiagnostic("LIVE_EVENT_ACTIVE");

    const storedAfter = JSON.parse(storage.map.get(STORAGE_KEY) ?? "[]") as Array<{
      code: string;
    }>;

    expect(storedAfter).toHaveLength(2);

    const activeLine = document.querySelector(
      `[data-diagnostics-code="LIVE_EVENT_ACTIVE"]`,
    );

    expect(activeLine).not.toBeNull();
  });

  it("keeps only the newest 100 stored events", async () => {
    const storage = makeStorage() as ReturnType<typeof makeStorage>;
    vi.stubGlobal("localStorage", storage);

    const diagnostics = await import("../src/player-diagnostics");

    diagnostics.configurePlayerDiagnostics(true);

    for (let index = 0; index < 150; index += 1) {
      diagnostics.recordPlayerDiagnostic("BOOT");
    }

    const stored = JSON.parse(storage.map.get(STORAGE_KEY) ?? "[]") as Array<{
      sequence: number;
    }>;

    expect(stored).toHaveLength(100);

    // Ring buffer keeps the newest 100 (sequences 51..150).
    expect(stored[0]?.sequence).toBe(51);
    expect(stored[99]?.sequence).toBe(150);
  });

  it("never throws when localStorage fails", async () => {
    const failingStorage = {
      getItem: () => {
        throw new Error("storage down");
      },
      setItem: () => {
        throw new Error("storage down");
      },
    };

    vi.stubGlobal("localStorage", failingStorage);

    const diagnostics = await import("../src/player-diagnostics");

    diagnostics.configurePlayerDiagnostics(true);

    expect(() =>
      diagnostics.recordPlayerDiagnostic("PLAYER_MOUNT_ERROR", {
        error: new Error("boom"),
      }),
    ).not.toThrow();
  });

  it("serializes Error objects to safe name/code/message without a stack", async () => {
    const storage = makeStorage() as ReturnType<typeof makeStorage>;
    vi.stubGlobal("localStorage", storage);

    const diagnostics = await import("../src/player-diagnostics");

    diagnostics.configurePlayerDiagnostics(true);

    const error = new Error("boom") as Error & { code?: string; stack?: string };

    error.code = "PERMISSION_DENIED";
    error.stack = "    at some/deep/call.js:1:2";

    diagnostics.recordPlayerDiagnostic("FIRESTORE_LOAD_ERROR", { error });

    const stored = JSON.parse(storage.map.get(STORAGE_KEY) ?? "[]") as Array<{
      details: { error?: Record<string, unknown> };
    }>;

    expect(stored[0]?.details).toEqual({
      error: { name: "Error", code: "PERMISSION_DENIED", message: "boom" },
    });

    // The full stack trace and any accidental keys must never be persisted.
    expect("stack" in (stored[0]?.details.error ?? {})).toBe(false);
  });

  it("retains prior persisted events and appends new-session events after a reload", async () => {
    const storage = makeStorage() as ReturnType<typeof makeStorage>;
    vi.stubGlobal("localStorage", storage);

    const firstPage = await import("../src/player-diagnostics");

    firstPage.configurePlayerDiagnostics(true);
    firstPage.recordPlayerDiagnostic("FIRESTORE_LOAD_START");

    const beforeReload = JSON.parse(
      storage.map.get(STORAGE_KEY) ?? "[]",
    ) as Array<{ sessionId: string }>;

    const firstSessionId = beforeReload[0]?.sessionId;

    expect(firstSessionId).toBeTypeOf("string");

    // Simulate a page reload: a fresh module reads the same storage.
    vi.resetModules();

    const secondPage = await import("../src/player-diagnostics");

    secondPage.configurePlayerDiagnostics(true);
    secondPage.recordPlayerDiagnostic("BOOT");

    const afterReload = JSON.parse(storage.map.get(STORAGE_KEY) ?? "[]") as Array<{
      code: string;
      sessionId: string;
    }>;

    expect(afterReload).toHaveLength(2);

    // The older event from the previous session is still present.
    expect(afterReload[0]?.code).toBe("FIRESTORE_LOAD_START");
    expect(afterReload[0]?.sessionId).toBe(firstSessionId);

    // The new event belongs to the new session and is appended last.
    expect(afterReload[1]?.code).toBe("BOOT");
    expect(afterReload[1]?.sessionId).not.toBe(firstSessionId);
  });
});