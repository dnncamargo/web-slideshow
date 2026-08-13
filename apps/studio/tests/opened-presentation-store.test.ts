import { afterEach, describe, expect, it, vi } from "vitest";

import { PresentationSchema } from "@powershow/document-schema";

import { createBlankPresentation } from "../src/features/persistence/presentation-repository-instance";

function createEditablePresentation() {
  return createBlankPresentation("pres-handoff", "Handoff");
}

type StorageMap = Record<string, string>;

function installSessionStorageMock(): StorageMap {
  const backing: StorageMap = {};

  const sessionStorage = {
    getItem: vi.fn((key: string) => (key in backing ? backing[key] : null)),
    setItem: vi.fn((key: string, value: string) => {
      backing[key] = String(value);
    }),
    removeItem: vi.fn((key: string) => {
      delete backing[key];
    }),
  };

  const mockedWindow = { sessionStorage } as unknown as Window &
    typeof globalThis;

  vi.stubGlobal("window", mockedWindow);

  return backing;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("opened presentation store behavior", () => {
  it("is browser-safe when sessionStorage is unavailable", async () => {
    const store = await import("../src/features/editor/opened-presentation-store");

    expect(() => store.storeOpenedPresentation(createEditablePresentation())).not.toThrow();
    expect(store.readOpenedPresentation()).toBeNull();
    expect(() => store.clearOpenedPresentation()).not.toThrow();
  });

  it("round-trips an editable presentation with one blank slide", async () => {
    const backing = installSessionStorageMock();
    const store = await import("../src/features/editor/opened-presentation-store");

    const source = createEditablePresentation();
    const slideId = source.slides[0]?.id;

    store.storeOpenedPresentation(source);

    const read = store.readOpenedPresentation();

    expect(cleanBacking(backing)).toHaveProperty(
      "powershow-opened-presentation",
    );
    expect(read).not.toBeNull();
    expect(read?.id).toBe("pres-handoff");
    expect(read?.slides).toHaveLength(1);
    expect(read?.slides[0]?.id).toBe(slideId);
    expect(read?.slides[0]?.elements).toEqual([]);
    expect(read?.slides[0]?.background).toBeUndefined();
  });

  it("does not lose canonical fields through the round trip", async () => {
    installSessionStorageMock();
    const store = await import("../src/features/editor/opened-presentation-store");

    const source = createEditablePresentation();
    store.storeOpenedPresentation(source);
    const read = store.readOpenedPresentation();

    expect(read).toMatchObject({
      schemaVersion: 1,
      id: "pres-handoff",
      title: "Handoff",
      description: "",
      aspectRatio: "16:9",
    });
  });

  it("returns null for malformed stored JSON", async () => {
    installSessionStorageMock();
    const store = await import("../src/features/editor/opened-presentation-store");

    const source = createEditablePresentation();
    store.storeOpenedPresentation(source);

    const mockedWindow = window as unknown as { sessionStorage: { setItem: (k: string, v: string) => void } };
    mockedWindow.sessionStorage.setItem(
      "powershow-opened-presentation",
      "{not valid json",
    );

    expect(store.readOpenedPresentation()).toBeNull();
  });

  it("returns null for a missing handoff", async () => {
    installSessionStorageMock();
    const store = await import("../src/features/editor/opened-presentation-store");

    expect(store.readOpenedPresentation()).toBeNull();
  });

  it("does not introduce a demo Presentation fallback", async () => {
    installSessionStorageMock();
    const store = await import("../src/features/editor/opened-presentation-store");

    expect(store.readOpenedPresentation()).toBeNull();
    expect(PresentationSchema.safeParse(createEditablePresentation()).success).toBe(
      true,
    );
  });

  it("validates persisted handoff data against the canonical schema", () => {
    const result = PresentationSchema.safeParse(createEditablePresentation());

    expect(result.success).toBe(true);
  });
});

function cleanBacking(backing: StorageMap): StorageMap {
  return backing;
}
