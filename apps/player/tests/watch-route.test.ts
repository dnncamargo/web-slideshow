import { describe, expect, it } from "vitest";

import mainSource from "../src/main.ts?raw";
import vercelSource from "../vercel.json?raw";

describe("public Watch runtime route", () => {
  it("dispatches /demo and /watch before the standard Player entry", () => {
    expect(mainSource).toContain('window.location.pathname === "/demo"');
    expect(mainSource).toContain("startDemo(root)");
    expect(mainSource).toContain('window.location.pathname === "/watch"');
    expect(mainSource).toContain("startWatch(root)");
    expect(mainSource).toContain("startPlayer(root)");
  });

  it("rewrites /watch to the existing Vite entry without changing the browser path", () => {
    const config = JSON.parse(vercelSource) as {
      rewrites?: Array<{ source?: string; destination?: string }>;
      headers?: Array<{
        source?: string;
        headers?: Array<{ key?: string; value?: string }>;
      }>;
    };

    expect(config.rewrites).toContainEqual({
      source: "/watch",
      destination: "/",
    });
    expect(config.rewrites).toContainEqual({ source: "/demo", destination: "/" });
  });

  it("applies the same no-cache HTML policy to /demo", () => {
    const config = JSON.parse(vercelSource) as {
      headers?: Array<{ source?: string; headers?: Array<{ key?: string; value?: string }> }>;
    };
    const demoHeaders = config.headers?.find((rule) => rule.source === "/demo")?.headers;

    expect(demoHeaders).toEqual(config.headers?.find((rule) => rule.source === "/watch")?.headers);
  });

  it("applies the HTML/runtime no-cache headers before the /watch rewrite", () => {
    const config = JSON.parse(vercelSource) as {
      headers?: Array<{
        source?: string;
        headers?: Array<{ key?: string; value?: string }>;
      }>;
    };
    const watchHeaders = config.headers?.find(
      (rule) => rule.source === "/watch",
    )?.headers;

    expect(watchHeaders).toEqual([
      { key: "Cache-Control", value: "no-store, no-cache, must-revalidate, max-age=0" },
      { key: "CDN-Cache-Control", value: "no-store" },
      { key: "Vercel-CDN-Cache-Control", value: "no-store" },
      { key: "Pragma", value: "no-cache" },
      { key: "Expires", value: "0" },
    ]);
  });
});
