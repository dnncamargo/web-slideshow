import type {
  BlocksElement,
  CodeElement,
  GradientSurfaceVisualStyle,
  ElementEffect,
  Length,
  TableElement,
  TerminalElement,
} from "@powershow/document-schema";

import { renderLength } from "./render-length";
import { renderColorValue } from "./render-palette";
import { renderBackground, renderBorder, renderShadow } from "./render-visual";

type CanonicalDataElement =
  | CodeElement
  | TerminalElement
  | TableElement
  | BlocksElement;

type CanonicalDataStyle =
  | GradientSurfaceVisualStyle
  | BlocksElement["style"];

function addLength(
  output: string[],
  property: string,
  value: Length | undefined,
): void {
  if (value !== undefined) {
    output.push(`${property}:${renderLength(value)}`);
  }
}

export function renderCanonicalDataStyle(
  element: Pick<CanonicalDataElement, "layout" | "style" | "effect">,
  options: {
    includeSurface?: boolean;
    includeBorder?: boolean;
    includeRadius?: boolean;
  } = {},
): string {
  const output: string[] = [];
  const layout = element.layout;
  const style = element.style as CanonicalDataStyle | undefined;
  const effect: ElementEffect | undefined = element.effect;

  if (layout) {
    addLength(output, "width", layout.width);
    addLength(output, "height", layout.height);
    output.push(...(
      [
        ["position", layout.position],
        ["top", layout.top],
        ["right", layout.right],
        ["bottom", layout.bottom],
        ["left", layout.left],
        ["margin", layout.margin],
        ["margin-top", layout.marginTop],
        ["margin-right", layout.marginRight],
        ["margin-bottom", layout.marginBottom],
        ["margin-left", layout.marginLeft],
      ] as const
    ).flatMap(([property, value]) => {
      if (value === undefined) return [];
      return property === "position"
        ? [`${property}:${value}`]
        : [`${property}:${renderLength(value)}`];
    }));
  }

  if (options.includeSurface !== false && style?.background !== undefined) {
    output.push(...renderBackground(style.background));
  }

  if (options.includeBorder !== false && style?.border !== undefined) {
    output.push(...renderBorder(style.border));
  }

  if (options.includeRadius !== false && style?.borderRadius !== undefined) {
    addLength(output, "border-radius", style.borderRadius);
  }

  if (effect?.opacity !== undefined) {
    output.push(`opacity:${effect.opacity}`);
  }

  if (effect?.shadow !== undefined) {
    output.push(`box-shadow:${renderShadow(effect.shadow)}`);
  }

  return output.join(";");
}
