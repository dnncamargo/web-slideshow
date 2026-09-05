import type {
  ContentSlot,
  TableElement,
  PowerShowElement,
} from "@powershow/document-schema";

import { escapeHtml } from "./escape-html";
import { quoteCssString } from "./escape-css-string";
import { renderLength } from "./render-length";
import { renderCanonicalDataStyle } from "./render-canonical-data";
import { renderContentSlotStyle } from "./render-content-slot";
import { renderColorValue } from "./render-palette";

type RenderChild = (element: PowerShowElement) => string;

function renderCellValue(
  value:
    | string
    | number
    | boolean
    | null
    | undefined,
): string {
  if (value === null || value === undefined) {
    return "";
  }

  return escapeHtml(String(value));
}

export function renderTable(
  element: TableElement,
  renderChild?: RenderChild,
): string {
  if (element.hidden) {
    return "";
  }

  const classes = [
    "powershow-element",
    "powershow-table",
  ];

  const customClass =
    element.style?.className?.trim();

  if (customClass) {
    classes.push(customClass);
  }

  const styleParts = [renderCanonicalDataStyle(element)];

  if (element.mode !== "structured") {
    const typography = element.typography;

    if (typography?.fontFamily !== undefined) {
      styleParts.push(`font-family:${quoteCssString(typography.fontFamily)}`);
    }

    if (typography?.fontSize !== undefined) {
      styleParts.push(`font-size:${renderLength(typography.fontSize)}`);
    }

    if (typography?.lineHeight !== undefined) {
      styleParts.push(`line-height:${typography.lineHeight}`);
    }

    if (element.style?.color !== undefined) {
      styleParts.push(`color:${renderColorValue(element.style.color)}`);
    }
  }

  const baseStyle = styleParts.filter(Boolean).join(";");

  const styleAttribute = baseStyle
    ? ` style="${escapeHtml(baseStyle)}"`
    : "";

  if (element.mode !== "structured") {
    const header = element.columns
      .map(
        (column) =>
          `<th scope="col">` +
          escapeHtml(column.label) +
          `</th>`,
      )
      .join("");

    const rows = element.rows
      .map((row) => {
        const cells = element.columns
          .map(
            (column) =>
              `<td>` +
              renderCellValue(row[column.key]) +
              `</td>`,
          )
          .join("");

        return `<tr>${cells}</tr>`;
      })
      .join("");

    return (
      `<table` +
      ` class="${escapeHtml(classes.join(" "))}"` +
      ` data-powershow-id="${escapeHtml(element.id)}"` +
      ` data-powershow-type="table"` +
      styleAttribute +
      `>` +
      `<thead>` +
      `<tr>${header}</tr>` +
      `</thead>` +
      `<tbody>` +
      rows +
      `</tbody>` +
      `</table>`
    );
  }

  if (!renderChild) {
    throw new Error("Structured tables require a child renderer.");
  }

  const renderSlot = (
    slot: ContentSlot,
    tag: "th" | "td",
    columnId?: string,
  ): string => {
    const classes = slot.style?.className?.trim();
    const style = renderContentSlotStyle(slot);
    const attributes = [
      tag === "th" ? `scope="col"` : "",
      `data-powershow-content-slot-id="${escapeHtml(slot.id)}"`,
      columnId
        ? `data-powershow-table-column-id="${escapeHtml(columnId)}"`
        : "",
      classes ? `class="${escapeHtml(classes)}"` : "",
      style ? `style="${escapeHtml(style)}"` : "",
    ].filter(Boolean).join(" ");

    return `<${tag} ${attributes}>${slot.children.map(renderChild).join("")}</${tag}>`;
  };

  const colgroup = element.columns.some((column) => column.width !== undefined)
    ? `<colgroup>${element.columns.map((column) => {
        const attributes = [
          `data-powershow-table-column-id="${escapeHtml(column.id)}"`,
          column.width !== undefined
            ? `style="width:${escapeHtml(renderLength(column.width))}"`
            : "",
        ].filter(Boolean).join(" ");
        return `<col ${attributes}>`;
      }).join("")}</colgroup>`
    : "";

  const header = element.showHeader
    ? `<thead><tr>${element.columns.map((column) =>
        renderSlot(column.header, "th", column.id),
      ).join("")}</tr></thead>`
    : "";

  const rows = element.rows.map((row) =>
    `<tr data-powershow-table-row-id="${escapeHtml(row.id)}">${row.cells.map((cell) => renderSlot(cell, "td")).join("")}</tr>`,
  ).join("");

  return (
    `<table` +
    ` class="${escapeHtml(
      classes.join(" "),
    )}"` +
    ` data-powershow-id="${escapeHtml(
      element.id,
    )}"` +
    ` data-powershow-type="table"` +
    styleAttribute +
    `>` +
    colgroup +
    header +
    `<tbody>` +
    rows +
    `</tbody>` +
    `</table>`
  );
}
