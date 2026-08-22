export type ThemeTextVariant = "title" | "subtitle" | "body" | "caption";

export type ThemeElementType =
  | "text"
  | "textbox"
  | "container"
  | "image"
  | "code"
  | "terminal"
  | "table"
  | "chart"
  | "interactive"
  | "topics"
  | "divider"
  | "gallery"
  | "embed"
  | "blocks";
  | "blocks"
  | "scripted";

export interface ThemeTypographyDefaults {
  fontSize: number;
  lineHeight: number;
  letterSpacing: number;
}

export const AUTHORING_ROOT_FONT_SIZE_PX = 16;

export type AuthoringLengthUnit = "px" | "rem" | "em" | "%";

export interface ParsedAuthoringLength {
  value: number;
  unit: AuthoringLengthUnit;
}

const AUTHORING_LENGTH_PATTERN = /^(-?(?:\d+(?:\.\d*)?|\.\d+))(px|rem|em|%)$/;

export interface EffectiveElementStyleDefaults {
  typography?: ThemeTypographyDefaults;
  borderRadius: number;
}

export interface ThemeStyleDefaultElement {
  type: ThemeElementType;
  variant?: ThemeTextVariant;
}

// These values are the deterministic authoring representation of the
// canonical declarations in base.css. rem/em lengths are resolved against the
// PowerShow authoring root so the Studio can convert rem values without
// consulting the DOM.
export const TEXT_VARIANT_TYPOGRAPHY_DEFAULTS: Readonly<
  Record<ThemeTextVariant, Readonly<ThemeTypographyDefaults>>
> = {
  title: {
    fontSize: 48,
    lineHeight: 1.08,
    letterSpacing: -1.2,
  },
  subtitle: {
    fontSize: 28,
    lineHeight: 1.25,
    letterSpacing: 0,
  },
  body: {
    fontSize: 18,
    lineHeight: 1.6,
    letterSpacing: 0,
  },
  caption: {
    fontSize: 14,
    lineHeight: 1.45,
    letterSpacing: 0,
  },
};

export const TEXTBOX_TYPOGRAPHY_DEFAULTS: Readonly<ThemeTypographyDefaults> = {
  fontSize: 16.8,
  lineHeight: 1.65,
  letterSpacing: 0,
};

export const TOPICS_ITEM_GAP_DEFAULT_PX = 6;

export const ELEMENT_BORDER_RADIUS_DEFAULTS: Readonly<
  Record<ThemeElementType, number>
> = {
  text: 0,
  textbox: 0,
  container: 0,
  image: 0,
  code: 14,
  terminal: 14,
  table: 14,
  chart: 0,
  interactive: 0,
  topics: 0,
  divider: 0,
  gallery: 0,
  embed: 0,
  blocks: 0,
  blocks: 0,
  scripted: 0,
};

export const THEME_COLORS = {
  textPrimary: "#f8fafc",
  textSecondary: "#cbd5e1",
  textMuted: "#94a3b8",
  surface: "rgba(15, 23, 42, 0.88)",
  surfaceStrong: "#020617",
  border: "rgba(148, 163, 184, 0.22)",
  accent: "#22d3ee",
  danger: "#f87171",
} as const;

export type ThemeColorKey = keyof typeof THEME_COLORS;

export interface EffectiveNumericStyleValue {
  value: number;
  inherited: boolean;
}

export function resolveEffectiveNumericStyleValue(
  explicitValue: number | undefined,
  inheritedValue: number,
): EffectiveNumericStyleValue {
  return explicitValue === undefined
    ? {
        value: inheritedValue,
        inherited: true,
      }
    : {
        value: explicitValue,
        inherited: false,
      };
}

export function parseAuthoringLength(
  value: number | string,
): ParsedAuthoringLength | undefined {
  if (typeof value === "number") {
    return Number.isFinite(value) ? { value, unit: "px" } : undefined;
  }

  const match = AUTHORING_LENGTH_PATTERN.exec(value.trim());

  if (!match) {
    return undefined;
  }

  const numericValue = Number(match[1]);
  const unit = match[2];

  return Number.isFinite(numericValue) &&
    (unit === "px" || unit === "rem" || unit === "em" || unit === "%")
    ? { value: numericValue, unit }
    : undefined;
}

export function normalizeAuthoringLengthValue(value: number): number {
  return Number(value.toFixed(4));
}

export function convertAuthoringLength(
  value: number | string,
  targetUnit: AuthoringLengthUnit,
  relativeFontSizePx?: number,
): number | undefined {
  const parsed = parseAuthoringLength(value);

  if (!parsed) {
    return undefined;
  }

  if (parsed.unit === targetUnit) {
    return normalizeAuthoringLengthValue(parsed.value);
  }

  if (parsed.unit === "%" || targetUnit === "%") {
    return undefined;
  }

  const pixels =
    parsed.unit === "px"
      ? parsed.value
      : parsed.unit === "rem"
        ? parsed.value * AUTHORING_ROOT_FONT_SIZE_PX
        : relativeFontSizePx === undefined
          ? undefined
          : parsed.value * relativeFontSizePx;

  if (pixels === undefined) {
    return undefined;
  }

  const converted =
    targetUnit === "px"
      ? pixels
      : targetUnit === "rem"
        ? pixels / AUTHORING_ROOT_FONT_SIZE_PX
        : relativeFontSizePx === undefined
          ? undefined
          : pixels / relativeFontSizePx;

  return converted === undefined
    ? undefined
    : normalizeAuthoringLengthValue(converted);
}

export function serializeAuthoringLength(
  value: number,
  unit: AuthoringLengthUnit,
): number | string {
  return unit === "px" ? value : `${value}${unit}`;
}

export function resolveEffectiveElementStyleDefaults(
  element: ThemeStyleDefaultElement,
): EffectiveElementStyleDefaults {
  const borderRadius = ELEMENT_BORDER_RADIUS_DEFAULTS[element.type];

  if (element.type === "text") {
    return {
      typography: TEXT_VARIANT_TYPOGRAPHY_DEFAULTS[element.variant ?? "body"],
      borderRadius,
    };
  }

  if (element.type === "textbox") {
    return {
      typography: TEXTBOX_TYPOGRAPHY_DEFAULTS,
      borderRadius,
    };
  }

  return { borderRadius };
}
