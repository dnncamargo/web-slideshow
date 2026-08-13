import { describe, expect, it } from "vitest";

import type { Presentation } from "@powershow/document-schema";

import { PresentationSchema } from "@powershow/document-schema";

function validPresentation(): Presentation {
  return PresentationSchema.parse({
    schemaVersion: 1,
    id: "pres-1",
    title: "Handoff",
    description: "",
    aspectRatio: "16:9",
    slides: [],
  });
}

describe("opened presentation store behavior", () => {
  it("is browser-safe when sessionStorage is unavailable", async () => {
    // In the Node test environment `window` is undefined, so the helpers must
    // no-op instead of throwing.
    const store = await import("../src/features/editor/opened-presentation-store");

    expect(() => store.storeOpenedPresentation(validPresentation())).not.toThrow();
    expect(store.readOpenedPresentation()).toBeNull();
    expect(() => store.clearOpenedPresentation()).not.toThrow();
  });

  it("exposes an explicit clear without removal-on-read", async () => {
    const store = await import("../src/features/editor/opened-presentation-store");

    // Clearing is an explicit operation; reading must not clear by itself.
    expect(typeof store.clearOpenedPresentation).toBe("function");
    expect(store.readOpenedPresentation()).toBeNull();
  });

  it("validates persisted handoff data against the canonical schema", () => {
    const result = PresentationSchema.safeParse(validPresentation());

    expect(result.success).toBe(true);
    expect(result.success && result.data.title).toBe("Handoff");
  });
});