import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const rules = JSON.parse(readFileSync(resolve(process.cwd(), "../../database.rules.json"), "utf8")) as { rules: { live: { playerControls: Record<string, unknown>; ".write": string } } };

describe("live/playerControls rules", () => {
  const controls = rules.rules.live.playerControls;

  it("is public read", () => {
    expect(controls[".read"]).toBe(true);
  });

  it("is authenticated-write for the current activation", () => {
    expect(controls[".write"]).toBe("auth != null");
    expect(String(controls[".validate"])).toContain("newData.hasChildren(['activationRevision', 'position', 'style', 'showCounter', 'animation'])");
    expect(String(controls[".validate"])).toContain("root.child('live/current/revision').val()");
  });

  it("denies unauthenticated writes", () => {
    expect(String(controls[".write"])).not.toContain("true");
    expect(String(controls[".write"])).toContain("auth != null");
  });

  it("rejects stale activations", () => {
    expect(String(controls[".validate"])).toContain("activationRevision");
    expect(String(controls[".validate"])).toContain("root.child('live/current/revision').val()");
  });

  it("accepts only the six canonical positions", () => {
    const child = (controls.position as { ".validate": string })[".validate"];
    for (const position of ["bottom-center", "bottom-left", "bottom-right", "top-center", "top-left", "top-right"]) {
      expect(child).toContain(`'${position}'`);
    }
    expect(child).not.toContain("'middle'");
    expect(child).not.toContain("isString()");
  });

  it("accepts only floating, minimal, and compact styles", () => {
    const child = (controls.style as { ".validate": string })[".validate"];
    for (const style of ["floating", "minimal", "compact"]) {
      expect(child).toContain(`'${style}'`);
    }
    expect(child).not.toContain("'large'");
  });

  it("requires showCounter to be a boolean", () => {
    expect((controls.showCounter as { ".validate": string })[".validate"]).toBe("newData.isBoolean()");
  });

  it("accepts only fade, slide, and none animations", () => {
    const child = (controls.animation as { ".validate": string })[".validate"];
    for (const animation of ["fade", "slide", "none"]) {
      expect(child).toContain(`'${animation}'`);
    }
    expect(child).not.toContain("'bounce'");
  });

  it("rejects extra children", () => {
    expect((controls.$other as { ".validate": boolean })[".validate"]).toBe(false);
  });

  it("is included in the whole-live cleanup rule", () => {
    expect(rules.rules.live[".write"]).toContain("slideTransition");
    expect(rules.rules.live[".write"]).toContain("playerControls");
  });
});