import type {
  ContentSlot,
  TableElement,
  PresentationElement,
  TextContent,
  StructuredTableVisualStyle,
  SimpleTableVisualStyle,
  Presentation,
} from "@web-slideshow/document-schema";
import { resolveLinkedTableStyle } from "@web-slideshow/document-schema";

import { escapeHtml } from "./escape-html";
import { quoteCssString } from "./escape-css-string";
import { renderLength } from "./render-length";
import { renderCanonicalDataStyle } from "./render-canonical-data";
import { renderContentSlotStyle } from "./render-content-slot";
import { renderColorValue } from "./render-palette";
import { renderBackground, renderGradientBorder } from "./render-visual";
import { renderRichText, renderTextContent } from "./render-rich-text";

type RenderChild = (element: PresentationElement) => string;

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
  presentation?: Presentation,
): string {
  if (element.hidden) {
    return "";
  }

  if (element.linkedStyleId !== undefined && presentation === undefined) {
    throw new Error(`Cannot render linked table style without presentation context: ${element.linkedStyleId}`);
  }
  const resolved = element.linkedStyleId === undefined
    ? {}
    : resolveLinkedTableStyle(presentation!, element);
  const effectiveLayout = resolved.layout ?? element.layout;
  const effectiveSimpleStyle = element.mode !== "structured"
    ? (resolved.style ?? element.style) as SimpleTableVisualStyle | undefined
    : undefined;
  const effectiveStructuredStyle = element.mode === "structured"
    ? (resolved.style ?? element.style) as StructuredTableVisualStyle | undefined
    : undefined;
  const effectiveStyle = effectiveSimpleStyle ?? effectiveStructuredStyle;
  const effectiveEffect = resolved.effect ?? element.effect;
  const effectiveTypography = element.mode !== "structured"
    ? ("typography" in resolved ? resolved.typography : undefined) ?? element.typography
    : undefined;
  const classes = [
    "presentation-element",
    "presentation-table",
  ];

  const customClass =
    effectiveStyle?.className?.trim();

  if (customClass) {
    classes.push(customClass);
  }

  const styleParts = [renderCanonicalDataStyle({ layout: effectiveLayout, style: effectiveStyle, effect: effectiveEffect })];

  if (element.mode === "structured" && effectiveStructuredStyle?.dividerOpacity !== undefined) {
    styleParts.push(`--presentation-table-divider-opacity:${effectiveStructuredStyle.dividerOpacity}`);
  }

  if (element.mode !== "structured") {
    const typography = effectiveTypography;

    if (typography?.fontFamily !== undefined) {
      styleParts.push(`font-family:${quoteCssString(typography.fontFamily)}`);
    }

    if (typography?.fontSize !== undefined) {
      styleParts.push(`font-size:${renderLength(typography.fontSize)}`);
    }

    if (typography?.lineHeight !== undefined) {
      styleParts.push(`line-height:${typography.lineHeight}`);
    }

    if (effectiveSimpleStyle?.color !== undefined) {
      const color = renderColorValue(effectiveSimpleStyle.color);
      styleParts.push(`color:${color}`);
      styleParts.push(`--presentation-table-color:${color}`);
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
      ` data-presentation-id="${escapeHtml(element.id)}"` +
      ` data-presentation-type="table"` +
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

  const frameClasses = ["presentation-element", "presentation-table-frame"];
  if (customClass) frameClasses.push(customClass);

  const frameStyleParts = [
    renderCanonicalDataStyle({ layout: effectiveLayout, style: effectiveStyle, effect: effectiveEffect }, {
      includeSurface: false,
      includeBorder: false,
      includeRadius: false,
    }),
    effectiveStructuredStyle?.borderRadius !== undefined
      ? `--presentation-table-frame-radius:${renderLength(effectiveStructuredStyle.borderRadius)}`
      : "",
    "--presentation-table-border-width:1px",
    "--presentation-table-border-color:var(--presentation-border)",
  ];
  const border = effectiveStructuredStyle?.border;
  if (border) {
    frameStyleParts.push(`--presentation-table-border-width:${renderLength(border.width)}`);
    if (border.gradient) {
      frameClasses.push("presentation-gradient-border", "presentation-table-frame-gradient-border");
      frameStyleParts.push(...renderGradientBorder(border.gradient, border.width));
    } else {
      frameStyleParts.push(`border-width:${renderLength(border.width)}`);
      frameStyleParts.push(`border-style:${border.style ?? "solid"}`);
      if (border.color) {
        frameStyleParts.push(`border-color:${renderColorValue(border.color)}`);
        frameStyleParts.push(`--presentation-table-border-color:${renderColorValue(border.color)}`);
      }
    }
  }
  if (effectiveStructuredStyle?.borderRadius !== undefined) {
    frameStyleParts.push(`border-radius:${renderLength(effectiveStructuredStyle.borderRadius)}`);
  }
  const frameStyle = frameStyleParts.filter(Boolean).join(";");
  const frameStyleAttribute = frameStyle ? ` style="${escapeHtml(frameStyle)}"` : "";

  const tableClasses = ["presentation-table", "presentation-table-structured"];
  if (effectiveStructuredStyle?.background !== undefined) tableClasses.push("presentation-table-has-surface");
  if (effectiveLayout?.height !== undefined) tableClasses.push("presentation-table-fills-frame");
  const tableStyleParts = [
    effectiveStructuredStyle?.background ? renderBackground(effectiveStructuredStyle.background).join(";") : "",
  ];
  if (effectiveStructuredStyle?.dividerOpacity !== undefined) {
    tableStyleParts.push(`--presentation-table-divider-opacity:${effectiveStructuredStyle.dividerOpacity}`);
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
      `data-presentation-content-slot-id="${escapeHtml(slot.id)}"`,
      columnId
        ? `data-presentation-table-column-id="${escapeHtml(columnId)}"`
        : "",
      classes ? `class="${escapeHtml(classes)}"` : "",
      style ? `style="${escapeHtml(style)}"` : "",
    ].filter(Boolean).join(" ");

    return `<${tag} ${attributes}>${slot.children.map(renderChild).join("")}</${tag}>`;
  };

  const colgroup = element.columns.some((column) => column.width !== undefined)
    ? `<colgroup>${element.columns.map((column) => {
        const attributes = [
          `data-presentation-table-column-id="${escapeHtml(column.id)}"`,
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
          effectiveStructuredStyle?.headerBackground,
        ),
      ).join("")}</tr></thead>`
    : "";

  const bodyParityOffset = element.showHeader && effectiveStructuredStyle?.headerBackground === undefined ? 1 : 0;
  const rows = element.rows.map((row, rowIndex) =>
    `<tr data-presentation-table-row-id="${escapeHtml(row.id)}">${row.cells.map((cell) => {
      const background = (rowIndex + bodyParityOffset) % 2 === 1
        ? effectiveStructuredStyle?.bodyRowAlternateBackground
        : undefined;
      return renderSlot(cell, "td", undefined, background);
    }).join("")}</tr>`,
  ).join("");

  return (
    `<div class="${escapeHtml(frameClasses.join(" "))}"` +
    ` data-presentation-id="${escapeHtml(element.id)}"` +
    ` data-presentation-type="table"` +
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
