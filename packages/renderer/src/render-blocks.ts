import type { BlockItem, BlockPart, BlocksElement } from "@powershow/document-schema";

import { escapeHtml } from "./escape-html";
import { renderCanonicalDataStyle } from "./render-canonical-data";

export const BLOCK_CONNECTOR_WIDTH = 14;
export const BLOCK_CONNECTOR_HEIGHT = 5;
export const BLOCK_STACK_OVERLAP = 4;
export const SCOPE_INDENT = 18;
export const SCOPE_CLOSING_WIDTH = 72;

const INLINE_PART_GAP = 6;
const SOCKET_MIN_HEIGHT = 20;
const FALLBACK_CATEGORY_COLOR = "#64748b";

const stackStyle = [
  "display:flex",
  "flex-direction:column",
  "align-items:flex-start",
  "gap:0",
  `--powershow-connector-width:${BLOCK_CONNECTOR_WIDTH}px`,
  `--powershow-connector-height:${BLOCK_CONNECTOR_HEIGHT}px`,
  `--powershow-stack-overlap:${BLOCK_STACK_OVERLAP}px`,
].join(";");

const statementSurfaceStyle = [
  "position:relative",
  "display:block",
  "box-sizing:border-box",
  "max-width:100%",
  "padding:8px 12px 9px",
  "font:500 13px/1.35 system-ui,sans-serif",
  "color:#fff",
  "border-radius:6px",
  "box-shadow:inset 0 1px rgba(255,255,255,.22),inset 0 -2px rgba(0,0,0,.16)",
  `margin-bottom:-${BLOCK_STACK_OVERLAP}px`,
  "overflow:visible",
].join(";");

const valueSurfaceStyle = [
  "position:relative",
  "display:inline-flex",
  "align-items:center",
  "box-sizing:border-box",
  "max-width:100%",
  "padding:2px 9px",
  `min-height:${SOCKET_MIN_HEIGHT - 4}px`,
  "font:500 12px/1.2 system-ui,sans-serif",
  "color:#fff",
  "border-radius:999px",
  "vertical-align:middle",
  "box-shadow:inset 0 1px rgba(255,255,255,.24),inset 0 -1px rgba(0,0,0,.18)",
].join(";");

const partsStyle = [
  "display:inline-flex",
  "align-items:center",
  `gap:${INLINE_PART_GAP}px`,
  "white-space:nowrap",
  "max-width:100%",
].join(";");

const connectorBaseStyle = [
  "position:absolute",
  `width:${BLOCK_CONNECTOR_WIDTH}px`,
  `height:${BLOCK_CONNECTOR_HEIGHT}px`,
  "left:12px",
  "z-index:2",
].join(";");

const topConnectorStyle = [
  connectorBaseStyle,
  "top:0",
  "background:rgba(0,0,0,.22)",
  "clip-path:polygon(0 0,100% 0,100% 100%,72% 100%,72% 45%,28% 45%,28% 100%,0 100%)",
].join(";");

function renderConnector(kind: "top" | "bottom", color: string): string {
  if (kind === "top") {
    return `<span class="powershow-block-connector powershow-block-connector--top" style="${topConnectorStyle}" aria-hidden="true"></span>`;
  }
  const style = [
    connectorBaseStyle,
    "bottom:-5px",
    `background-color:${escapeHtml(color)}`,
    "border-radius:0 0 4px 4px",
    "clip-path:polygon(0 0,28% 0,28% 55%,72% 55%,72% 0,100% 0,100% 100%,0 100%)",
  ].join(";");
  return `<span class="powershow-block-connector powershow-block-connector--bottom" style="${style}" aria-hidden="true"></span>`;
}

function renderSocket(part: Extract<BlockPart, { type: "socket" }>, categories: Map<string, string>): string {
  const base = [
    "display:inline-flex",
    "align-items:center",
    "box-sizing:border-box",
    `min-height:${SOCKET_MIN_HEIGHT}px`,
    "border-radius:999px",
    "vertical-align:middle",
    "font:500 12px/1.2 system-ui,sans-serif",
  ];
  if (part.content.type === "empty") {
    return `<span class="powershow-block-socket powershow-block-socket--empty" data-powershow-part-id="${escapeHtml(part.id)}" style="${[...base, "min-width:34px", "padding:2px 9px", "background:rgba(15,23,42,.28)", "box-shadow:inset 0 1px rgba(0,0,0,.2)"].join(";")}" aria-label="empty socket"></span>`;
  }
  if (part.content.type === "literal") {
    return `<span class="powershow-block-socket powershow-block-socket--literal" data-powershow-part-id="${escapeHtml(part.id)}" style="${[...base, "padding:2px 9px", "background:rgba(255,255,255,.88)", "color:#1e293b"].join(";")}">${escapeHtml(part.content.value)}</span>`;
  }
  return `<span class="powershow-block-socket powershow-block-socket--block" data-powershow-part-id="${escapeHtml(part.id)}" style="${[...base, "padding:0", "background:transparent"].join(";")}">${renderBlock(part.content.block, categories)}</span>`;
}

function renderParts(item: BlockItem, categories: Map<string, string>): string {
  return item.parts.map((part) => part.type === "text"
    ? `<span class="powershow-block-text">${escapeHtml(part.text)}</span>`
    : renderSocket(part, categories)).join("");
}

function renderBlock(item: BlockItem, categories: Map<string, string>): string {
  const color = categories.get(item.categoryId) ?? FALLBACK_CATEGORY_COLOR;
  const parts = renderParts(item, categories);

  if (item.shape === "value") {
    return `<span class="powershow-block powershow-block--value" data-powershow-block-id="${escapeHtml(item.id)}" style="${valueSurfaceStyle};background-color:${escapeHtml(color)}">${parts}</span>`;
  }

  const header = `<div class="powershow-block-header" style="position:relative;background-color:${escapeHtml(color)};${statementSurfaceStyle}">${renderConnector("top", color)}<div class="powershow-block-parts" style="${partsStyle}">${parts}</div></div>`;

  if (item.shape === "scope") {
    const body = `<div class="powershow-block-scope-body" style="margin-inline-start:${SCOPE_INDENT}px;border-inline-start:4px solid ${escapeHtml(color)};padding-inline-start:10px;background:transparent"><div class="powershow-block-scope-stack" style="${stackStyle}">${item.children.map((child) => renderBlock(child, categories)).join("")}</div></div>`;
    const footer = `<div class="powershow-block-scope-footer" style="position:relative;width:${SCOPE_CLOSING_WIDTH}px;min-height:14px;background-color:${escapeHtml(color)};border-radius:0 0 5px 5px;box-shadow:inset 0 -2px rgba(0,0,0,.16)">${renderConnector("bottom", color)}</div>`;
    return `<div class="powershow-block powershow-block--scope" data-powershow-block-id="${escapeHtml(item.id)}" style="position:relative;display:block;max-width:100%;background:transparent;box-shadow:none;margin-bottom:-${BLOCK_STACK_OVERLAP}px">${header}${body}${footer}</div>`;
  }

  return `<div class="powershow-block powershow-block--statement" data-powershow-block-id="${escapeHtml(item.id)}" style="position:relative;display:block;max-width:100%;background:transparent;margin-bottom:-${BLOCK_STACK_OVERLAP}px">${header}<div style="position:relative;height:${BLOCK_CONNECTOR_HEIGHT}px">${renderConnector("bottom", color)}</div></div>`;
}

export function renderBlocks(element: BlocksElement): string {
  if (element.hidden) return "";
  const classes = ["powershow-element", "powershow-blocks"];
  const customClass = element.style?.className?.trim();
  if (customClass) classes.push(customClass);
  const rootStyle = renderCanonicalDataStyle(element);
  const styleAttribute = rootStyle ? ` style="${escapeHtml(rootStyle)}"` : "";
  const categories = new Map(element.categories.map((category) => [category.id, category.color]));
  return `<div class="${escapeHtml(classes.join(" "))}" data-powershow-id="${escapeHtml(element.id)}" data-powershow-type="blocks"${styleAttribute}><div class="powershow-blocks-stack" style="${stackStyle}">${element.items.map((item) => renderBlock(item, categories)).join("")}</div></div>`;
}
