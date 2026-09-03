import type { BlocksElement, Border, ColorValue } from "@powershow/document-schema";

import { parseBlocksSource, type BlocksAstNode, type BlocksCategory, type BlocksInlineNode } from "./blocks-source";
import { escapeHtml } from "./escape-html";
import { renderCanonicalDataStyle } from "./render-canonical-data";
import { renderColorValue } from "./render-palette";
import { renderBorder } from "./render-visual";

const DEFAULT_STATEMENT_COLOR = "#4C97FF";
const DEFAULT_SCOPE_COLOR = "#FFAB19";
const DEFAULT_LOGIC_COLOR = "#59C059";
const DEFAULT_TEXT_COLOR = "#FFFFFF";
const CATEGORY_COLORS: Record<BlocksCategory, string> = {
  events: "#FFBF00",
  output: "#4C97FF",
  control: "#FFAB19",
  input: "#5CB1D6",
  math: "#59C059",
  variables: "#FF8C1A",
};
const stackStyle = "display:inline-flex;flex-direction:column;align-items:flex-start;width:max-content;white-space:nowrap";
const blockStyle = "display:inline-flex;align-items:center;width:max-content;min-width:0;white-space:nowrap;box-sizing:border-box;padding:7px 12px;border-radius:7px;position:relative;border:1px solid rgba(15,23,42,0.22)";
const scopeStyle = `${blockStyle};flex-direction:column;align-items:flex-start;padding:7px 12px 2px`;
const contentStyle = "display:inline-flex;align-items:center;width:max-content;white-space:nowrap";
const connectorStyle = "position:absolute;width:20px;height:4px;left:11px;bottom:-4px;border-radius:0 0 4px 4px";

interface BlocksRenderOptions {
  statementColor: string;
  scopeColor: string;
  logicColor: string;
  categoryColors: Partial<Record<BlocksCategory, ColorValue | undefined>> | undefined;
  textColor: string;
  blockBorder: Border | undefined;
}

function color(value: ColorValue | undefined, fallback: string): string {
  return renderColorValue(value ?? fallback);
}

function nodeColor(category: BlocksCategory | undefined, localColor: string | undefined, fallback: string, overrides: Partial<Record<BlocksCategory, ColorValue | undefined>> | undefined): string {
  return renderColorValue(localColor ?? (category === undefined ? fallback : overrides?.[category] ?? CATEGORY_COLORS[category]));
}

function categoryAttribute(category: BlocksCategory | undefined): string {
  return category === undefined ? "" : ` data-powershow-block-category="${escapeHtml(category)}"`;
}

function styleAttribute(value: string): string {
  return ` style="${escapeHtml(value)}"`;
}

function borderStyle(border: Border | undefined): string {
  return border === undefined ? "" : `;${renderBorder(border).join(";")}`;
}

function renderInline(nodes: BlocksInlineNode[], logicColor: string, textColor: string, blockBorder: Border | undefined, categoryColors: Partial<Record<BlocksCategory, ColorValue | undefined>> | undefined): string {
  return nodes.map((node) => {
    if (node.type === "text") return escapeHtml(node.value);
    if (node.type === "value") {
      const colored = node.category !== undefined || node.color !== undefined;
      const fill = nodeColor(node.category, node.color, "#f8fafc", categoryColors);
      const foreground = colored ? textColor : "#1e293b";
      return `<span class="powershow-block powershow-block--value"${categoryAttribute(node.category)}${styleAttribute(`${contentStyle};margin-inline:5px;background:${fill};color:${foreground};border-radius:999px;padding:2px 8px;border:1px solid rgba(15,23,42,0.22)${borderStyle(blockBorder)}`)}>${node.content.map((child) => child.type === "text" ? escapeHtml(child.value) : renderInline([child], nodeColor(node.category, node.color, logicColor, categoryColors), textColor, blockBorder, categoryColors)).join("")}</span>`;
    }
    if (node.type === "variable") {
      const fill = nodeColor(node.category, node.color, "#ff8c1a", categoryColors);
      return `<span class="powershow-block powershow-block--variable"${categoryAttribute(node.category)}${styleAttribute(`${contentStyle};margin-inline:5px;background:${fill};color:${textColor};border-radius:999px;padding:2px 8px;border:1px solid rgba(15,23,42,0.22)${borderStyle(blockBorder)}`)}>${escapeHtml(node.value)}</span>`;
    }
    if (node.type === "option") {
      return `<span class="powershow-block powershow-block--option"${styleAttribute(`${contentStyle};margin-inline:5px;background:#f8fafc;color:#1e293b;border:1px solid #94a3b8;border-radius:4px;padding:2px 7px`)}>${escapeHtml(node.value)}</span>`;
    }
    if (node.type === "logic") {
      const fill = nodeColor(node.category, node.color, logicColor, categoryColors);
      return `<span class="powershow-block powershow-block--logic"${categoryAttribute(node.category)}${styleAttribute(`${contentStyle};margin-inline:5px;background:${fill};color:${textColor};padding:5px 12px;border:1px solid rgba(15,23,42,0.22);clip-path:polygon(7px 0,calc(100% - 7px) 0,100% 50%,calc(100% - 7px) 100%,7px 100%,0 50%)${borderStyle(blockBorder)}`)}>${renderInline(node.content, fill, textColor, blockBorder, categoryColors)}</span>`;
    }
    return "";
  }).join("");
}

function renderConnector(blockColor: string): string {
  return `<span class="powershow-block-connector powershow-block-connector--bottom"${styleAttribute(`${connectorStyle};background:${blockColor}`)}></span>`;
}

function renderBlock(block: BlocksAstNode, options: BlocksRenderOptions): string {
  const { statementColor, scopeColor, logicColor, categoryColors, textColor, blockBorder } = options;
  if (block.type === "scope") {
    const blockColor = nodeColor(block.category, block.color, scopeColor, categoryColors);
    const header = `<div class="powershow-block-content"${styleAttribute(`${contentStyle};color:${textColor}`)}>${renderInline(block.content, logicColor, textColor, blockBorder, categoryColors)}</div>`;
    const children = block.children.map((child) => renderBlock(child, options)).join("");
    const body = `<div class="powershow-block-scope-body"${styleAttribute("display:flex;flex-direction:column;align-items:flex-start;width:max-content;padding:6px 0 0 14px;position:relative;z-index:1")}><div class="powershow-block-scope-stack"${styleAttribute(stackStyle)}>${children}</div></div>`;
    return `<div class="powershow-block powershow-block--scope"${categoryAttribute(block.category)}${styleAttribute(`${scopeStyle};background:${blockColor}${borderStyle(blockBorder)}`)}>${header}${body}${renderConnector(blockColor)}</div>`;
  }
  const content = `<div class="powershow-block-content"${styleAttribute(`${contentStyle};color:${textColor}`)}>${renderInline(block.content, logicColor, textColor, blockBorder, categoryColors)}</div>`;
  if (block.type === "start") {
    const blockColor = nodeColor(block.category, block.color, statementColor, categoryColors);
    const arch = `<span class="powershow-block-start-arch"${styleAttribute(`position:absolute;left:8px;top:-5px;width:28px;height:10px;border-radius:50% 50% 0 0;background:${blockColor}`)}></span>`;
    return `<div class="powershow-block powershow-block--start"${categoryAttribute(block.category)}${styleAttribute(`${blockStyle};background:${blockColor}${borderStyle(blockBorder)}`)}>${arch}${content}${renderConnector(blockColor)}</div>`;
  }
  const blockColor = nodeColor(block.category, block.color, statementColor, categoryColors);
  if (block.type === "end") return `<div class="powershow-block powershow-block--end"${categoryAttribute(block.category)}${styleAttribute(`${blockStyle};background:${blockColor}${borderStyle(blockBorder)}`)}>${content}</div>`;
  return `<div class="powershow-block powershow-block--statement"${categoryAttribute(block.category)}${styleAttribute(`${blockStyle};background:${blockColor}${borderStyle(blockBorder)}`)}>${content}${renderConnector(blockColor)}</div>`;
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
  const options: BlocksRenderOptions = {
    statementColor,
    scopeColor,
    logicColor,
    categoryColors: element.style?.categoryColors,
    textColor: color(element.style?.textColor, DEFAULT_TEXT_COLOR),
    blockBorder: element.style?.blockBorder,
  };
  const body = parsed.ok
    ? `<div class="powershow-blocks-stack"${styleAttribute(stackStyle)}>${parsed.blocks.map((block) => renderBlock(block, options)).join("")}</div>`
    : `<div class="powershow-blocks-invalid" data-powershow-blocks-invalid="true"></div>`;
  return `<div class="${escapeHtml(classes.join(" "))}" data-powershow-id="${escapeHtml(element.id)}" data-powershow-type="blocks"${style}>${body}</div>`;
}
