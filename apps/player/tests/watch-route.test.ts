import { describe, expect, it } from "vitest";

import mainSource from "../src/main.ts?raw";
import vercelSource from "../vercel.json?raw";

describe("public Watch runtime route", () => {
  it("dispatches /demo, /watch, and /cover before the standard Player entry", () => {
    expect(mainSource).toContain('window.location.pathname === "/demo"');
    expect(mainSource).toContain("startDemo(root)");
    expect(mainSource).toContain('window.location.pathname === "/watch"');
    expect(mainSource).toContain("startWatch(root)");
    expect(mainSource).toContain('window.location.pathname === "/cover"');
    expect(mainSource).toContain("startCover(root)");
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
    expect(config.rewrites).toContainEqual({ source: "/cover", destination: "/" });
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

  it("serves the exact cache-clearing technical response only on its dedicated route", () => {
    const config = JSON.parse(vercelSource) as {
      rewrites?: Array<{ source?: string; destination?: string }>;
      headers?: Array<{ source?: string; headers?: Array<{ key?: string; value?: string }> }>;
    };
    expect(config.rewrites).toContainEqual({
      source: "/__powershow/clear-cache",
      destination: "/__powershow/clear-cache.html",
    });
    expect(config.headers?.find((rule) => rule.source === "/__powershow/clear-cache")?.headers).toEqual([
      { key: "Clear-Site-Data", value: '"cache"' },
      { key: "Cache-Control", value: "no-store" },
    ]);
    expect(config.headers?.filter((rule) => rule.source !== "/__powershow/clear-cache").flatMap((rule) => rule.headers ?? []).some((header) => header.key === "Clear-Site-Data")).toBe(false);
  });

  it("keeps the technical return page same-origin and safely bounded", async () => {
    const source = await import.meta.glob("../public/__powershow/clear-cache.html", { query: "?raw", import: "default", eager: true });
    const html = Object.values(source)[0] as string;
    expect(html).toContain("window.location.origin");
    expect(html).toContain('window.location.replace(fallback)');
    expect(html).not.toContain("Clear-Site-Data");
  });
});
