import type { PowerShowElement } from "@powershow/document-schema";

export interface ElementPropertyEntry {
  path: string;
  displayValue: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function formatArraySummary(value: readonly unknown[]): string {
  return `${value.length} item${value.length === 1 ? "" : "s"}`;
}

function appendValue(
  entries: ElementPropertyEntry[],
  path: string,
  value: unknown,
): void {
  if (value === undefined) {
    return;
  }

  if (Array.isArray(value)) {
    entries.push({ path, displayValue: formatArraySummary(value) });
    return;
  }

  if (isRecord(value)) {
    for (const [key, childValue] of Object.entries(value)) {
      appendValue(entries, `${path}.${key}`, childValue);
    }
    return;
  }

  entries.push({
    path,
    displayValue: value === null ? "null" : String(value),
  });
}

export function getElementPropertyEntries(
  element: PowerShowElement,
): ElementPropertyEntry[] {
  const entries: ElementPropertyEntry[] = [];

  for (const [key, value] of Object.entries(element)) {
    if (key === "id" || key === "type") {
      continue;
    }

    appendValue(entries, key, value);
  }

  return entries;
}
