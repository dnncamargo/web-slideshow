import { parseGoogleFontsStylesheet } from "./google-font-css-parser";
import {
  GoogleFontImportError,
  type GoogleFontImportResult,
} from "./google-font-import-types";
import { validateGoogleFontsCssUrl } from "./google-font-import-url";

export const GOOGLE_FONT_IMPORT_TIMEOUT_MS = 5_000;
export const GOOGLE_FONT_IMPORT_MAX_BYTES = 256 * 1024;
export const GOOGLE_FONT_IMPORT_USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) " +
  "AppleWebKit/537.36 (KHTML, like Gecko) " +
  "Chrome/131.0.0.0 Safari/537.36 PowerShow-Studio/1.0";

interface ResolveGoogleFontImportOptions {
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
  maxBytes?: number;
}

async function readStylesheetWithLimit(
  response: Response,
  maxBytes: number,
): Promise<string> {
  const contentLength = response.headers.get("content-length");

  if (contentLength !== null) {
    const declaredBytes = Number(contentLength);

    if (Number.isFinite(declaredBytes) && declaredBytes > maxBytes) {
      throw new GoogleFontImportError("google_stylesheet_too_large");
    }
  }

  if (!response.body) {
    throw new GoogleFontImportError("invalid_google_stylesheet_response");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let bytesRead = 0;
  let stylesheet = "";

  while (true) {
    const chunk = await reader.read();

    if (chunk.done) {
      stylesheet += decoder.decode();
      return stylesheet;
    }

    bytesRead += chunk.value.byteLength;

    if (bytesRead > maxBytes) {
      await reader.cancel().catch(() => undefined);
      throw new GoogleFontImportError("google_stylesheet_too_large");
    }

    stylesheet += decoder.decode(chunk.value, { stream: true });
  }
}

export async function resolveGoogleFontImport(
  input: string,
  options: ResolveGoogleFontImportOptions = {},
): Promise<GoogleFontImportResult> {
  const url = validateGoogleFontsCssUrl(input);
  const fetchImpl = options.fetchImpl ?? fetch;
  const timeoutMs = options.timeoutMs ?? GOOGLE_FONT_IMPORT_TIMEOUT_MS;
  const maxBytes = options.maxBytes ?? GOOGLE_FONT_IMPORT_MAX_BYTES;
  const abortController = new AbortController();
  let didTimeout = false;
  const timeout = setTimeout(() => {
    didTimeout = true;
    abortController.abort();
  }, timeoutMs);

  try {
    const response = await fetchImpl(url, {
      method: "GET",
      redirect: "manual",
      signal: abortController.signal,
      headers: {
        Accept: "text/css",
        "User-Agent": GOOGLE_FONT_IMPORT_USER_AGENT,
      },
    });

    if (response.status >= 300 && response.status < 400) {
      throw new GoogleFontImportError("google_stylesheet_unavailable");
    }

    if (response.status === 400) {
      throw new GoogleFontImportError("invalid_google_fonts_url");
    }

    if (!response.ok) {
      throw new GoogleFontImportError("google_stylesheet_unavailable");
    }

    const contentType = response.headers.get("content-type")?.toLowerCase();

    if (!contentType || !/^text\/css(?:\s*;|$)/.test(contentType)) {
      throw new GoogleFontImportError(
        "invalid_google_stylesheet_response",
      );
    }

    const stylesheet = await readStylesheetWithLimit(response, maxBytes);
    const result = parseGoogleFontsStylesheet(stylesheet);
    const supportedFaceCount = result.families.reduce(
      (familyTotal, family) =>
        familyTotal +
        family.variants.reduce(
          (variantTotal, variant) => variantTotal + variant.faces.length,
          0,
        ),
      0,
    );

    if (supportedFaceCount === 0) {
      throw new GoogleFontImportError("no_supported_font_faces");
    }

    return result;
  } catch (error) {
    if (error instanceof GoogleFontImportError) {
      throw error;
    }

    if (
      didTimeout ||
      (error instanceof Error && error.name === "AbortError")
    ) {
      throw new GoogleFontImportError("google_stylesheet_timeout");
    }

    throw new GoogleFontImportError("google_stylesheet_unavailable");
  } finally {
    clearTimeout(timeout);
  }
}
