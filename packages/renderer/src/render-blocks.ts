import type {
  BlockItem,
  BlocksElement,
} from "@powershow/document-schema";

import { escapeHtml } from "./escape-html";
import { renderStyle } from "./render-style";

// ============================================================
// BEGIN: BLOCKS STATIC RENDERER
//
// Blocks is a native visual code representation. It is NOT
// Blockly, NOT Scripted, NOT executable, and NOT a PowerShow
// container.
//
// The renderer output is completely static: no scripts, no event
// handlers, no eval/Function, no Blockly runtime, and no generated
// executable code.
//
// Renderer-owned structural styles below make nested blocks
// visibly read as blocks. The authored ElementStyle on the root
// remains authoritative and is applied through renderStyle().
//
// Each BlockItem renders as a structural node that separates the
// visual block (powershow-blocks-item) from its recursive children
// group (powershow-blocks-children). The children group is a
// sibling AFTER the visual item inside the node, so a parent's
// bordered visual block never encloses its descendant subtree.
// ============================================================

// Root/list: vertical stack with a small gap between root items,
// aligned to the start of the cross axis so automatic-width blocks
// size naturally to their content.
const BLOCKS_LIST_STYLE =
  "display:flex;flex-direction:column;" +
  "gap:8px;align-items:flex-start";

// Structural node: vertical stack that groups a visual item and its
// optional children group.
const BLOCK_NODE_STYLE =
  "display:flex;flex-direction:column;" +
  "align-items:flex-start;gap:8px;max-width:100%";

// Block visual: a compact bordered box that sizes to its content.
const BLOCK_ITEM_STYLE =
  "display:block;max-width:100%;box-sizing:border-box;" +
  "padding:8px 12px;" +
  "border:1px solid currentColor;" +
  "border-radius:8px;" +
  "white-space:pre-wrap";

// Nested children: vertical stack with a small gap and left indent,
// aligned to the start so nested blocks size naturally.
const BLOCK_CHILDREN_STYLE =
  "display:flex;flex-direction:column;" +
  "gap:8px;margin-inline-start:24px;" +
  "align-items:flex-start;max-width:100%";

function renderBlockItem(item: BlockItem): string {
  const children =
    item.children.length > 0
      ? (
        `<div class="powershow-blocks-children"` +
        ` style="${BLOCK_CHILDREN_STYLE}">` +
        item.children
          .map((child) => renderBlockItem(child))
          .join("") +
        `</div>`
      )
      : "";

  return (
    `<div class="powershow-blocks-node"` +
    ` data-powershow-block-id="${escapeHtml(item.id)}"` +
    ` style="${BLOCK_NODE_STYLE}">` +
    `<div class="powershow-blocks-item"` +
    ` style="${BLOCK_ITEM_STYLE}">` +
    escapeHtml(item.text) +
    `</div>` +
    children +
    `</div>`
  );
}

export function renderBlocks(
  element: BlocksElement,
): string {
  if (element.hidden) {
    return "";
  }

  const classes = [
    "powershow-element",
    "powershow-blocks",
  ];

  const customClass =
    element.style?.className?.trim();

  if (customClass) {
    classes.push(customClass);
  }

  const baseStyle =
    renderStyle(element.style);

  const styleAttribute =
    baseStyle
      ? ` style="${escapeHtml(baseStyle)}"`
      : "";

  const items = element.items
    .map((item) => renderBlockItem(item))
    .join("");

  return (
    `<div` +
    ` class="${escapeHtml(classes.join(" "))}"` +
    ` data-powershow-id="${escapeHtml(element.id)}"` +
    ` data-powershow-type="blocks"` +
    styleAttribute +
    `>` +
    `<div class="powershow-blocks-list"` +
    ` style="${BLOCKS_LIST_STYLE}">` +
    items +
    `</div>` +
    `</div>`
  );
}

// ============================================================
// END: BLOCKS STATIC RENDERER
// ============================================================