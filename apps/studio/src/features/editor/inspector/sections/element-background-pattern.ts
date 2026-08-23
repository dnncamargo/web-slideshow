import type { BackgroundPattern, ElementStyle } from "@powershow/document-schema";
import { ElementStyleSchema } from "@powershow/document-schema";

export type BackgroundPatternPresetId =
  | "grid"
  | "fine-grid"
  | "dots"
  | "offset-dots"
  | "diagonal-lines";

export interface BackgroundPatternPreset {
  id: BackgroundPatternPresetId;
  pattern: BackgroundPattern;
}

export const BACKGROUND_PATTERN_PRESETS: readonly BackgroundPatternPreset[] = [
  {
    id: "grid",
    pattern: {
      image:
        "linear-gradient(#cbd5e1 1px, transparent 1px), linear-gradient(90deg, #cbd5e1 1px, transparent 1px)",
      size: "32px 32px",
      repeat: "repeat",
    },
  },
  {
    id: "fine-grid",
    pattern: {
      image:
        "linear-gradient(#cbd5e1 1px, transparent 1px), linear-gradient(90deg, #cbd5e1 1px, transparent 1px)",
      size: "16px 16px",
      repeat: "repeat",
    },
  },
  {
    id: "dots",
    pattern: {
      image: "radial-gradient(circle, #94a3b8 1px, transparent 1px)",
      size: "24px 24px",
      repeat: "repeat",
    },
  },
  {
    id: "offset-dots",
    pattern: {
      image:
        "radial-gradient(circle, #94a3b8 1px, transparent 1px), radial-gradient(circle, #94a3b8 1px, transparent 1px)",
      size: "24px 24px",
      position: "0 0, 12px 12px",
      repeat: "repeat",
    },
  },
  {
    id: "diagonal-lines",
    pattern: {
      image:
        "repeating-linear-gradient(45deg, transparent 0, transparent 8px, #cbd5e1 8px, #cbd5e1 9px)",
      size: "auto",
      repeat: "repeat",
    },
  },
];

export type PatternCssParseResult =
  | {
      success: true;
      background: ElementStyle["background"];
      backgroundPattern: BackgroundPattern;
    }
  | {
      success: false;
      error: string;
    };

const SUPPORTED_PROPERTIES = new Set([
  "background-color",
  "background-image",
  "background-size",
  "background-position",
  "background-repeat",
  "opacity",
]);

function splitDeclarations(input: string): string[] {
  const declarations: string[] = [];
  let depth = 0;
  let start = 0;

  for (let index = 0; index < input.length; index += 1) {
    const character = input[index];

    if (character === "(") {
      depth += 1;
    } else if (character === ")") {
      depth -= 1;

      if (depth < 0) {
        throw new Error("Malformed CSS declaration.");
      }
    } else if (character === ";" && depth === 0) {
      declarations.push(input.slice(start, index));
      start = index + 1;
    }
  }

  if (depth !== 0) {
    throw new Error("Malformed CSS declaration.");
  }

  declarations.push(input.slice(start));

  return declarations;
}

function findDeclarationColon(declaration: string): number {
  let depth = 0;

  for (let index = 0; index < declaration.length; index += 1) {
    const character = declaration[index];

    if (character === "(") {
      depth += 1;
    } else if (character === ")") {
      depth -= 1;
    } else if (character === ":" && depth === 0) {
      return index;
    }
  }

  return -1;
}

function validatePattern(
  declarations: Record<string, string>,
): PatternCssParseResult {
  const image = declarations["background-image"];

  if (image === undefined) {
    return {
      success: false,
      error: "Custom Pattern CSS must include background-image.",
    };
  }

  const patternInput: Record<string, string | number> = { image };

  if (declarations["background-size"] !== undefined) {
    patternInput.size = declarations["background-size"];
  }

  if (declarations["background-position"] !== undefined) {
    patternInput.position = declarations["background-position"];
  }

  if (declarations["background-repeat"] !== undefined) {
    patternInput.repeat = declarations["background-repeat"];
  }

  if (declarations.opacity !== undefined) {
    const opacity = Number(declarations.opacity);

    if (!Number.isFinite(opacity)) {
      return {
        success: false,
        error: "Pattern opacity must be a finite number from 0 to 1.",
      };
    }

    patternInput.opacity = opacity;
  }

  const styleInput: Record<string, unknown> = {
    backgroundPattern: patternInput,
  };

  if (declarations["background-color"] !== undefined) {
    styleInput.background = declarations["background-color"];
  }

  const parsed = ElementStyleSchema.safeParse(styleInput);

  if (!parsed.success || parsed.data.backgroundPattern === undefined) {
    return {
      success: false,
      error: "Pattern CSS contains an invalid canonical value.",
    };
  }

  return {
    success: true,
    background: parsed.data.background,
    backgroundPattern: parsed.data.backgroundPattern,
  };
}

export function parseBackgroundPatternCss(input: string): PatternCssParseResult {
  const declarations: Record<string, string> = {};

  try {
    for (const rawDeclaration of splitDeclarations(input)) {
      const declaration = rawDeclaration.trim();

      if (declaration.length === 0) {
        continue;
      }

      const colonIndex = findDeclarationColon(declaration);

      if (colonIndex <= 0) {
        return {
          success: false,
          error: "Malformed CSS declaration.",
        };
      }

      const property = declaration.slice(0, colonIndex).trim().toLowerCase();
      const value = declaration.slice(colonIndex + 1).trim();

      if (!SUPPORTED_PROPERTIES.has(property)) {
        return {
          success: false,
          error: `Unsupported Pattern CSS property: ${property || "(empty)"}.`,
        };
      }

      if (value.length === 0) {
        return {
          success: false,
          error: `Pattern CSS property ${property} requires a value.`,
        };
      }

      if (declarations[property] !== undefined) {
        return {
          success: false,
          error: `Duplicate Pattern CSS property: ${property}.`,
        };
      }

      declarations[property] = value;
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Malformed CSS declaration.",
    };
  }

  return validatePattern(declarations);
}

export function findBackgroundPatternPreset(
  pattern: BackgroundPattern,
): BackgroundPatternPresetId | undefined {
  return BACKGROUND_PATTERN_PRESETS.find((preset) =>
    patternEquals(pattern, preset.pattern),
  )?.id;
}

function patternEquals(left: BackgroundPattern, right: BackgroundPattern): boolean {
  return (
    left.image === right.image &&
    left.size === right.size &&
    left.position === right.position &&
    left.repeat === right.repeat &&
    left.opacity === right.opacity
  );
}

export function renderBackgroundPatternCss(style: ElementStyle | undefined): string {
  const pattern = style?.backgroundPattern;

  if (pattern === undefined) {
    return "";
  }

  const declarations: string[] = [];

  if (style?.background !== undefined) {
    declarations.push(`background-color: ${style.background};`);
  }

  declarations.push(`background-image: ${pattern.image};`);

  if (pattern.size !== undefined) {
    declarations.push(`background-size: ${pattern.size};`);
  }

  if (pattern.position !== undefined) {
    declarations.push(`background-position: ${pattern.position};`);
  }

  if (pattern.repeat !== undefined) {
    declarations.push(`background-repeat: ${pattern.repeat};`);
  }

  if (pattern.opacity !== undefined) {
    declarations.push(`opacity: ${pattern.opacity};`);
  }

  return declarations.join("\n");
}
