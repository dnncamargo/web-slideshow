import { readFile } from "node:fs/promises";

import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import { POST } from "../src/app/api/fonts/google/import/route";

let audiowideCss = "";

beforeAll(async () => {
  audiowideCss = await readFile(
    new URL("./fixtures/google-fonts/audiowide.css", import.meta.url),
    "utf8",
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function importRequest(body: unknown): Request {
  return new Request("http://studio.test/api/fonts/google/import", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/fonts/google/import", () => {
  it("returns normalized resources without the original stylesheet", async () => {
    const fetchMock = vi.fn(
      async () =>
        new Response(audiowideCss, {
          headers: { "content-type": "text/css; charset=utf-8" },
        }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const response = await POST(
      importRequest({
        url: "https://fonts.googleapis.com/css2?family=Audiowide&display=swap",
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toMatchObject({
      ok: true,
      result: {
        families: [
          {
            family: "Audiowide",
            variants: [
              {
                weight: 400,
                style: "normal",
              },
            ],
          },
        ],
      },
    });
    expect(body.result.families[0].variants[0].faces).toHaveLength(2);
    expect(JSON.stringify(body)).not.toContain("@font-face");
    expect(JSON.stringify(body)).not.toContain("fonts.googleapis.com/css2");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("rejects malformed JSON and an invalid hostname before fetch", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const malformedResponse = await POST(
      new Request("http://studio.test/api/fonts/google/import", {
        method: "POST",
        body: "{",
      }),
    );
    const invalidHostResponse = await POST(
      importRequest({
        url: "https://fonts.googleapis.com.evil.test/css2?family=Audiowide",
      }),
    );

    expect(malformedResponse.status).toBe(400);
    expect(await malformedResponse.json()).toEqual({
      ok: false,
      error: "invalid_google_fonts_url",
    });
    expect(invalidHostResponse.status).toBe(400);
    expect(await invalidHostResponse.json()).toEqual({
      ok: false,
      error: "invalid_google_fonts_url",
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("normalizes provider errors without returning stack traces", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("secret network internals");
      }),
    );

    const response = await POST(
      importRequest({
        url: "https://fonts.googleapis.com/css2?family=Audiowide",
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(502);
    expect(body).toEqual({
      ok: false,
      error: "google_stylesheet_unavailable",
    });
    expect(JSON.stringify(body)).not.toContain("secret network internals");
    expect(JSON.stringify(body)).not.toContain("stack");
  });
});

