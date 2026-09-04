import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const rules = JSON.parse(readFileSync(resolve(process.cwd(), "../../database.rules.json"), "utf8")) as { rules: { live: { slideTransition: Record<string, unknown>; ".write": string } } };

describe("live/slideTransition rules", () => {
  const transition = rules.rules.live.slideTransition;

  it("is public read", () => {
    expect(transition[".read"]).toBe(true);
  });

  it("is authenticated-write for the current activation", () => {
    expect(transition[".write"]).toBe("auth != null");
    expect(transition[".validate"]).toContain("newData.child('activationRevision').val() === root.child('live/current/revision').val()");
    expect(transition[".validate"]).toContain("newData.hasChildren(['activationRevision', 'transition'])");
  });

  it("denies unauthenticated writes", () => {
    expect(String(transition[".write"])).not.toContain("true");
    expect(String(transition[".write"])).toContain("auth != null");
  });

  it("rejects stale activations", () => {
    expect(transition[".validate"]).toContain("activationRevision");
    expect(transition[".validate"]).toContain("root.child('live/current/revision').val()");
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