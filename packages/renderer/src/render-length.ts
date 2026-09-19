import type {
  Length,
} from "@web-slideshow/document-schema";

export function renderLength(
  value: Length,
): string {
  if (typeof value === "number") {
    return `${value}px`;
  }

  return value;
}