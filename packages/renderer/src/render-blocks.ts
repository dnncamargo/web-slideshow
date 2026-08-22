import type { BlockItem, BlockPart, BlocksElement } from "@powershow/document-schema";
import { escapeHtml } from "./escape-html";
import { renderStyle } from "./render-style";

const BLOCK_CONNECTOR_WIDTH = 14;
const BLOCK_CONNECTOR_HEIGHT = 5;
const BLOCK_STACK_OVERLAP = 4;
const SCOPE_INDENT = 18;
const SCOPE_CLOSING_WIDTH = 72;
const FALLBACK_CATEGORY_COLOR = "#64748b";

const stackStyle = "display:flex;flex-direction:column;align-items:flex-start;" +
  `--powershow-connector-width:${BLOCK_CONNECTOR_WIDTH}px;--powershow-connector-height:${BLOCK_CONNECTOR_HEIGHT}px;--powershow-stack-overlap:${BLOCK_STACK_OVERLAP}px;`;
const blockStyle = "position:relative;box-sizing:border-box;max-width:100%;font:500 13px/1.35 system-ui,sans-serif;color:#fff;padding:8px 12px 9px;border:0;border-radius:6px;box-shadow:inset 0 1px rgba(255,255,255,.22),inset 0 -2px rgba(0,0,0,.16);";

function renderPart(part: BlockPart, categories: Map<string, string>): string {
  if (part.type === "text") return `<span class="powershow-block-text">${escapeHtml(part.text)}</span>`;
  if (part.content.type === "empty") return `<span class="powershow-block-socket powershow-block-socket--empty" data-powershow-part-id="${escapeHtml(part.id)}" aria-label="empty socket"></span>`;
  if (part.content.type === "literal") return `<span class="powershow-block-socket powershow-block-socket--literal" data-powershow-part-id="${escapeHtml(part.id)}">${escapeHtml(part.content.value)}</span>`;
  return `<span class="powershow-block-socket powershow-block-socket--block" data-powershow-part-id="${escapeHtml(part.id)}">${renderBlock(part.content.block, categories)}</span>`;
}

function renderBlock(item: BlockItem, categories: Map<string, string>): string {
  const color = categories.get(item.categoryId) ?? FALLBACK_CATEGORY_COLOR;
  const parts = item.parts.map((part) => renderPart(part, categories)).join("");
  const header = `<div class="powershow-block-header"><span class="powershow-block-connector powershow-block-connector--top" aria-hidden="true"></span><div class="powershow-block-parts">${parts}</div></div>`;
  const connector = `<span class="powershow-block-connector" aria-hidden="true"></span>`;
  const overlap = item.shape === "value" ? 0 : BLOCK_STACK_OVERLAP;
  const attrs = `data-powershow-block-id="${escapeHtml(item.id)}" style="${blockStyle}background-color:${escapeHtml(color)};margin-bottom:-${overlap}px;"`;
  if (item.shape === "value") return `<span class="powershow-block powershow-block--value" ${attrs}>${parts}</span>`;
  if (item.shape === "scope") {
    const body = item.children.length === 0 ? "" : `<div class="powershow-block-scope-body" style="margin-inline-start:${SCOPE_INDENT}px"><div class="powershow-block-scope-stack" style="${stackStyle}">${item.children.map((child) => renderBlock(child, categories)).join("")}</div></div>`;
    return `<div class="powershow-block powershow-block--scope" ${attrs}>${header}${body}<div class="powershow-block-scope-footer" style="width:${SCOPE_CLOSING_WIDTH}px;background-color:${escapeHtml(color)}">${connector}</div></div>`;
  }
  return `<div class="powershow-block powershow-block--statement" ${attrs}>${header}${connector}</div>`;
}

export function renderBlocks(element: BlocksElement): string {
  if (element.hidden) return "";
  const classes = ["powershow-element", "powershow-blocks"];
  const customClass = element.style?.className?.trim();
  if (customClass) classes.push(customClass);
  const baseStyle = renderStyle(element.style);
  const styleAttribute = baseStyle ? ` style="${escapeHtml(baseStyle)}"` : "";
  const categories = new Map(element.categories.map((category) => [category.id, category.color]));
  return `<div class="${escapeHtml(classes.join(" "))}" data-powershow-id="${escapeHtml(element.id)}" data-powershow-type="blocks"${styleAttribute}><div class="powershow-blocks-stack" style="${stackStyle}">${element.items.map((item) => renderBlock(item, categories)).join("")}</div></div>`;
}
