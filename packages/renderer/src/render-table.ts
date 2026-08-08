import type {
  TableElement,
} from "@powershow/document-schema";

import { escapeHtml } from "./escape-html";
import { renderStyle } from "./render-style";

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

  const baseStyle =
    renderStyle(element.style);

  const styleAttribute = baseStyle
    ? ` style="${escapeHtml(baseStyle)}"`
    : "";

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
            renderCellValue(
              row[column.key],
            ) +
            `</td>`,
        )
        .join("");

      return `<tr>${cells}</tr>`;
    })
    .join("");

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
    `<thead>` +
    `<tr>${header}</tr>` +
    `</thead>` +
    `<tbody>` +
    rows +
    `</tbody>` +
    `</table>`
  );
}