import type {
  ContentSlot,
  StructuredTableElement,
} from "@web-slideshow/document-schema";

import {
  ELEMENT_TYPE_MESSAGE_KEYS,
  type StudioTranslate,
} from "@/features/i18n/studio-i18n";

import { getTextContentPlainText } from "./rich-text-authoring";

export type TableStructuralSelection =
  | { kind: "column"; tableId: string; id: string }
  | { kind: "row"; tableId: string; id: string }
  | null;

export function getTableColumnsNodeId(tableId: string): string {
  return `table:${tableId}:columns`;
}

export function getTableRowsNodeId(tableId: string): string {
  return `table:${tableId}:rows`;
}

export function getTableColumnNodeId(tableId: string, columnId: string): string {
  return `table:${tableId}:column:${columnId}`;
}

export function getTableRowNodeId(tableId: string, rowId: string): string {
  return `table:${tableId}:row:${rowId}`;
}

export function getStructuredContentChildren(
  content: ContentSlot,
): readonly ContentSlot["children"][number][] {
  return content.children.filter((child) =>
    child.type !== "text" || getTextContentPlainText(child.content).replace(/\s+/g, " ").trim().length > 0,
  );
}

export function getStructuredContentDescription(
  content: ContentSlot,
  t: StudioTranslate,
): string | null {
  const descriptors: string[] = [];
  let textDescription: string | null = null;
  let hasNonText = false;

  for (const child of getStructuredContentChildren(content)) {
    if (child.type === "text") {
      const text = getTextContentPlainText(child.content).replace(/\s+/g, " ").trim();
      if (text) textDescription ??= text;
      continue;
    }

    hasNonText = true;
    const typeDescription = t(ELEMENT_TYPE_MESSAGE_KEYS[child.type]);
    if (!descriptors.includes(typeDescription)) descriptors.push(typeDescription);
  }

  if (!hasNonText) return textDescription;
  if (textDescription) descriptors.unshift(t(ELEMENT_TYPE_MESSAGE_KEYS.text));
  return descriptors.length > 0 ? descriptors.join(" + ") : null;
}

export function getStructuredColumnDescription(
  element: StructuredTableElement,
  columnIndex: number,
  t: StudioTranslate,
): string | null {
  const column = element.columns[columnIndex];
  if (!column) return null;
  return getStructuredContentDescription(column.header, t);
}

export function getStructuredRowDescription(
  row: StructuredTableElement["rows"][number],
  t: StudioTranslate,
): string | null {
  const firstCell = row.cells[0];
  return firstCell ? getStructuredContentDescription(firstCell, t) : null;
}

export function getStructuredColumnLabel(
  element: StructuredTableElement,
  index: number,
  t: StudioTranslate,
): string {
  const structuralLabel = t("table.column", { number: index + 1 });
  const description = getStructuredColumnDescription(element, index, t);
  return description ? `${structuralLabel} (${description})` : structuralLabel;
}

export function getStructuredRowLabel(
  element: StructuredTableElement,
  index: number,
  t: StudioTranslate,
): string {
  const structuralLabel = t("table.row", { number: index + 1 });
  const row = element.rows[index];
  const description = row ? getStructuredRowDescription(row, t) : null;
  return description ? `${structuralLabel} (${description})` : structuralLabel;
}
