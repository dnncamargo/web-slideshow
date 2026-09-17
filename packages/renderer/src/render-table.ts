import type {
  ContentSlot,
  TableElement,
  PowerShowElement,
  TextContent,
  StructuredTableVisualStyle,
} from "@powershow/document-schema";

import { escapeHtml } from "./escape-html";
import { quoteCssString } from "./escape-css-string";
import { renderLength } from "./render-length";
import { renderCanonicalDataStyle } from "./render-canonical-data";
import { renderContentSlotStyle } from "./render-content-slot";
import { renderColorValue } from "./render-palette";
import { renderBackground, renderGradientBorder } from "./render-visual";
import { renderRichText, renderTextContent } from "./render-rich-text";

type RenderChild = (element: PowerShowElement) => string;

function renderCellValue(
  value:
    | TextContent
    | number
    | boolean
    | null
    | undefined,
): string {
  if (value === null || value === undefined) {
    return "";
  }

  return typeof value === "string"
    ? renderTextContent(value, { newlineMode: "preserve" })
    : typeof value === "number" || typeof value === "boolean"
      ? escapeHtml(String(value))
      : renderRichText(value, { newlineMode: "preserve" });
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

  if (element.mode === "structured" && element.style?.dividerOpacity !== undefined) {
    styleParts.push(`--powershow-table-divider-opacity:${element.style.dividerOpacity}`);
  }

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
          renderCellValue(column.label) +
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

  const frameClasses = ["powershow-element", "powershow-table-frame"];
  if (customClass) frameClasses.push(customClass);

  const frameStyleParts = [
    renderCanonicalDataStyle(element, {
      includeSurface: false,
      includeBorder: false,
      includeRadius: false,
    }),
    element.style?.borderRadius !== undefined
      ? `--powershow-table-frame-radius:${renderLength(element.style.borderRadius)}`
      : "",
    "--powershow-table-border-width:1px",
    "--powershow-table-border-color:var(--powershow-border)",
  ];
  const border = element.style?.border;
  if (border) {
    frameStyleParts.push(`--powershow-table-border-width:${renderLength(border.width)}`);
    if (border.gradient) {
      frameClasses.push("presentation-gradient-border", "powershow-table-frame-gradient-border");
      frameStyleParts.push(...renderGradientBorder(border.gradient, border.width));
    } else {
      frameStyleParts.push(`border-width:${renderLength(border.width)}`);
      frameStyleParts.push(`border-style:${border.style ?? "solid"}`);
      if (border.color) {
        frameStyleParts.push(`border-color:${renderColorValue(border.color)}`);
        frameStyleParts.push(`--powershow-table-border-color:${renderColorValue(border.color)}`);
      }
    }
  }
  if (element.style?.borderRadius !== undefined) {
    frameStyleParts.push(`border-radius:${renderLength(element.style.borderRadius)}`);
  }
  const frameStyle = frameStyleParts.filter(Boolean).join(";");
  const frameStyleAttribute = frameStyle ? ` style="${escapeHtml(frameStyle)}"` : "";

  const tableClasses = ["powershow-table", "powershow-table-structured"];
  if (element.style?.background !== undefined) tableClasses.push("powershow-table-has-surface");
  if (element.layout?.height !== undefined) tableClasses.push("powershow-table-fills-frame");
  const tableStyleParts = [
    element.style?.background ? renderBackground(element.style.background).join(";") : "",
  ];
  if (element.style?.dividerOpacity !== undefined) {
    tableStyleParts.push(`--powershow-table-divider-opacity:${element.style.dividerOpacity}`);
  }
  const tableStyle = tableStyleParts.filter(Boolean).join(";");
  const tableStyleAttribute = tableStyle ? ` style="${escapeHtml(tableStyle)}"` : "";

  const renderSlot = (
    slot: ContentSlot,
    tag: "th" | "td",
    columnId?: string,
    background?: StructuredTableVisualStyle["headerBackground"],
  ): string => {
    const classes = slot.style?.className?.trim();
    const styleParts = [renderContentSlotStyle(slot)];
    const hasExplicitBackground = slot.style?.background?.color !== undefined;
    if (!hasExplicitBackground && background !== undefined) {
      styleParts.push(`background:${renderColorValue(background)}`);
    }
    const style = styleParts.filter(Boolean).join(";");
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
        renderSlot(
          column.header,
          "th",
          column.id,
          element.style?.headerBackground,
        ),
      ).join("")}</tr></thead>`
    : "";

  const bodyParityOffset = element.showHeader && element.style?.headerBackground === undefined ? 1 : 0;
  const rows = element.rows.map((row, rowIndex) =>
    `<tr data-powershow-table-row-id="${escapeHtml(row.id)}">${row.cells.map((cell) => {
      const background = (rowIndex + bodyParityOffset) % 2 === 1
        ? element.style?.bodyRowAlternateBackground
        : undefined;
      return renderSlot(cell, "td", undefined, background);
    }).join("")}</tr>`,
  ).join("");

  return (
    `<div class="${escapeHtml(frameClasses.join(" "))}"` +
    ` data-powershow-id="${escapeHtml(element.id)}"` +
    ` data-powershow-type="table"` +
    frameStyleAttribute +
    `>` +
    `<table class="${escapeHtml(tableClasses.join(" "))}"${tableStyleAttribute}>` +
    colgroup +
    header +
    `<tbody>` +
    rows +
    `</tbody>` +
    `</table>` +
    `</div>`
  );
}
