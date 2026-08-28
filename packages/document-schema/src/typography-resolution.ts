import type { ElementTypography } from "./element-properties";
import type { Presentation } from "./presentation";
import type { TextElement } from "./elements";
import type { TypographyStyleRole } from "./typography";
import {
  FundamentalTypographyStyleIdSchema,
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
    return {
      role: fundamentalVariant.data,
      typography: {
        ...(text.typographyDetached
          ? {}
          : styles.find((candidate) => candidate.id === variant)?.typography),
        ...text.typography,
      },
    };
  }

  if (!style || !("role" in style)) {
    throw new Error(`Unresolved custom typography style variant: ${variant}`);
  }

  return {
    role: style.role,
    typography: {
      ...style.typography,
      ...text.typography,
    },
  };
}
