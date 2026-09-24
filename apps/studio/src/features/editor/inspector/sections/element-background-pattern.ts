import type { BackgroundPattern } from "@web-slideshow/document-schema";
import { BackgroundPatternSchema } from "@web-slideshow/document-schema";

export type BackgroundPatternPresetId = "grid" | "fine-grid" | "dots" | "offset-dots" | "diagonal-lines";
export interface BackgroundPatternPreset { id: BackgroundPatternPresetId; pattern: BackgroundPattern }

const GRID_IMAGE = "linear-gradient(var(--presentation-pattern-color-1) 0% 3.125%, transparent 3.125% 100%), linear-gradient(90deg, var(--presentation-pattern-color-1) 0% 3.125%, transparent 3.125% 100%)";
const FINE_GRID_IMAGE = "linear-gradient(var(--presentation-pattern-color-1) 0% 6.25%, transparent 6.25% 100%), linear-gradient(90deg, var(--presentation-pattern-color-1) 0% 6.25%, transparent 6.25% 100%)";
const DOT_IMAGE = "radial-gradient(circle at 50% 50%, var(--presentation-pattern-color-1) 0% 4.1667%, transparent 4.1667% 100%)";
const OFFSET_DOT_IMAGE = "radial-gradient(circle at 0% 0%, var(--presentation-pattern-color-1) 0% 4.1667%, transparent 4.1667% 100%), radial-gradient(circle at 50% 50%, var(--presentation-pattern-color-1) 0% 4.1667%, transparent 4.1667% 100%)";
const DIAGONAL_IMAGE = "repeating-linear-gradient(45deg, transparent 0% 44%, var(--presentation-pattern-color-1) 44% 56%, transparent 56% 100%)";

export const BACKGROUND_PATTERN_PRESETS: readonly BackgroundPatternPreset[] = [
  { id: "grid", pattern: { image: GRID_IMAGE, size: "32px 32px", repeat: "repeat", colors: ["#cbd5e1"] } },
  { id: "fine-grid", pattern: { image: FINE_GRID_IMAGE, size: "16px 16px", repeat: "repeat", colors: ["#cbd5e1"] } },
  { id: "dots", pattern: { image: DOT_IMAGE, size: "24px 24px", repeat: "repeat", colors: ["#94a3b8"] } },
  { id: "offset-dots", pattern: { image: OFFSET_DOT_IMAGE, size: "24px 24px", repeat: "repeat", colors: ["#94a3b8"] } },
  { id: "diagonal-lines", pattern: { image: DIAGONAL_IMAGE, size: "18px 18px", repeat: "repeat", colors: ["#cbd5e1"] } },
];

const LEGACY_BACKGROUND_PATTERN_PRESETS: readonly BackgroundPatternPreset[] = [
  { id: "grid", pattern: { image: "linear-gradient(#cbd5e1 1px, transparent 1px), linear-gradient(90deg, #cbd5e1 1px, transparent 1px)", size: "32px 32px", repeat: "repeat" } },
  { id: "fine-grid", pattern: { image: "linear-gradient(#cbd5e1 1px, transparent 1px), linear-gradient(90deg, #cbd5e1 1px, transparent 1px)", size: "16px 16px", repeat: "repeat" } },
  { id: "dots", pattern: { image: "radial-gradient(circle, #94a3b8 1px, transparent 1px)", size: "24px 24px", repeat: "repeat" } },
  { id: "offset-dots", pattern: { image: "radial-gradient(circle, #94a3b8 1px, transparent 1px), radial-gradient(circle, #94a3b8 1px, transparent 1px)", size: "24px 24px", position: "0 0, 12px 12px", repeat: "repeat" } },
  { id: "diagonal-lines", pattern: { image: "repeating-linear-gradient(45deg, transparent 0, transparent 8px, #cbd5e1 8px, #cbd5e1 9px)", size: "auto", repeat: "repeat" } },
];

function isSquarePixelSize(size: string | undefined): boolean {
  return size !== undefined && /^\d+(?:\.\d+)?px \d+(?:\.\d+)?px$/.test(size) && size.split(" ")[0] === size.split(" ")[1];
}

function exactPattern(left: BackgroundPattern, right: BackgroundPattern): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

function familyMatches(pattern: BackgroundPattern, preset: BackgroundPatternPreset): boolean {
  if (pattern.image !== preset.pattern.image || pattern.repeat !== preset.pattern.repeat || pattern.opacity !== preset.pattern.opacity) return false;
  if (preset.id === "grid" || preset.id === "fine-grid") return pattern.position === undefined;
  if (preset.id === "dots") return pattern.position === undefined;
  if (preset.id === "offset-dots") return pattern.position === undefined;
  return pattern.position === undefined && (pattern.size === "auto" || isSquarePixelSize(pattern.size));
}

function formatCssNumber(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(2).replace(/0+$/, "").replace(/\.$/, "");
}

export function getPatternSizeValue(pattern: BackgroundPattern, presetId: BackgroundPatternPresetId): number {
  const match = pattern.size?.match(/^(\d+(?:\.\d+)?)px \1px$/);
  if (match) return Number(match[1]);
  return presetId === "fine-grid" ? 16 : presetId === "grid" ? 32 : presetId === "diagonal-lines" ? 18 : 24;
}

export function materializeBackgroundPatternPreset(pattern: BackgroundPattern, presetId: BackgroundPatternPresetId): BackgroundPattern {
  if (pattern.colors !== undefined || pattern.image === BACKGROUND_PATTERN_PRESETS.find((preset) => preset.id === presetId)?.pattern.image) return { ...pattern, colors: pattern.colors?.slice() };
  const preset = BACKGROUND_PATTERN_PRESETS.find((candidate) => candidate.id === presetId);
  if (!preset) return pattern;
  return {
    ...preset.pattern,
    size: presetId === "diagonal-lines" && pattern.size === "auto"
      ? preset.pattern.size
      : pattern.size ?? preset.pattern.size,
    position: pattern.image === preset.pattern.image
      ? pattern.position ?? preset.pattern.position
      : preset.pattern.position,
    repeat: pattern.repeat ?? preset.pattern.repeat,
    opacity: pattern.opacity,
  };
}

export function getEffectivePatternColors(pattern: BackgroundPattern, presetId: BackgroundPatternPresetId | undefined): BackgroundPattern["colors"] {
  if (pattern.colors !== undefined) return pattern.colors;
  if (presetId === undefined) return undefined;
  return materializeBackgroundPatternPreset(pattern, presetId).colors;
}

export function applyPresetPatternColors(
  pattern: BackgroundPattern | undefined,
  targetPreset: BackgroundPatternPreset,
): BackgroundPattern {
  const sourcePresetId = pattern === undefined ? undefined : findBackgroundPatternPreset(pattern);
  const sourceColors = pattern === undefined ? undefined : getEffectivePatternColors(pattern, sourcePresetId);
  const targetColors = targetPreset.pattern.colors ?? [];
  return {
    ...targetPreset.pattern,
    colors: targetColors.map((fallback, index) => sourceColors?.[index] ?? fallback),
  };
}

export function updateBackgroundPatternSize(pattern: BackgroundPattern, presetId: BackgroundPatternPresetId, size: number): BackgroundPattern {
  const bounded = Math.min(500, Math.max(1, size));
  return {
    ...pattern,
    size: `${formatCssNumber(bounded)}px ${formatCssNumber(bounded)}px`,
  };
}

export function updateBackgroundPatternRotation(pattern: BackgroundPattern, rotation: number): BackgroundPattern {
  const bounded = Math.min(360, Math.max(-360, rotation));
  return { ...pattern, rotation: bounded === 0 ? undefined : bounded };
}

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
  const legacy = LEGACY_BACKGROUND_PATTERN_PRESETS.find((preset) => exactPattern(preset.pattern, pattern));
  if (legacy) return legacy.id;
  const matches = BACKGROUND_PATTERN_PRESETS.filter((preset) => familyMatches(pattern, preset));
  if (matches.some((preset) => preset.id === "grid" || preset.id === "fine-grid")) {
    return pattern.size === "16px 16px" ? "fine-grid" : "grid";
  }
  return matches[0]?.id;
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
