import type { PowerShowElement } from "@powershow/document-schema";

import {
  getElementPropertyEntries,
  type ElementPropertyEntry,
} from "./element-properties";

export type ElementPropertySelectionKind =
  | "leaf"
  | "atomic-object"
  | "payload";

export interface SelectableElementProperty extends ElementPropertyEntry {
  kind: ElementPropertySelectionKind;
  defaultSelected: boolean;
}

const atomicPaths = new Set([
  "link",
  "crop",
  "focalPoint",
  "effect.shadow",
  "style.background.gradient",
  "style.background.pattern",
  "style.border.gradient",
]);

const normallyUnselectedRoots = new Set([
  "hidden", "content", "src", "alt", "link", "code",
  "highlightedLines", "lines", "series", "config", "items",
  "categories", "rows", "columns", "html", "css", "script", "title",
]);

function getValueAtPath(element: PowerShowElement, path: string): unknown {
  let value: unknown = element;
  for (const segment of path.split(".")) {
    if (typeof value !== "object" || value === null || !(segment in value)) {
      return undefined;
    }
    value = (value as Record<string, unknown>)[segment];
  }
  return value;
}

function formatAtomicValue(value: unknown): string {
  return value !== null && typeof value === "object"
    ? JSON.stringify(value)
    : String(value);
}

function getPropertyRoot(path: string): string {
  return path.split(".")[0] ?? path;
}

function toSelectableProperty(
  element: PowerShowElement,
  entry: ElementPropertyEntry,
  kind: ElementPropertySelectionKind,
): SelectableElementProperty {
  return {
    ...entry,
    displayValue:
      kind === "atomic-object"
        ? formatAtomicValue(getValueAtPath(element, entry.path))
        : entry.displayValue,
    kind,
    defaultSelected: !normallyUnselectedRoots.has(getPropertyRoot(entry.path)),
  };
}

export function getSelectableElementProperties(
  element: PowerShowElement,
): SelectableElementProperty[] {
  const entries = getElementPropertyEntries(element);
  const selectable = entries.flatMap((entry) => {
    if (element.type === "container" && entry.path === "children") {
      return [];
    }
    if ([...atomicPaths].some((path) => entry.path.startsWith(`${path}.`))) {
      return [];
    }
    const kind = entry.displayValue.endsWith(" item") || entry.displayValue.endsWith(" items")
      ? "payload"
      : "leaf";
    return [toSelectableProperty(element, entry, kind)];
  });

  for (const path of atomicPaths) {
    const value = getValueAtPath(element, path);
    if (value !== undefined) {
      selectable.push(toSelectableProperty(element, {
        path,
        displayValue: formatAtomicValue(value),
      }, "atomic-object"));
    }
  }

  const entryOrder = new Map(entries.map((entry, index) => [entry.path, index]));
  return selectable.sort((left, right) =>
    (entryOrder.get(left.path) ?? Number.MAX_SAFE_INTEGER) -
    (entryOrder.get(right.path) ?? Number.MAX_SAFE_INTEGER),
  );
}
