import type { ContainerElement } from "@powershow/document-schema";

export type UpdateContainer = (
  update: (container: ContainerElement) => ContainerElement,
) => void;

export function updateContainerLayoutMode(
  container: ContainerElement,
  layoutMode: NonNullable<ContainerElement["layoutMode"]>,
): ContainerElement {
  return {
    ...container,
    layoutMode,
  };
}
