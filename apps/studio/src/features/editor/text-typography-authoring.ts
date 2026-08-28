import type {
  ElementTypography,
  Presentation,
  TextElement,
  TypographyStyleRole,
} from "@powershow/document-schema";
import { resolveTextTypography } from "@powershow/document-schema";
import { resolveThemeTextTypographyBaseline } from "@powershow/theme/element-style-defaults";

export interface EffectiveTextTypographyForAuthoring {
  role: TypographyStyleRole;
  typography: ElementTypography;
}

export function resolveEffectiveTextTypographyForAuthoring(
  presentation: Presentation,
  text: TextElement,
): EffectiveTextTypographyForAuthoring {
  const resolved = resolveTextTypography(presentation, text);
  const baseline = resolveThemeTextTypographyBaseline(resolved.role);

  return {
    role: resolved.role,
    typography: {
      ...baseline,
      ...resolved.typography,
    },
  };
}
