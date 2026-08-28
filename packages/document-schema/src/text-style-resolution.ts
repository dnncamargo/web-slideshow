import type { ElementTypography, TextStyleVisualProperties } from "./element-properties";
import type { Presentation } from "./presentation";
import type { TextElement } from "./elements";
import type { TextStyleRole } from "./text-style";
import { FundamentalTextStyleIdSchema } from "./text-style";

export type ResolvedTextStyle = {
  role: TextStyleRole;
  style: TextStyleVisualProperties;
  typography: ElementTypography;
};

export function resolveTextStyle(
  presentation: Presentation,
  text: TextElement,
): ResolvedTextStyle {
  const styles = presentation.textStyles ?? [];
  const style = styles.find((candidate) => candidate.id === text.variant);
  const fundamentalVariant = FundamentalTextStyleIdSchema.safeParse(text.variant);

  if (fundamentalVariant.success) {
    const inherited = text.styleDetached ? undefined : style;
    return {
      role: fundamentalVariant.data,
      style: { ...(inherited?.style ?? {}), ...(text.style?.color === undefined ? {} : { color: text.style.color }) },
      typography: { ...(inherited?.typography ?? {}), ...(text.typography ?? {}) },
    };
  }

  if (!style || !("role" in style)) {
    throw new Error(`Unresolved custom text style variant: ${text.variant}`);
  }

  return {
    role: style.role,
    style: { ...(style.style ?? {}), ...(text.style?.color === undefined ? {} : { color: text.style.color }) },
    typography: { ...(style.typography ?? {}), ...(text.typography ?? {}) },
  };
}
