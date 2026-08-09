import type {
  Length,
} from "@powershow/document-schema";

export function renderLength(
  value: Length,
): string {
  if (typeof value === "number") {
    return `${value}px`;
  }

  return value;
}