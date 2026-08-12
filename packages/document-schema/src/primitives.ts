import { z } from "zod";

export const ElementIdSchema = z.string().min(1);

export type ElementId = z.infer<typeof ElementIdSchema>;

export const LengthSchema = z.union([
  z.number(),
  z.string().min(1),
]);

export type Length = z.infer<typeof LengthSchema>;

export interface ParsedColor {
  red: number;
  green: number;
  blue: number;
  alpha: number;
}

export type ColorFormat = "hex" | "rgba";

const HEX_COLOR_PATTERN = /^#([0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i;
const RGBA_COLOR_PATTERN =
  /^rgba\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*,\s*([+-]?(?:\d+(?:\.\d*)?|\.\d+))\s*\)$/i;

function parseHexColor(value: string): ParsedColor | undefined {
  const match = HEX_COLOR_PATTERN.exec(value);

  if (!match) {
    return undefined;
  }

  const digits = match[1];

  if (digits === undefined) {
    return undefined;
  }

  const expanded =
    digits.length <= 4
      ? [...digits].map((digit) => `${digit}${digit}`).join("")
      : digits;
  const alphaDigits = expanded.length === 8 ? expanded.slice(6) : "ff";

  return {
    red: Number.parseInt(expanded.slice(0, 2), 16),
    green: Number.parseInt(expanded.slice(2, 4), 16),
    blue: Number.parseInt(expanded.slice(4, 6), 16),
    alpha: Number.parseInt(alphaDigits, 16) / 255,
  };
}

export function parseColor(value: string): ParsedColor | undefined {
  const normalizedValue = value.trim();
  const hexColor = parseHexColor(normalizedValue);

  if (hexColor) {
    return hexColor;
  }

  const match = RGBA_COLOR_PATTERN.exec(normalizedValue);

  if (!match) {
    return undefined;
  }

  const red = Number(match[1]);
  const green = Number(match[2]);
  const blue = Number(match[3]);
  const alpha = Number(match[4]);

  return [red, green, blue].every(
    (channel) => Number.isInteger(channel) && channel >= 0 && channel <= 255,
  ) &&
    Number.isFinite(alpha) &&
    alpha >= 0 &&
    alpha <= 1
    ? { red, green, blue, alpha }
    : undefined;
}

function formatAlpha(alpha: number): string {
  return String(Number(alpha.toFixed(2)));
}

export function formatColorAsHex(color: ParsedColor): string {
  const channels = [color.red, color.green, color.blue]
    .map((channel) => channel.toString(16).padStart(2, "0"))
    .join("");

  return color.alpha === 1
    ? `#${channels}`
    : `#${channels}${Math.round(color.alpha * 255)
        .toString(16)
        .padStart(2, "0")}`;
}

export function formatColorAsRgba(color: ParsedColor): string {
  return `rgba(${color.red}, ${color.green}, ${color.blue}, ${formatAlpha(
    color.alpha,
  )})`;
}

export function normalizeColor(value: string): string | undefined {
  const color = parseColor(value);

  if (!color) {
    return undefined;
  }

  return value.trim().startsWith("#")
    ? formatColorAsHex(color)
    : formatColorAsRgba(color);
}

export function colorToPickerHex(value: string | undefined): string | undefined {
  const color = value === undefined ? undefined : parseColor(value);

  return color
    ? `#${[color.red, color.green, color.blue]
        .map((channel) => channel.toString(16).padStart(2, "0"))
        .join("")}`
    : undefined;
}

export function replaceColorRgb(
  value: string,
  pickerHex: string,
  format: ColorFormat,
): string | undefined {
  const current = parseColor(value);
  const pickerColor = parseColor(pickerHex);

  if (!current || !pickerColor) {
    return undefined;
  }

  const next = {
    ...pickerColor,
    alpha: current.alpha,
  };

  return format === "hex" ? formatColorAsHex(next) : formatColorAsRgba(next);
}

export const ColorSchema = z
  .string()
  .refine((value) => parseColor(value) !== undefined, {
    message: "Color must be a supported HEX or RGBA value.",
  })
  .transform((value) => normalizeColor(value) ?? value);

export type Color = z.infer<typeof ColorSchema>;

export const HorizontalAlignmentSchema = z.enum([
  "start",
  "center",
  "end",
  "stretch",
]);

export const VerticalAlignmentSchema = z.enum([
  "start",
  "center",
  "end",
  "stretch",
]);

export const DirectionSchema = z.enum([
  "row",
  "column",
]);

export const LayoutModeSchema = z.enum([
  "flow",
  "stack",
]);

export const OverflowSchema = z.enum([
  "visible",
  "hidden",
  "auto",
]);

export const PositionSchema = z.enum([
  "static",
  "relative",
  "absolute",
]);

export const PositionAnchorSchema = z.enum([
  "top-left",
  "top",
  "top-right",
  "left",
  "center",
  "right",
  "bottom-left",
  "bottom",
  "bottom-right",
]);

export type PositionAnchor = z.infer<typeof PositionAnchorSchema>;

export const SignedLengthSchema = z.union([
  z.number().finite(),
  z.string().regex(
    /^-?(?:\d+(?:\.\d*)?|\.\d+)(?:px|%)$/,
    "Signed length must use px or %.",
  ),
]);

export type SignedLength = z.infer<typeof SignedLengthSchema>;

// ============================================================
// BEGIN: CONTAINER DISTRIBUTION
// ============================================================

export const DistributionSchema = z.enum([
  "packed",
  "space-between",
  "space-around",
  "space-evenly",
]);

export type Distribution =
  z.infer<
    typeof DistributionSchema
  >;

// ============================================================
// END: CONTAINER DISTRIBUTION
// ============================================================
