import type { ContainerElement } from "@powershow/document-schema";

export type UpdateContainer = (
  update: (container: ContainerElement) => ContainerElement,
) => void;

export function parseOptionalNumber(value: string): number | undefined {
  if (value.trim() === "") {
    return undefined;
  }

  const number = Number(value);

  return Number.isFinite(number) ? number : undefined;
}
