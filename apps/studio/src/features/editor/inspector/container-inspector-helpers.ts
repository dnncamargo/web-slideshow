import type { ContainerElement } from "@powershow/document-schema";

export type UpdateContainer = (
  update: (container: ContainerElement) => ContainerElement,
) => void;

export function updateContainerLayoutMode(
  container: ContainerElement,
  layoutMode: "flow" | "stack",
): ContainerElement {
  return {
    ...container,
    layout: {
      ...container.layout,
      children: { ...container.layout?.children, mode: layoutMode === "flow" ? undefined : layoutMode },
    },
  };
}
