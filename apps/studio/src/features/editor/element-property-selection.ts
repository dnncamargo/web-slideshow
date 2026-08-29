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
  "typography.textStroke",
  "style.background.gradient",
  "style.background.pattern",
  "style.border.gradient",
  // ColorValue is a single authored value. Keep palette reference internals
  // out of Custom Library property selection.
  "style.color",
  "style.background.color",
  "style.border.color",
  "typography.textDecorationColor",
  "markerColor",
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function formatAtomicValue(path: string, value: unknown): string {
  if (!isRecord(value)) {
    return value === null ? "null" : String(value);
  }

  if (path === "link" && typeof value.href === "string") {
    return value.target ? `${value.href} · ${value.target}` : value.href;
  }

  if ((path === "crop" || path === "focalPoint") &&
      typeof value.x === "number" && typeof value.y === "number") {
    if (path === "crop" && typeof value.width === "number" && typeof value.height === "number") {
      return `x ${value.x}%, y ${value.y}%, ${value.width}% × ${value.height}%`;
    }
    return `x ${value.x}%, y ${value.y}%`;
  }

  if (path === "effect.shadow" &&
      (typeof value.x === "string" || typeof value.x === "number") &&
      (typeof value.y === "string" || typeof value.y === "number") &&
      (typeof value.blur === "string" || typeof value.blur === "number")) {
    return `${value.x} ${value.y} ${value.blur}${typeof value.color === "string" ? ` · ${value.color}` : ""}`;
  }

  if (path.endsWith(".gradient") && typeof value.type === "string" &&
      Array.isArray(value.stops)) {
    return `${value.type} · ${value.stops.length} stops`;
  }

  if (path.endsWith(".pattern")) {
    const repeat = typeof value.repeat === "string" ? value.repeat : "repeat";
    return `pattern · ${repeat}`;
  }

  return `${Object.keys(value).length} fields`;
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
        ? formatAtomicValue(entry.path, getValueAtPath(element, entry.path))
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
    if ([...atomicPaths].some((path) =>
      entry.path === path || entry.path.startsWith(`${path}.`))) {
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
        displayValue: formatAtomicValue(path, value),
      }, "atomic-object"));
    }
  }

  const entryOrder = new Map(entries.map((entry, index) => [entry.path, index]));
  return selectable.sort((left, right) =>
    (entryOrder.get(left.path) ?? Number.MAX_SAFE_INTEGER) -
    (entryOrder.get(right.path) ?? Number.MAX_SAFE_INTEGER),
  );
}

export function getDefaultSelectedPropertyPaths(
  element: PowerShowElement,
): Set<string> {
  return new Set(
    getSelectableElementProperties(element)
      .filter((property) => property.defaultSelected)
      .map((property) => property.path),
  );
}
