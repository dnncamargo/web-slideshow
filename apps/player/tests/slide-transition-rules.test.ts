Object.defineProperty(globalThis, "$ownerUid", { value: "owner-a", configurable: true });

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const parsedRules = JSON.parse(readFileSync(resolve(process.cwd(), "../../database.rules.json"), "utf8")) as { rules: { live: Record<string, unknown> } };
const rules = parsedRules as unknown as { rules: { live: Record<string, any> } };

describe("live/owner-a/slideTransition rules", () => {
  const transition = rules.rules.live["$ownerUid"].slideTransition;

  it("is public read", () => {
    expect(transition[".read"]).toContain("$ownerUid");
  });

  it("is authenticated-write for the current activation", () => {
    expect(transition[".write"]).toContain("auth.uid === $ownerUid");
    expect(transition[".validate"]).toContain("root.child('live').child($ownerUid).child('current/revision').val()");
    expect(transition[".validate"]).toContain("newData.hasChildren(['activationRevision', 'transition'])");
  });

  it("denies unauthenticated writes", () => {
    expect(String(transition[".write"])).not.toContain("true");
    expect(String(transition[".write"])).toContain("auth != null");
  });

  it("rejects stale activations", () => {
    expect(transition[".validate"]).toContain("activationRevision");
    expect(transition[".validate"]).toContain("root.child('live').child($ownerUid).child('current/revision').val()");
  });

  it("accepts slide alongside fade and none", () => {
    expect(String(transition[".validate"])).toContain("'slide'");
    const childTransition = (transition.transition as { ".validate": string })[".validate"];
    expect(childTransition).toContain("'fade'");
    expect(childTransition).toContain("'slide'");
    expect(childTransition).toContain("'none'");
  });

  it("rejects invalid transition values", () => {
    const childTransition = (transition.transition as { ".validate": string })[".validate"];
    expect(childTransition).toMatch(/=== '/);
    expect(childTransition).not.toContain("isString()");
    expect(childTransition).not.toContain("'zoom'");
  });

  it("rejects extra children", () => {
    expect((transition.$other as { ".validate": boolean })[".validate"]).toBe(false);
  });
});
