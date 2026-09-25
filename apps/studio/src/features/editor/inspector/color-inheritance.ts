import type {
  ColorValue,
  ContainerElement,
  Presentation,
} from "@web-slideshow/document-schema";
import { resolveLinkedContainerStyle } from "@web-slideshow/document-schema";

export type InheritedColorSource = "container" | "theme";

export function resolveNearestContainerColor(
  presentation: Pick<Presentation, "linkedStyles"> | undefined,
  ancestors: readonly ContainerElement[],
): ColorValue | undefined {
  if (!presentation) return undefined;

  for (const container of ancestors) {
    const resolved = resolveLinkedContainerStyle(presentation as Presentation, container);
    if (resolved.style?.color !== undefined) return resolved.style.color;
  }

  return undefined;
}
