import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const rules = JSON.parse(readFileSync(resolve(process.cwd(), "../../database.rules.json"), "utf8")) as { rules: { live: { playerLogs: Record<string, unknown>; ".write": string } } };

describe("live/playerLogs rules", () => {
  it("allows public reads, authenticated writes, and exact records only", () => {
    const logs = rules.rules.live.playerLogs;
    expect(logs[".read"]).toBe(true);
    expect(logs[".write"]).toBe("auth != null");
    expect(logs[".validate"]).toContain("activationRevision");
    expect(logs[".validate"]).toContain("enabled");
    expect(logs[".validate"]).toContain("root.child('live/current/revision')");
    expect(logs["$other"]).toEqual({ ".validate": false });
  });

  it("requires playerLogs during whole-live cleanup", () => {
    expect(rules.rules.live[".write"]).toContain("playerLogs");
  });
});
