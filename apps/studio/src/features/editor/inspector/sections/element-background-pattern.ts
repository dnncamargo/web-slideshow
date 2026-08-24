import type { BackgroundPattern } from "@powershow/document-schema";
import { BackgroundPatternSchema } from "@powershow/document-schema";

export type BackgroundPatternPresetId = "grid" | "fine-grid" | "dots" | "offset-dots" | "diagonal-lines";
export interface BackgroundPatternPreset { id: BackgroundPatternPresetId; pattern: BackgroundPattern }

export const BACKGROUND_PATTERN_PRESETS: readonly BackgroundPatternPreset[] = [
  { id: "grid", pattern: { image: "linear-gradient(#cbd5e1 1px, transparent 1px), linear-gradient(90deg, #cbd5e1 1px, transparent 1px)", size: "32px 32px", repeat: "repeat" } },
  { id: "fine-grid", pattern: { image: "linear-gradient(#cbd5e1 1px, transparent 1px), linear-gradient(90deg, #cbd5e1 1px, transparent 1px)", size: "16px 16px", repeat: "repeat" } },
  { id: "dots", pattern: { image: "radial-gradient(circle, #94a3b8 1px, transparent 1px)", size: "24px 24px", repeat: "repeat" } },
  { id: "offset-dots", pattern: { image: "radial-gradient(circle, #94a3b8 1px, transparent 1px), radial-gradient(circle, #94a3b8 1px, transparent 1px)", size: "24px 24px", position: "0 0, 12px 12px", repeat: "repeat" } },
  { id: "diagonal-lines", pattern: { image: "repeating-linear-gradient(45deg, transparent 0, transparent 8px, #cbd5e1 8px, #cbd5e1 9px)", size: "auto", repeat: "repeat" } },
];

export type PatternCssParseResult =
  | { success: true; background: string | undefined; backgroundPattern: BackgroundPattern }
  | { success: false; error: string };

const SUPPORTED_PROPERTIES = new Set(["background-color", "background-image", "background-size", "background-position", "background-repeat", "opacity"]);

function declarations(input: string): Record<string, string> | string {
  const result: Record<string, string> = {};
  let depth = 0;
  let start = 0;
  const chunks: string[] = [];
  for (let index = 0; index < input.length; index += 1) {
    const character = input[index];
    if (character === "(") depth += 1;
    else if (character === ")") { depth -= 1; if (depth < 0) return "Malformed CSS declaration."; }
    else if (character === ";" && depth === 0) { chunks.push(input.slice(start, index)); start = index + 1; }
  }
  if (depth !== 0) return "Malformed CSS declaration.";
  chunks.push(input.slice(start));
  for (const chunk of chunks) {
    const declaration = chunk.trim();
    if (!declaration) continue;
    const colon = declaration.indexOf(":");
    if (colon <= 0) return "Malformed CSS declaration.";
    const property = declaration.slice(0, colon).trim().toLowerCase();
    const value = declaration.slice(colon + 1).trim();
    if (!SUPPORTED_PROPERTIES.has(property)) return `Unsupported Pattern CSS property: ${property || "(empty)"}.`;
    if (!value) return `Pattern CSS property ${property} requires a value.`;
    if (result[property] !== undefined) return `Duplicate Pattern CSS property: ${property}.`;
    result[property] = value;
  }
  return result;
}

export function parseBackgroundPatternCss(input: string): PatternCssParseResult {
  const parsed = declarations(input);
  if (typeof parsed === "string") return { success: false, error: parsed };
  const image = parsed["background-image"];
  if (image === undefined) return { success: false, error: "Custom Pattern CSS must include background-image." };
  const patternInput: Record<string, string | number> = { image };
  if (parsed["background-size"] !== undefined) patternInput.size = parsed["background-size"];
  if (parsed["background-position"] !== undefined) patternInput.position = parsed["background-position"];
  if (parsed["background-repeat"] !== undefined) patternInput.repeat = parsed["background-repeat"];
  if (parsed.opacity !== undefined) patternInput.opacity = Number(parsed.opacity);
  const pattern = BackgroundPatternSchema.safeParse(patternInput);
  return pattern.success
    ? { success: true, background: parsed["background-color"], backgroundPattern: pattern.data }
    : { success: false, error: "Pattern CSS contains an invalid canonical value." };
}

export function findBackgroundPatternPreset(pattern: BackgroundPattern): BackgroundPatternPresetId | undefined {
  return BACKGROUND_PATTERN_PRESETS.find((preset) => JSON.stringify(preset.pattern) === JSON.stringify(pattern))?.id;
}

export function renderBackgroundPatternCss(style: { background?: string; backgroundPattern?: BackgroundPattern } | undefined): string {
  const pattern = style?.backgroundPattern;
  if (!pattern) return "";
  return [
    ...(style?.background === undefined ? [] : [`background-color: ${style.background};`]),
    `background-image: ${pattern.image};`,
    ...(pattern.size === undefined ? [] : [`background-size: ${pattern.size};`]),
    ...(pattern.position === undefined ? [] : [`background-position: ${pattern.position};`]),
    ...(pattern.repeat === undefined ? [] : [`background-repeat: ${pattern.repeat};`]),
    ...(pattern.opacity === undefined ? [] : [`opacity: ${pattern.opacity};`]),
  ].join("\n");
}
