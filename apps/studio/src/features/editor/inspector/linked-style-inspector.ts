import type { ContainerElement, Presentation } from "@powershow/document-schema";
type LinkedStylePresentation = Pick<Presentation, "linkedStyles">;

export type LinkedSource = "local" | "linked" | "theme";

export function linkedStyleForContainer(presentation: LinkedStylePresentation | undefined, element: ContainerElement) {
  return element.linkedStyleId === undefined ? undefined : presentation?.linkedStyles?.find((style) => style.id === element.linkedStyleId);
}

export function resolveContainerInspectorValue(
  presentation: LinkedStylePresentation | undefined,
  element: ContainerElement,
  property: "gap" | "borderRadius",
): { value: number | undefined; linkedValue: number | undefined; source: LinkedSource } {
  const linked = linkedStyleForContainer(presentation, element);
  const localValue = property === "gap" ? element.layout?.children?.gap : element.style?.borderRadius;
  const linkedValue = property === "gap" ? linked?.layout?.children?.gap : linked?.style?.borderRadius;
  const localNumber = typeof localValue === "number" ? localValue : undefined;
  const linkedNumber = typeof linkedValue === "number" ? linkedValue : undefined;
  if (localValue !== undefined) return { value: localNumber, linkedValue: linkedNumber, source: "local" };
  if (linkedValue !== undefined) return { value: linkedNumber, linkedValue: linkedNumber, source: "linked" };
  return { value: undefined, linkedValue, source: "theme" };
}
