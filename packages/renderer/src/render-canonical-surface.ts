import type {
  EmbedElement,
  GalleryElement,
  ScriptedElement,
} from "@powershow/document-schema";

import { renderBorder, renderShadow } from "./render-visual";
import { renderLength } from "./render-length";

type SurfaceElement = GalleryElement | EmbedElement | ScriptedElement;

export function renderCanonicalSurfaceStyle(element: SurfaceElement): string {
  const output: string[] = [];
  const layout = element.layout;
  const style = element.style;
  const effect = element.effect;

  if (layout) {
    for (const [property, value] of [
      ["width", layout.width],
      ["height", layout.height],
      ["position", layout.position],
      ["top", layout.top],
      ["right", layout.right],
      ["bottom", layout.bottom],
      ["left", layout.left],
    ] as const) {
      if (value !== undefined) {
        output.push(`${property}:${property === "position" ? value : renderLength(value)}`);
      }
    }
  }

  if (style?.background?.color !== undefined) {
    output.push(`background:${style.background.color}`);
  }
  if (style?.border) output.push(...renderBorder(style.border));
  if (style?.borderRadius !== undefined) {
    output.push(`border-radius:${renderLength(style.borderRadius)}`);
  }
  if (effect?.opacity !== undefined) output.push(`opacity:${effect.opacity}`);
  if (effect?.shadow) output.push(`box-shadow:${renderShadow(effect.shadow)}`);

  return output.join(";");
}
