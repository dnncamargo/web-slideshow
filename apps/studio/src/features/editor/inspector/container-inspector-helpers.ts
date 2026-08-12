import type { ContainerElement } from "@powershow/document-schema";

export type UpdateContainer = (
  update: (container: ContainerElement) => ContainerElement,
) => void;
