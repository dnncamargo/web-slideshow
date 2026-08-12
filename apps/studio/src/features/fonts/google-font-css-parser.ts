import {
  FontFaceResourceSchema,
  type FontFaceResource,
} from "@powershow/document-schema";

import { isGoogleFontFileUrl } from "./google-font-import-url";
import type {
  GoogleFontImportResult,
  ResolvedGoogleFontFamily,
  UnsupportedGoogleFontFace,
} from "./google-font-import-types";

const STATIC_FONT_WEIGHTS = new Set([
  100, 200, 300, 400, 500, 600, 700, 800, 900,
]);

interface ExtractedBlocks {
  blocks: string[];
  malformedBlockCount: number;
}

function skipComment(css: string, start: number): number {
  const end = css.indexOf("*/", start + 2);

  return end === -1 ? css.length : end + 2;
}

function skipString(css: string, start: number): number {
  const quote = css[start];
  let index = start + 1;

  while (index < css.length) {
    if (css[index] === "\\") {
      index += 2;
      continue;
    }

    if (css[index] === quote) {
      return index + 1;
    }

    index += 1;
  }

  return css.length;
}

function findOpeningBrace(css: string, start: number): number {
  let index = start;

  while (index < css.length) {
    if (css.startsWith("/*", index)) {
      index = skipComment(css, index);
      continue;
    }

    if (css[index] === '"' || css[index] === "'") {
      index = skipString(css, index);
      continue;
    }

    if (css[index] === ";") {
      return -1;
    }

    if (css[index] === "{") {
      return index;
    }

    index += 1;
  }

  return -1;
}

function findClosingBrace(css: string, openingBrace: number): number {
  let depth = 1;
  let index = openingBrace + 1;

  while (index < css.length) {
    if (css.startsWith("/*", index)) {
      index = skipComment(css, index);
      continue;
    }

    if (css[index] === '"' || css[index] === "'") {
      index = skipString(css, index);
      continue;
    }

    if (css[index] === "{") {
      depth += 1;
    } else if (css[index] === "}") {
      depth -= 1;

      if (depth === 0) {
        return index;
      }
    }

    index += 1;
  }

  return -1;
}

function extractFontFaceBlocks(css: string): ExtractedBlocks {
  const blocks: string[] = [];
  let malformedBlockCount = 0;
  let index = 0;

  while (index < css.length) {
    if (css.startsWith("/*", index)) {
      index = skipComment(css, index);
      continue;
    }

    if (css[index] === '"' || css[index] === "'") {
      index = skipString(css, index);
      continue;
    }

    if (css.slice(index, index + 10).toLowerCase() !== "@font-face") {
      index += 1;
      continue;
    }

    const boundary = css[index + 10];

    if (boundary && /[a-z0-9_-]/i.test(boundary)) {
      index += 10;
      continue;
    }

    const openingBrace = findOpeningBrace(css, index + 10);

    if (openingBrace === -1) {
      malformedBlockCount += 1;
      index += 10;
      continue;
    }

    const closingBrace = findClosingBrace(css, openingBrace);

    if (closingBrace === -1) {
      malformedBlockCount += 1;
      break;
    }

    blocks.push(css.slice(openingBrace + 1, closingBrace));
    index = closingBrace + 1;
  }

  return { blocks, malformedBlockCount };
}

function splitTopLevel(value: string, separator: string): string[] {
  const parts: string[] = [];
  let parenthesisDepth = 0;
  let partStart = 0;
  let index = 0;

  while (index < value.length) {
    if (value.startsWith("/*", index)) {
      index = skipComment(value, index);
      continue;
    }

    if (value[index] === '"' || value[index] === "'") {
      index = skipString(value, index);
      continue;
    }

    if (value[index] === "(") {
      parenthesisDepth += 1;
    } else if (value[index] === ")") {
      parenthesisDepth = Math.max(0, parenthesisDepth - 1);
    } else if (value[index] === separator && parenthesisDepth === 0) {
      parts.push(value.slice(partStart, index));
      partStart = index + 1;
    }

    index += 1;
  }

  parts.push(value.slice(partStart));

  return parts;
}

function findTopLevelColon(declaration: string): number {
  let parenthesisDepth = 0;
  let index = 0;

  while (index < declaration.length) {
    if (declaration.startsWith("/*", index)) {
      index = skipComment(declaration, index);
      continue;
    }

    if (declaration[index] === '"' || declaration[index] === "'") {
      index = skipString(declaration, index);
      continue;
    }

    if (declaration[index] === "(") {
      parenthesisDepth += 1;
    } else if (declaration[index] === ")") {
      parenthesisDepth = Math.max(0, parenthesisDepth - 1);
    } else if (declaration[index] === ":" && parenthesisDepth === 0) {
      return index;
    }

    index += 1;
  }

  return -1;
}

function parseDeclarations(block: string): Map<string, string> {
  const declarations = new Map<string, string>();

  for (const rawDeclaration of splitTopLevel(block, ";")) {
    const colonIndex = findTopLevelColon(rawDeclaration);

    if (colonIndex === -1) {
      continue;
    }

    const property = rawDeclaration.slice(0, colonIndex).trim().toLowerCase();
    const value = rawDeclaration.slice(colonIndex + 1).trim();

    if (property && value) {
      declarations.set(property, value);
    }
  }

  return declarations;
}

function decodeCssEscapes(value: string): string {
  let decoded = "";
  let index = 0;

  while (index < value.length) {
    if (value[index] !== "\\") {
      decoded += value[index];
      index += 1;
      continue;
    }

    index += 1;

    if (index >= value.length) {
      break;
    }

    let hex = "";

    while (index < value.length && hex.length < 6 && /[0-9a-f]/i.test(value[index] ?? "")) {
      hex += value[index];
      index += 1;
    }

    if (hex) {
      const codePoint = Number.parseInt(hex, 16);
      decoded +=
        codePoint <= 0x10ffff ? String.fromCodePoint(codePoint) : "\uFFFD";

      if (/\s/.test(value[index] ?? "")) {
        index += 1;
      }

      continue;
    }

    decoded += value[index];
    index += 1;
  }

  return decoded;
}

function parseCssString(value: string): string | undefined {
  const trimmedValue = value.trim();
  const firstCharacter = trimmedValue[0];

  if (firstCharacter === '"' || firstCharacter === "'") {
    if (
      trimmedValue.length < 2 ||
      trimmedValue[trimmedValue.length - 1] !== firstCharacter
    ) {
      return undefined;
    }

    return decodeCssEscapes(trimmedValue.slice(1, -1)).trim() || undefined;
  }

  if (/[{},;]/.test(trimmedValue)) {
    return undefined;
  }

  return decodeCssEscapes(trimmedValue).trim() || undefined;
}

function findFunctionArgument(
  value: string,
  functionName: "url" | "format",
): string | undefined {
  const expression = new RegExp(`\\b${functionName}\\s*\\(`, "i");
  const match = expression.exec(value);

  if (!match) {
    return undefined;
  }

  const openingParenthesis = value.indexOf("(", match.index);
  let depth = 1;
  let index = openingParenthesis + 1;

  while (index < value.length) {
    if (value[index] === '"' || value[index] === "'") {
      index = skipString(value, index);
      continue;
    }

    if (value[index] === "(") {
      depth += 1;
    } else if (value[index] === ")") {
      depth -= 1;

      if (depth === 0) {
        return value.slice(openingParenthesis + 1, index);
      }
    }

    index += 1;
  }

  return undefined;
}

function parseSupportedWoff2Url(src: string): string | undefined {
  for (const source of splitTopLevel(src, ",")) {
    const formatValue = findFunctionArgument(source, "format");

    if (!formatValue) {
      continue;
    }

    const format = parseCssString(formatValue)?.toLowerCase();

    if (format !== "woff2") {
      continue;
    }

    const urlValue = findFunctionArgument(source, "url");
    const url = urlValue ? parseCssString(urlValue) : undefined;

    if (url && isGoogleFontFileUrl(url)) {
      return url;
    }
  }

  return undefined;
}

function faceIdentity(
  family: string,
  face: FontFaceResource,
): string {
  return JSON.stringify([
    family.trim().toLowerCase(),
    face.weight,
    face.style,
    face.unicodeRange ?? null,
    face.source.url,
  ]);
}

export function parseGoogleFontsStylesheet(
  css: string,
): GoogleFontImportResult {
  const { blocks, malformedBlockCount } = extractFontFaceBlocks(css);
  const unsupported: UnsupportedGoogleFontFace[] = Array.from(
    { length: malformedBlockCount },
    () => ({ reason: "malformed_font_face" }),
  );
  const families: ResolvedGoogleFontFamily[] = [];
  const familyLookup = new Map<string, ResolvedGoogleFontFamily>();
  const seenFaces = new Set<string>();

  for (const block of blocks) {
    const declarations = parseDeclarations(block);
    const family = parseCssString(declarations.get("font-family") ?? "");
    const rawWeight = declarations.get("font-weight")?.trim();
    const rawStyle = declarations.get("font-style")?.trim().toLowerCase();
    const source = declarations.get("src");
    const unicodeRange = declarations.get("unicode-range")?.trim();
    const weight = rawWeight ? Number(rawWeight) : Number.NaN;
    const style =
      rawStyle === "normal" || rawStyle === "italic" ? rawStyle : undefined;

    if (
      !family ||
      !rawWeight ||
      !STATIC_FONT_WEIGHTS.has(weight) ||
      String(weight) !== rawWeight ||
      !style
    ) {
      unsupported.push({
        ...(family ? { family } : {}),
        ...(rawWeight ? { weight: rawWeight } : {}),
        ...(rawStyle ? { style: rawStyle } : {}),
        reason:
          family && rawWeight && rawStyle
            ? "unsupported_font_variant"
            : "malformed_font_face",
      });
      continue;
    }

    const fontUrl = source ? parseSupportedWoff2Url(source) : undefined;

    if (!fontUrl) {
      unsupported.push({
        family,
        weight: rawWeight,
        style,
        reason: "unsupported_font_source",
      });
      continue;
    }

    const parsedFace = FontFaceResourceSchema.safeParse({
      weight,
      style,
      ...(unicodeRange ? { unicodeRange } : {}),
      source: {
        type: "url",
        url: fontUrl,
        format: "woff2",
      },
    });

    if (!parsedFace.success) {
      unsupported.push({
        family,
        weight: rawWeight,
        style,
        reason: "malformed_font_face",
      });
      continue;
    }

    const identity = faceIdentity(family, parsedFace.data);

    if (seenFaces.has(identity)) {
      continue;
    }

    seenFaces.add(identity);

    const normalizedFamily = family.toLowerCase();
    let resolvedFamily = familyLookup.get(normalizedFamily);

    if (!resolvedFamily) {
      resolvedFamily = { family, variants: [] };
      familyLookup.set(normalizedFamily, resolvedFamily);
      families.push(resolvedFamily);
    }

    let variant = resolvedFamily.variants.find(
      (candidate) =>
        candidate.weight === weight && candidate.style === style,
    );

    if (!variant) {
      variant = { weight, style, faces: [] };
      resolvedFamily.variants.push(variant);
    }

    variant.faces.push(parsedFace.data);
  }

  return { families, unsupported };
}
