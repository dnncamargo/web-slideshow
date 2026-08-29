import { describe, expect, it } from "vitest";

import mainSource from "../src/main.ts?raw";
import vercelSource from "../vercel.json?raw";

describe("public Watch runtime route", () => {
  it("dispatches /watch to the Watch entry and every other path to Player", () => {
    expect(mainSource).toContain('window.location.pathname === "/watch"');
    expect(mainSource).toContain("startWatch(root)");
    expect(mainSource).toContain("startPlayer(root)");
  });

  it("rewrites /watch to the existing Vite entry without changing the browser path", () => {
    const config = JSON.parse(vercelSource) as {
      rewrites?: Array<{ source?: string; destination?: string }>;
    };

    expect(config.rewrites).toContainEqual({
      source: "/watch",
      destination: "/",
    });
  });
});
