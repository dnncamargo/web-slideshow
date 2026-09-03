import type { BlocksElement, ColorValue } from "@powershow/document-schema";

import { parseBlocksSource, type BlocksAstNode, type BlocksCategory, type BlocksInlineNode } from "./blocks-source";
import { escapeHtml } from "./escape-html";
import { renderCanonicalDataStyle } from "./render-canonical-data";
import { renderColorValue } from "./render-palette";

const DEFAULT_STATEMENT_COLOR = "#4C97FF";
const DEFAULT_SCOPE_COLOR = "#FFAB19";
const DEFAULT_LOGIC_COLOR = "#59C059";
const CATEGORY_COLORS: Record<BlocksCategory, string> = {
  events: "#FFBF00",
  motion: "#4C97FF",
  looks: "#9966FF",
  sound: "#CF63CF",
  control: "#FFAB19",
  sensing: "#5CB1D6",
  operators: "#59C059",
  variables: "#FF8C1A",
};
const stackStyle = "display:flex;flex-direction:column;align-items:flex-start;width:max-content;white-space:nowrap";
const blockStyle = "display:inline-flex;align-items:center;width:max-content;white-space:nowrap;box-sizing:border-box;padding:7px 12px;border-radius:7px;position:relative";
const scopeStyle = `${blockStyle};flex-direction:column;align-items:flex-start`;
const contentStyle = "display:inline-flex;align-items:center;width:max-content;white-space:nowrap";
const connectorStyle = "position:absolute;width:20px;height:6px;left:11px;bottom:-5px;border-radius:0 0 4px 4px";

function color(value: ColorValue | undefined, fallback: string): string {
  return renderColorValue(value ?? fallback);
}

function categoryColor(category: BlocksCategory | undefined, fallback: string): string {
  return category === undefined ? fallback : CATEGORY_COLORS[category];
}

function categoryAttribute(category: BlocksCategory | undefined): string {
  return category === undefined ? "" : ` data-powershow-block-category="${escapeHtml(category)}"`;
}

function styleAttribute(value: string): string {
  return ` style="${escapeHtml(value)}"`;
}

function renderInline(nodes: BlocksInlineNode[], logicColor: string): string {
  return nodes.map((node) => {
    if (node.type === "text") return escapeHtml(node.value);
    if (node.type === "value") {
      return `<span class="powershow-block powershow-block--value"${styleAttribute(`${contentStyle};margin-inline:3px;background:#f8fafc;color:#1e293b;border-radius:999px;padding:2px 8px`)}>${escapeHtml(node.value)}</span>`;
    }
    if (node.type === "variable") {
      return `<span class="powershow-block powershow-block--variable"${styleAttribute(`${contentStyle};margin-inline:3px;background:#ff8c1a;color:#fff;border-radius:999px;padding:2px 8px`)}>${escapeHtml(node.value)}</span>`;
    }
    if (node.type === "logic") {
      const nodeColor = categoryColor(node.category, logicColor);
      return `<span class="powershow-block powershow-block--logic"${categoryAttribute(node.category)}${styleAttribute(`${contentStyle};margin-inline:3px;background:${nodeColor};color:#fff;padding:5px 12px;clip-path:polygon(7% 0,93% 0,100% 50%,93% 100%,7% 100%,0 50%)`)}>${renderInline(node.content, nodeColor)}</span>`;
    }
    return "";
  }).join("");
}

function renderConnector(blockColor: string): string {
  return `<span class="powershow-block-connector powershow-block-connector--bottom"${styleAttribute(`${connectorStyle};background:${blockColor}`)}></span>`;
}

function renderBlock(block: BlocksAstNode, statementColor: string, scopeColor: string, logicColor: string): string {
  if (block.type === "scope") {
    const header = `<div class="powershow-block-content"${styleAttribute(contentStyle)}>${renderInline(block.content, logicColor)}</div>`;
    const children = block.children.map((child) => renderBlock(child, statementColor, scopeColor, logicColor)).join("");
    const body = `<div class="powershow-block-scope-body"${styleAttribute("display:flex;flex-direction:column;align-items:flex-start;width:max-content;padding:6px 0 8px 14px;position:relative;z-index:1")}><div class="powershow-block-scope-stack"${styleAttribute(stackStyle)}>${children}</div></div>`;
    const blockColor = categoryColor(block.category, scopeColor);
    return `<div class="powershow-block powershow-block--scope"${categoryAttribute(block.category)}${styleAttribute(`${scopeStyle};background:${blockColor}`)}>${header}${body}${renderConnector(blockColor)}</div>`;
  }
  const content = `<div class="powershow-block-content"${styleAttribute(contentStyle)}>${renderInline(block.content, logicColor)}</div>`;
  if (block.type === "start") {
    const blockColor = categoryColor(block.category, statementColor);
    const arch = `<span class="powershow-block-start-arch"${styleAttribute(`position:absolute;left:8px;top:-5px;width:28px;height:10px;border-radius:50% 50% 0 0;background:${blockColor}`)}></span>`;
    return `<div class="powershow-block powershow-block--start"${categoryAttribute(block.category)}${styleAttribute(`${blockStyle};background:${blockColor}`)}>${arch}${content}${renderConnector(blockColor)}</div>`;
  }
  const blockColor = categoryColor(block.category, statementColor);
  if (block.type === "end") return `<div class="powershow-block powershow-block--end"${categoryAttribute(block.category)}${styleAttribute(`${blockStyle};background:${blockColor}`)}>${content}</div>`;
  return `<div class="powershow-block powershow-block--statement"${categoryAttribute(block.category)}${styleAttribute(`${blockStyle};background:${blockColor}`)}>${content}${renderConnector(blockColor)}</div>`;
}

export function renderBlocks(element: BlocksElement): string {
  if (element.hidden) return "";
  const classes = ["powershow-element", "powershow-blocks"];
  const customClass = element.style?.className?.trim();
  if (customClass) classes.push(customClass);
  const rootStyle = renderCanonicalDataStyle(element);
  const style = rootStyle ? ` style="${escapeHtml(rootStyle)}"` : "";
  const parsed = parseBlocksSource(element.source);
  const statementColor = color(element.style?.statementColor, DEFAULT_STATEMENT_COLOR);
  const scopeColor = color(element.style?.scopeColor, DEFAULT_SCOPE_COLOR);
  const logicColor = color(element.style?.logicColor, DEFAULT_LOGIC_COLOR);
  const body = parsed.ok
    ? `<div class="powershow-blocks-stack"${styleAttribute(stackStyle)}>${parsed.blocks.map((block) => renderBlock(block, statementColor, scopeColor, logicColor)).join("")}</div>`
    : `<div class="powershow-blocks-invalid" data-powershow-blocks-invalid="true"></div>`;
  return `<div class="${escapeHtml(classes.join(" "))}" data-powershow-id="${escapeHtml(element.id)}" data-powershow-type="blocks"${style}>${body}</div>`;
}
