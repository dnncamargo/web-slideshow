import type {
  EmbedElement,
} from "@powershow/document-schema";

import { escapeHtml } from "./escape-html";
import { renderStyle } from "./render-style";

// ============================================================
// BEGIN: EMBED SANDBOX
//
// Embed renders external web content as a sandboxed iframe.
//
// The sandbox is a fixed renderer-owned policy. It is NOT authored
// state and is never made author-configurable. It deliberately
// provides scripts and forms but explicitly denies same-origin
// access, top navigation, popups, downloads, and storage access.
// ============================================================

const EMBED_SANDBOX = "allow-scripts allow-forms";

// The only Permissions Policy token the renderer may grant is
// fullscreen. Camera, microphone, geolocation and other provider
// permissions are intentionally not emitted.
const EMBED_ALLOW = "fullscreen";

// ============================================================
// END: EMBED SANDBOX
// ============================================================

export function renderEmbed(
  element: EmbedElement,
): string {
  if (element.hidden) {
    return "";
  }

  const classes = [
    "powershow-element",
    "powershow-embed",
  ];

  const customClass =
    element.style?.className?.trim();

  if (customClass) {
    classes.push(customClass);
  }

  const styles: string[] = [
    "display:block",
  ];

  const baseStyle =
    renderStyle(element.style);

  if (baseStyle) {
    styles.push(baseStyle);
  }

  // The browser iframe default is a visible border or not. When no
  // canonical border is authored, the renderer collapses it so the
  // Embed box matches other PowerShow elements. An authored border
  // remains authoritative and is never overridden.
  if (element.style?.border === undefined) {
    styles.push("border:0");
  }

  return (
    `<iframe` +
    ` class="${escapeHtml(classes.join(" "))}"` +
    ` data-powershow-id="${escapeHtml(element.id)}"` +
    ` data-powershow-type="embed"` +
    ` src="${escapeHtml(element.src)}"` +
    ` title="${escapeHtml(element.title)}"` +
    ` sandbox="${EMBED_SANDBOX}"` +
    ` allow="${EMBED_ALLOW}"` +
    ` loading="lazy"` +
    ` style="${escapeHtml(styles.join(";"))}"` +
    `></iframe>`
  );
}