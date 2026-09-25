import type { BackgroundPattern } from "@web-slideshow/document-schema";
import { BackgroundPatternSchema } from "@web-slideshow/document-schema";

export type BackgroundPatternPresetId =
  | "grid"
  | "fine-grid"
  | "dots"
  | "offset-dots"
  | "diagonal-lines"
  | "art-deco"
  | "circuit-grid"
  | "paper"
  | "graph-paper-dotted"
  | "cross"
  | "triple-axis-overlay"
  | "chevron";
export interface BackgroundPatternPreset { id: BackgroundPatternPresetId; pattern: BackgroundPattern }

const GRID_IMAGE = "linear-gradient(var(--presentation-pattern-color-1) 0% 3.125%, transparent 3.125% 100%), linear-gradient(90deg, var(--presentation-pattern-color-1) 0% 3.125%, transparent 3.125% 100%)";
const FINE_GRID_IMAGE = "linear-gradient(var(--presentation-pattern-color-1) 0% 6.25%, transparent 6.25% 100%), linear-gradient(90deg, var(--presentation-pattern-color-1) 0% 6.25%, transparent 6.25% 100%)";
// closest-side is 50% of a centered tile, so 8.3333% gives a ~1px radius at 24px.
const DOT_IMAGE = "radial-gradient(circle closest-side at 50% 50%, var(--presentation-pattern-color-1) 0% 8.3333%, transparent 8.3333% 100%)";
// At 25%/25%, closest-side is 25% of the tile, so the ratio doubles to retain ~1px.
const OFFSET_DOT_IMAGE = "radial-gradient(circle closest-side at 25% 25%, var(--presentation-pattern-color-1) 0% 16.6667%, transparent 16.6667% 100%), radial-gradient(circle closest-side at 75% 75%, var(--presentation-pattern-color-1) 0% 16.6667%, transparent 16.6667% 100%)";
const DIAGONAL_IMAGE = "linear-gradient(90deg, var(--presentation-pattern-color-1) 0% 6.25%, transparent 6.25% 100%)";
const ART_DECO_IMAGE = "linear-gradient(45deg, transparent 0% 35%, var(--presentation-pattern-color-1) 35% 38%, transparent 38% 62%, var(--presentation-pattern-color-1) 62% 65%, transparent 65% 100%), linear-gradient(135deg, transparent 0% 35%, var(--presentation-pattern-color-2) 35% 38%, transparent 38% 62%, var(--presentation-pattern-color-2) 62% 65%, transparent 65% 100%), linear-gradient(45deg, transparent 0% 47%, var(--presentation-pattern-color-3) 47% 50%, transparent 50% 53%, var(--presentation-pattern-color-3) 53% 56%, transparent 56% 100%), linear-gradient(135deg, transparent 0% 47%, var(--presentation-pattern-color-4) 47% 50%, transparent 50% 53%, var(--presentation-pattern-color-4) 53% 56%, transparent 56% 100%)";
const PAPER_PATTERN = createPaperPattern(20);
const GRAPH_PAPER_DOTTED_PATTERN = createGraphPaperDottedPattern(20);
const CROSS_IMAGE = "linear-gradient(0deg, transparent 0% 43%, var(--presentation-pattern-color-1) 43% 57%, transparent 57% 100%), linear-gradient(90deg, transparent 0% 43%, var(--presentation-pattern-color-1) 43% 57%, transparent 57% 100%)";
const TRIPLE_AXIS_OVERLAY_IMAGE = "linear-gradient(0deg, transparent 0% 47%, var(--presentation-pattern-color-1) 47% 53%, transparent 53% 100%), linear-gradient(60deg, transparent 0% 47%, var(--presentation-pattern-color-2) 47% 53%, transparent 53% 100%), linear-gradient(120deg, transparent 0% 47%, var(--presentation-pattern-color-3) 47% 53%, transparent 53% 100%)";
const CHEVRON_IMAGE = "linear-gradient(45deg, transparent 0% 46%, var(--presentation-pattern-color-1) 46% 54%, transparent 54% 100%), linear-gradient(135deg, transparent 0% 46%, var(--presentation-pattern-color-1) 46% 54%, transparent 54% 100%)";

export const BACKGROUND_PATTERN_PRESETS: readonly BackgroundPatternPreset[] = [
  { id: "grid", pattern: { image: GRID_IMAGE, size: "32px 32px", repeat: "repeat", colors: ["#cbd5e1"] } },
  { id: "fine-grid", pattern: { image: FINE_GRID_IMAGE, size: "16px 16px", repeat: "repeat", colors: ["#cbd5e1"] } },
  { id: "dots", pattern: { image: DOT_IMAGE, size: "24px 24px", repeat: "repeat", colors: ["#94a3b8"] } },
  { id: "offset-dots", pattern: { image: OFFSET_DOT_IMAGE, size: "24px 24px", repeat: "repeat", colors: ["#94a3b8"] } },
  { id: "diagonal-lines", pattern: { image: DIAGONAL_IMAGE, size: "18px 18px", repeat: "repeat", colors: ["#cbd5e1"], rotation: 135 } },
  { id: "art-deco", pattern: { image: ART_DECO_IMAGE, size: "160px 111.7px", repeat: "repeat", colors: ["#e5e5e5", "#99a1ac", "#b69e85", "#e1cfc3"] } },
  { id: "circuit-grid", pattern: { image: createCircuitGridImage(20), size: "80px 80px", repeat: "repeat", colors: ["#444cf7", "#444cf7"] } },
  { id: "paper", pattern: { ...PAPER_PATTERN, repeat: "repeat", colors: ["#444cf7", "#444cf7"] } },
  { id: "graph-paper-dotted", pattern: { ...GRAPH_PAPER_DOTTED_PATTERN, repeat: "repeat", colors: ["#444cf7"] } },
  { id: "cross", pattern: { image: CROSS_IMAGE, size: "32px 32px", repeat: "repeat", colors: ["#94a3b8"] } },
  { id: "triple-axis-overlay", pattern: { image: TRIPLE_AXIS_OVERLAY_IMAGE, size: "48px 48px", repeat: "repeat", colors: ["#f97316", "#22c55e", "#3b82f6"] } },
  { id: "chevron", pattern: { image: CHEVRON_IMAGE, size: "40px 40px", repeat: "repeat", colors: ["#cbd5e1"] } },
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

const ART_DECO_CELL_RATIO = 148 / 106;

function pixelSizeParts(size: string | undefined): [number, number] | undefined {
  const match = size?.match(/^(\d+(?:\.\d+)?)px (\d+(?:\.\d+)?)px$/);
  return match ? [Number(match[1]), Number(match[2])] : undefined;
}

function artDecoSizeValue(size: string | undefined): number | undefined {
  const parts = pixelSizeParts(size);
  if (!parts || parts[0] <= 0 || parts[1] <= 0) return undefined;
  const value = parts[0] / 2;
  return formatCssNumber(value) === formatCssNumber(parts[1] / ART_DECO_CELL_RATIO)
    ? value
    : undefined;
}

function exactPattern(left: BackgroundPattern, right: BackgroundPattern): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

function familyMatches(pattern: BackgroundPattern, preset: BackgroundPatternPreset): boolean {
  if (pattern.repeat !== preset.pattern.repeat || pattern.opacity !== preset.pattern.opacity) return false;
  if (preset.id === "paper" || preset.id === "graph-paper-dotted") {
    const size = generatedPatternSizeValue(pattern, preset.id);
    return size !== undefined && pattern.image === (preset.id === "paper" ? createPaperPattern(size) : createGraphPaperDottedPattern(size)).image;
  }
  if (pattern.position !== undefined) return false;
  if (preset.id === "art-deco") return pattern.image === preset.pattern.image && artDecoSizeValue(pattern.size) !== undefined;
  if (preset.id === "circuit-grid") {
    const parts = pixelSizeParts(pattern.size);
    if (!parts || parts[0] !== parts[1] || parts[0] <= 0) return false;
    const size = parts[0] / 4;
    return formatCssNumber(size) === String(size) && pattern.image === createCircuitGridImage(size);
  }
  if (pattern.image !== preset.pattern.image) return false;
  if (preset.id === "grid" || preset.id === "fine-grid") return true;
  if (preset.id === "dots") return true;
  if (preset.id === "offset-dots") return true;
  return pattern.position === undefined && (preset.id === "diagonal-lines" && pattern.size === "auto" || isSquarePixelSize(pattern.size));
}

function formatCssNumber(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(2).replace(/0+$/, "").replace(/\.$/, "");
}

export function createCircuitGridImage(size: number): string {
  const tile = size * 4;
  const center = size * 2;
  const firstLine = center - 1;
  const secondLine = tile - 1;
  const centerRadius = size * 0.16;
  const cornerRadius = size * 0.12;
  const css = (value: number) => `${formatCssNumber(value)}px`;
  const color = (slot: 1 | 2) => `var(--presentation-pattern-color-${slot})`;
  return [
    `repeating-linear-gradient(0deg, transparent, transparent ${css(firstLine)}, ${color(1)} ${css(firstLine)}, ${color(1)} ${css(center)}, transparent ${css(center)}, transparent ${css(secondLine)}, ${color(1)} ${css(secondLine)}, ${color(1)} ${css(tile)})`,
    `repeating-linear-gradient(90deg, transparent, transparent ${css(firstLine)}, ${color(1)} ${css(firstLine)}, ${color(1)} ${css(center)}, transparent ${css(center)}, transparent ${css(secondLine)}, ${color(1)} ${css(secondLine)}, ${color(1)} ${css(tile)})`,
    `radial-gradient(circle at ${css(center)} ${css(center)}, ${color(2)} ${css(centerRadius)}, transparent ${css(centerRadius + 0.5)})`,
    `radial-gradient(circle at 0px 0px, ${color(2)} ${css(cornerRadius)}, transparent ${css(cornerRadius + 0.5)})`,
    `radial-gradient(circle at ${css(tile)} 0px, ${color(2)} ${css(cornerRadius)}, transparent ${css(cornerRadius + 0.5)})`,
    `radial-gradient(circle at 0px ${css(tile)}, ${color(2)} ${css(cornerRadius)}, transparent ${css(cornerRadius + 0.5)})`,
    `radial-gradient(circle at ${css(tile)} ${css(tile)}, ${color(2)} ${css(cornerRadius)}, transparent ${css(cornerRadius + 0.5)})`,
  ].join(", ");
}

type GeneratedPatternGeometry = Pick<BackgroundPattern, "image" | "size" | "position">;

export function createPaperPattern(size: number): GeneratedPatternGeometry {
  const majorWidth = size * 0.1;
  const minorWidth = size * 0.05;
  const majorCell = size * 5;
  const minorCell = size;
  const css = (value: number) => `${formatCssNumber(value)}px`;
  const majorColor = "var(--presentation-pattern-color-1)";
  const minorColor = "var(--presentation-pattern-color-2)";
  return {
    image: [
      `linear-gradient(${majorColor} ${css(majorWidth)}, transparent ${css(majorWidth)})`,
      `linear-gradient(90deg, ${majorColor} ${css(majorWidth)}, transparent ${css(majorWidth)})`,
      `linear-gradient(${minorColor} ${css(minorWidth)}, transparent ${css(minorWidth)})`,
      `linear-gradient(90deg, ${minorColor} ${css(minorWidth)}, transparent ${css(minorWidth)})`,
    ].join(", "),
    size: `${css(majorCell)} ${css(majorCell)}, ${css(majorCell)} ${css(majorCell)}, ${css(minorCell)} ${css(minorCell)}, ${css(minorCell)} ${css(minorCell)}`,
    position: `${css(-majorWidth)} ${css(-majorWidth)}, ${css(-majorWidth)} ${css(-majorWidth)}, ${css(-minorWidth)} ${css(-minorWidth)}, ${css(-minorWidth)} ${css(-minorWidth)}`,
  };
}

export function createGraphPaperDottedPattern(size: number): GeneratedPatternGeometry {
  const radius = size * 0.08;
  const css = (value: number) => `${formatCssNumber(value)}px`;
  const color = "var(--presentation-pattern-color-1)";
  return {
    image: [
      `radial-gradient(circle, ${color} ${css(radius)}, transparent ${css(radius)})`,
      `radial-gradient(circle, ${color} ${css(radius)}, transparent ${css(radius)})`,
    ].join(", "),
    size: `${css(size * 0.5)} ${css(size * 2)}, ${css(size * 2)} ${css(size * 0.5)}`,
    position: `${css(-size * 0.25)} ${css(-size)}, ${css(-size)} ${css(-size * 0.25)}`,
  };
}

function generatedPatternSizeValue(pattern: BackgroundPattern, presetId: "paper" | "graph-paper-dotted"): number | undefined {
  const sizes = pattern.size?.split(", ");
  const positions = pattern.position?.split(", ");
  if (!sizes || !positions || sizes.length !== (presetId === "paper" ? 4 : 2) || positions.length !== sizes.length) return undefined;
  const match = sizes[0]?.match(/^(\d+(?:\.\d+)?)px (\d+(?:\.\d+)?)px$/);
  if (!match || Number(match[1]) <= 0 || (presetId === "paper" && Number(match[1]) !== Number(match[2]))) return undefined;
  const value = Number(match[1]) / (presetId === "paper" ? 5 : 0.5);
  const expected = presetId === "paper" ? createPaperPattern(value) : createGraphPaperDottedPattern(value);
  return expected.size === pattern.size && expected.position === pattern.position ? value : undefined;
}

export function getPatternSizeValue(pattern: BackgroundPattern, presetId: BackgroundPatternPresetId): number {
  if (presetId === "art-deco") return artDecoSizeValue(pattern.size) ?? 80;
  if (presetId === "circuit-grid") {
    const parts = pixelSizeParts(pattern.size);
    return parts && parts[0] === parts[1] ? parts[0] / 4 : 20;
  }
  if (presetId === "paper" || presetId === "graph-paper-dotted") return generatedPatternSizeValue(pattern, presetId) ?? 20;
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
  if (presetId === "art-deco") {
    return {
      ...pattern,
      size: `${formatCssNumber(bounded * 2)}px ${formatCssNumber(bounded * ART_DECO_CELL_RATIO)}px`,
    };
  }
  if (presetId === "circuit-grid") {
    const tile = bounded * 4;
    return {
      ...pattern,
      image: createCircuitGridImage(bounded),
      size: `${formatCssNumber(tile)}px ${formatCssNumber(tile)}px`,
    };
  }
  if (presetId === "paper" || presetId === "graph-paper-dotted") {
    const geometry = presetId === "paper" ? createPaperPattern(bounded) : createGraphPaperDottedPattern(bounded);
    return { ...pattern, ...geometry };
  }
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
