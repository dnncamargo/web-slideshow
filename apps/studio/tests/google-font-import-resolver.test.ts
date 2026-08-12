import { readFile } from "node:fs/promises";

import {
  afterEach,
  beforeAll,
  describe,
  expect,
  it,
  vi,
} from "vitest";

import {
  GOOGLE_FONT_IMPORT_MAX_BYTES,
  GOOGLE_FONT_IMPORT_USER_AGENT,
  resolveGoogleFontImport,
} from "../src/features/fonts/google-font-import-resolver";

let audiowideCss = "";

beforeAll(async () => {
  audiowideCss = await readFile(
    new URL("./fixtures/google-fonts/audiowide.css", import.meta.url),
    "utf8",
  );
});

afterEach(() => {
  vi.useRealTimers();
});

function cssResponse(
  css: string,
  init: ResponseInit = {},
): Response {
  return new Response(css, {
    status: 200,
    ...init,
    headers: {
      "content-type": "text/css; charset=utf-8",
      ...init.headers,
    },
  });
}

describe("resolveGoogleFontImport", () => {
  it("requests Google CSS once with a controlled WOFF2-capable user agent", async () => {
    const fetchMock = vi.fn(async () => cssResponse(audiowideCss));

    const result = await resolveGoogleFontImport(
      "https://fonts.googleapis.com/css2?family=Audiowide&display=swap",
      { fetchImpl: fetchMock as typeof fetch },
    );

    expect(result.families[0]?.family).toBe("Audiowide");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith(
      expect.objectContaining({
        hostname: "fonts.googleapis.com",
        pathname: "/css2",
      }),
      expect.objectContaining({
        method: "GET",
        redirect: "manual",
        headers: {
          Accept: "text/css",
          "User-Agent": GOOGLE_FONT_IMPORT_USER_AGENT,
        },
      }),
    );
  });

  it("does not follow @import or issue a second fetch", async () => {
    const fetchMock = vi.fn(async () => cssResponse(audiowideCss));

    await resolveGoogleFontImport(
      "https://fonts.googleapis.com/css2?family=Audiowide",
      { fetchImpl: fetchMock as typeof fetch },
    );

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("rejects redirects without following an external Location", async () => {
    const fetchMock = vi.fn(
      async () =>
        new Response(null, {
          status: 302,
          headers: { location: "https://evil.example/fonts.css" },
        }),
    );

    await expect(
      resolveGoogleFontImport(
        "https://fonts.googleapis.com/css2?family=Audiowide",
        { fetchImpl: fetchMock as typeof fetch },
      ),
    ).rejects.toThrowError("google_stylesheet_unavailable");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("returns a controlled timeout error", async () => {
    vi.useFakeTimers();

    const fetchMock = vi.fn(
      async (_input: RequestInfo | URL, init?: RequestInit) =>
        await new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () => {
            reject(new DOMException("Aborted", "AbortError"));
          });
        }),
    );
    const resolution = resolveGoogleFontImport(
      "https://fonts.googleapis.com/css2?family=Audiowide",
      { fetchImpl: fetchMock as typeof fetch, timeoutMs: 50 },
    );
    const rejection = expect(resolution).rejects.toThrowError(
      "google_stylesheet_timeout",
    );

    await vi.advanceTimersByTimeAsync(50);
    await rejection;
  });

  it("rejects an oversized declared Content-Length", async () => {
    const fetchMock = vi.fn(
      async () =>
        cssResponse(audiowideCss, {
          headers: {
            "content-type": "text/css",
            "content-length": String(GOOGLE_FONT_IMPORT_MAX_BYTES + 1),
          },
        }),
    );

    await expect(
      resolveGoogleFontImport(
        "https://fonts.googleapis.com/css2?family=Audiowide",
        { fetchImpl: fetchMock as typeof fetch },
      ),
    ).rejects.toThrowError("google_stylesheet_too_large");
  });

  it("enforces the effective streamed response limit without Content-Length", async () => {
    const fetchMock = vi.fn(
      async () => cssResponse("x".repeat(GOOGLE_FONT_IMPORT_MAX_BYTES + 1)),
    );

    await expect(
      resolveGoogleFontImport(
        "https://fonts.googleapis.com/css2?family=Audiowide",
        { fetchImpl: fetchMock as typeof fetch },
      ),
    ).rejects.toThrowError("google_stylesheet_too_large");
  });

  it("rejects an incompatible Content-Type", async () => {
    const fetchMock = vi.fn(
      async () =>
        new Response(JSON.stringify({ css: audiowideCss }), {
          headers: { "content-type": "application/json" },
        }),
    );

    await expect(
      resolveGoogleFontImport(
        "https://fonts.googleapis.com/css2?family=Audiowide",
        { fetchImpl: fetchMock as typeof fetch },
      ),
    ).rejects.toThrowError("invalid_google_stylesheet_response");
  });

  it("maps Google 400, network failure, and no supported faces", async () => {
    await expect(
      resolveGoogleFontImport(
        "https://fonts.googleapis.com/css2?family=Invalid",
        {
          fetchImpl: vi.fn(
            async () => new Response("bad request", { status: 400 }),
          ) as typeof fetch,
        },
      ),
    ).rejects.toThrowError("invalid_google_fonts_url");

    await expect(
      resolveGoogleFontImport(
        "https://fonts.googleapis.com/css2?family=Audiowide",
        {
          fetchImpl: vi.fn(async () => {
            throw new Error("network details must not escape");
          }) as typeof fetch,
        },
      ),
    ).rejects.toThrowError("google_stylesheet_unavailable");

    await expect(
      resolveGoogleFontImport(
        "https://fonts.googleapis.com/css2?family=Variable",
        {
          fetchImpl: vi.fn(async () =>
            cssResponse(`
              @font-face {
                font-family: 'Variable';
                font-style: normal;
                font-weight: 100 900;
                src: url(https://fonts.gstatic.com/variable.woff2) format('woff2');
              }
            `),
          ) as typeof fetch,
        },
      ),
    ).rejects.toThrowError("no_supported_font_faces");
  });
});
