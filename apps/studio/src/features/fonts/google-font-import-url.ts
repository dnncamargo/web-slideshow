import {
  GoogleFontImportError,
  type GoogleFontImportErrorCode,
} from "./google-font-import-types";

const GOOGLE_FONTS_HOSTNAME = "fonts.googleapis.com";
const GOOGLE_FONTS_PATHNAME = "/css2";
const MAX_GOOGLE_FONTS_URL_LENGTH = 8_192;
const ALLOWED_QUERY_PARAMETERS = new Set(["family", "display"]);

function reject(code: GoogleFontImportErrorCode): never {
  throw new GoogleFontImportError(code);
}

export function validateGoogleFontsCssUrl(input: string): URL {
  const trimmedInput = input.trim();

  if (
    trimmedInput.length === 0 ||
    trimmedInput.length > MAX_GOOGLE_FONTS_URL_LENGTH
  ) {
    reject("invalid_google_fonts_url");
  }

  let url: URL;

  try {
    url = new URL(trimmedInput);
  } catch {
    reject("invalid_google_fonts_url");
  }

  if (
    url.protocol !== "https:" ||
    url.hostname !== GOOGLE_FONTS_HOSTNAME ||
    url.port !== "" ||
    url.username !== "" ||
    url.password !== "" ||
    url.pathname !== GOOGLE_FONTS_PATHNAME ||
    url.hash !== ""
  ) {
    reject("invalid_google_fonts_url");
  }

  const familyValues = url.searchParams.getAll("family");
  const displayValues = url.searchParams.getAll("display");

  if (url.searchParams.has("text")) {
    reject("text_optimized_font_not_supported");
  }

  for (const parameter of url.searchParams.keys()) {
    if (!ALLOWED_QUERY_PARAMETERS.has(parameter)) {
      reject("unsupported_google_fonts_parameter");
    }
  }

  if (
    familyValues.length === 0 ||
    familyValues.some((family) => family.trim().length === 0)
  ) {
    reject("invalid_google_fonts_url");
  }

  if (
    displayValues.length > 1 ||
    displayValues.some((display) => display.trim().length === 0)
  ) {
    reject("unsupported_google_fonts_parameter");
  }

  return url;
}

export function isGoogleFontFileUrl(input: string): boolean {
  let url: URL;

  try {
    url = new URL(input);
  } catch {
    return false;
  }

  return (
    url.protocol === "https:" &&
    url.hostname === "fonts.gstatic.com" &&
    url.port === "" &&
    url.username === "" &&
    url.password === ""
  );
}
