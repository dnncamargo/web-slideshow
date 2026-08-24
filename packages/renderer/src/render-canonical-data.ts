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
import { renderBorder, renderGradient, renderShadow } from "./render-visual";

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
      ] as const
    ).flatMap(([property, value]) => {
      if (value === undefined) return [];
      return property === "position"
        ? [`${property}:${value}`]
        : [`${property}:${renderLength(value)}`];
    }));
  }

  if (style && "color" in style && style.color !== undefined) {
    output.push(`color:${style.color}`);
  }

  if (style?.background?.color !== undefined) {
    output.push(`background:${style.background.color}`);
  }

  if (style?.background?.gradient !== undefined) {
    output.push(`background-image:${renderGradient(style.background.gradient)}`);
  }

  if (style?.border !== undefined) {
    output.push(...renderBorder(style.border));
  }

  if (style?.borderRadius !== undefined) {
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
