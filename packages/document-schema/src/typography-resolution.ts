import type { ElementTypography } from "./element-properties";
import type { Presentation } from "./presentation";
import type { TextElement } from "./elements";
import type { TextStyleRole } from "./text-style";
import {
  FundamentalTextStyleIdSchema,
} from "./text-style";

export type ResolvedTextTypography = {
  role: TextStyleRole;
  typography: ElementTypography;
};

export function resolveTextTypography(
  presentation: Presentation,
  text: TextElement,
): ResolvedTextTypography {
  const variant = text.variant;
  const styles = presentation.textStyles ?? [];
  const style = styles.find((candidate) => candidate.id === variant);

  const fundamentalVariant = FundamentalTextStyleIdSchema.safeParse(variant);
  if (fundamentalVariant.success) {
    return {
      role: fundamentalVariant.data,
      typography: {
        ...(text.styleDetached
          ? {}
          : styles.find((candidate) => candidate.id === variant)?.typography),
        ...text.typography,
      },
    };
  }

  if (!style || !("role" in style)) {
    throw new Error(`Unresolved custom text style variant: ${variant}`);
  }

  return {
    role: style.role,
    typography: {
      ...(style.typography ?? {}),
      ...text.typography,
    },
  };
}
