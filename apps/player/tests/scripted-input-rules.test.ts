import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

type Rule = { ".validate": string };
const input = (JSON.parse(readFileSync(resolve(process.cwd(), "../../database.rules.json"), "utf8")) as { rules: { live: { scriptedInput: { ".read": boolean; $scriptedSlot: { $portIndex: Record<string, Rule> & { ".write": string } } } } } }).rules.live.scriptedInput.$scriptedSlot.$portIndex;
const fields = ["activationRevision", "currentVersionId", "revision", "pageId", "elementId", "portId", "targetBootId", "targetMountRevision", "value"] as const;

describe("live Scripted input rule structure", () => {
  it("declares each legitimate record child before rejecting other descendants", () => {
    for (const field of fields) expect(input[field]?.[".validate"]).toBeTypeOf("string");
    expect(input.$other?.[".validate"]).toBe(false);
  });
  it("keeps public read and authenticated contextual writes", () => {
    expect((JSON.parse(readFileSync(resolve(process.cwd(), "../../database.rules.json"), "utf8")) as { rules: { live: { scriptedInput: { ".read": boolean } } } }).rules.live.scriptedInput[".read"]).toBe(true);
    expect(input[".write"]).toContain("auth != null");
    expect(input.revision?.[".validate"]).toContain("% 1 == 0");
    expect(input.targetMountRevision?.[".validate"]).toContain(">= 1");
    expect(input.value?.[".validate"]).toContain("isBoolean");
  });
});
