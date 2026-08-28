import type { ElementTypography } from "./element-properties";
import type { Presentation } from "./presentation";
import type { TextElement } from "./elements";
import type { TypographyStyleRole } from "./typography";
import {
  FundamentalTypographyStyleIdSchema,
  hasLocalTypographyStyleProperties,
} from "./typography";

export type ResolvedTextTypography = {
  role: TypographyStyleRole;
  typography: ElementTypography;
};

export function resolveTextTypography(
  presentation: Presentation,
  text: TextElement,
): ResolvedTextTypography {
  const variant = text.variant;
  const styles = presentation.typographyStyles ?? [];
  const style = styles.find((candidate) => candidate.id === variant);

  const fundamentalVariant = FundamentalTypographyStyleIdSchema.safeParse(variant);
  if (fundamentalVariant.success) {
    const independent = hasLocalTypographyStyleProperties(text.typography);
    const override = !independent
      ? styles.find((candidate) => candidate.id === variant)
      : undefined;
    const typography: ElementTypography = {
      ...(independent ? text.typography : override?.typography),
      ...(text.typography?.textDecorationColor !== undefined
        ? { textDecorationColor: text.typography.textDecorationColor }
        : {}),
      ...(text.typography?.textStroke !== undefined
        ? { textStroke: text.typography.textStroke }
        : {}),
    };

    return {
      role: fundamentalVariant.data,
      typography,
    };
  }

  if (!style || !("role" in style)) {
    throw new Error(`Unresolved custom typography style variant: ${variant}`);
  }

  if (hasLocalTypographyStyleProperties(text.typography)) {
    throw new Error(`Custom typography style variant cannot have local V1 typography properties: ${variant}`);
  }

  return {
    role: style.role,
    typography: {
      ...style.typography,
      ...(text.typography?.textDecorationColor !== undefined
        ? { textDecorationColor: text.typography.textDecorationColor }
        : {}),
      ...(text.typography?.textStroke !== undefined
        ? { textStroke: text.typography.textStroke }
        : {}),
    },
  };
}
