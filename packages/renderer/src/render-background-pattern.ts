import type { BackgroundPattern } from "@web-slideshow/document-schema";

import { renderColorValue } from "./render-palette";

export function renderBackgroundPattern(
  pattern: BackgroundPattern,
): string {
  const styles = pattern.colors?.map(
    (color, index) =>
      `--presentation-pattern-color-${index + 1}:${renderColorValue(color)}`,
  ) ?? [];

  styles.push(`background-image:${pattern.image}`);

  if (pattern.size !== undefined) {
    styles.push(`background-size:${pattern.size}`);
  }

  if (pattern.position !== undefined) {
    styles.push(`background-position:${pattern.position}`);
  }

  if (pattern.repeat !== undefined) {
    styles.push(`background-repeat:${pattern.repeat}`);
  }

  if (pattern.opacity !== undefined) {
    styles.push(`opacity:${pattern.opacity}`);
  }

  if (pattern.rotation !== undefined && pattern.rotation !== 0) {
    styles.push(`transform:rotate(${pattern.rotation}deg)`);
    styles.push("transform-origin:center");
  }

  return styles.join(";");
}
