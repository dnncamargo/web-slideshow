Object.defineProperty(globalThis, "$ownerUid", { value: "owner-a", configurable: true });

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const rules = JSON.parse(readFileSync(resolve(process.cwd(), "../../database.rules.json"), "utf8")) as { rules: { live: { playerLogs: Record<string, unknown>; ".write": string } } };
const scopedRules = rules as unknown as { rules: { live: Record<string, any> } };

describe("live/owner-a/playerLogs rules", () => {
  it("allows public reads, authenticated writes, and exact records only", () => {
    const logs = scopedRules.rules.live["$ownerUid"].playerLogs;
    expect(logs[".read"]).toContain("$ownerUid");
    expect(logs[".write"]).toContain("auth.uid === $ownerUid");
    expect(logs[".validate"]).toContain("activationRevision");
    expect(logs[".validate"]).toContain("enabled");
    expect(logs[".validate"]).toContain("root.child('live').child($ownerUid).child('current/revision')");
    expect(logs["$other"]).toEqual({ ".validate": false });
  });

  it("requires playerLogs during whole-live cleanup", () => {
    expect(scopedRules.rules.live["$ownerUid"][".write"]).toContain("playerLogs");
  });
});
