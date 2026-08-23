import type { BackgroundPattern } from "@powershow/document-schema";

export function renderBackgroundPattern(
  pattern: BackgroundPattern,
): string {
  const styles = [`background-image:${pattern.image}`];

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

  return styles.join(";");
}
