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
// provides scripts and forms and grants allow-same-origin so real
// cross-origin players such as YouTube receive normal origin
// semantics for their scripts and resources. It explicitly denies
// top navigation, popups, downloads, and storage access.
//
// SECURITY: allow-same-origin combined with allow-scripts is not
// universally safe for same-origin embedded content. That concern is
// tracked as a separate architecture decision outside this renderer.
// ============================================================

const EMBED_SANDBOX = "allow-scripts allow-forms allow-same-origin";

// The only Permissions Policy token the renderer may grant is
// fullscreen. Camera, microphone, geolocation and other provider
// permissions are intentionally not emitted.
const EMBED_ALLOW = "fullscreen";

// External players such as YouTube require HTTP Referer
// identification and recommend referrerpolicy strict-origin-when-
// cross-origin.
const EMBED_REFERRERPOLICY = "strict-origin-when-cross-origin";

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
    ` referrerpolicy="${EMBED_REFERRERPOLICY}"` +
    ` loading="lazy"` +
    ` style="${escapeHtml(styles.join(";"))}"` +
    `></iframe>`
  );
}