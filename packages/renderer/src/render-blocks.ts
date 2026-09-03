import type { BlocksElement } from "@powershow/document-schema";

import { escapeHtml } from "./escape-html";
import { renderCanonicalDataStyle } from "./render-canonical-data";

const sourceStyle = [
  "display:block",
  "box-sizing:border-box",
  "max-width:100%",
  "white-space:pre-wrap",
  "overflow-wrap:anywhere",
  "font:500 13px/1.35 system-ui,sans-serif",
].join(";");

export function renderBlocks(element: BlocksElement): string {
  if (element.hidden) return "";

  const classes = ["powershow-element", "powershow-blocks"];
  const customClass = element.style?.className?.trim();
  if (customClass) classes.push(customClass);

  const rootStyle = renderCanonicalDataStyle(element);
  const styleAttribute = rootStyle ? ` style="${escapeHtml(rootStyle)}"` : "";

  return `<div class="${escapeHtml(classes.join(" "))}" data-powershow-id="${escapeHtml(element.id)}" data-powershow-type="blocks"${styleAttribute}><div class="powershow-blocks-source" style="${sourceStyle}">${escapeHtml(element.source)}</div></div>`;
}
