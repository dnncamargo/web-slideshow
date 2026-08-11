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
  | "interactive";

export interface ThemeTypographyDefaults {
  fontSize: number;
  lineHeight: number;
  letterSpacing: number;
}

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
// PowerShow authoring base of 16px so the Studio can expose px number inputs
// without consulting the DOM.
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
};

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

export function resolveEffectiveElementStyleDefaults(
  element: ThemeStyleDefaultElement,
): EffectiveElementStyleDefaults {
  const borderRadius = ELEMENT_BORDER_RADIUS_DEFAULTS[element.type];

  if (element.type === "text") {
    return {
      typography:
        TEXT_VARIANT_TYPOGRAPHY_DEFAULTS[element.variant ?? "body"],
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

