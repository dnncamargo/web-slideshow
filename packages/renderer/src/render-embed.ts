import type {
  EmbedElement,
} from "@powershow/document-schema";

import { escapeHtml } from "./escape-html";
import { renderCanonicalSurfaceStyle } from "./render-canonical-surface";

// ============================================================
// BEGIN: EMBED SANDBOX
//
// Embed renders external web content as a sandboxed iframe.
//
// The sandbox is a fixed renderer-owned policy. It is NOT authored
// state and is never made author-configurable. It deliberately
// provides scripts and forms while keeping the embedded document on
// an opaque sandbox origin. It explicitly denies top navigation,
// popups, downloads, and storage access.
// ============================================================

const EMBED_SANDBOX = "allow-scripts allow-forms";

// The only Permissions Policy token the renderer may grant is
// fullscreen. Camera, microphone, geolocation and other provider
// permissions are intentionally not emitted.
const EMBED_ALLOW = "fullscreen";

// External players such as YouTube require HTTP Referer
// identification and recommend referrerpolicy strict-origin-when-
// cross-origin.
const EMBED_REFERRERPOLICY = "strict-origin-when-cross-origin";

function renderViewportNumber(value: number): string {
  return Number(value.toFixed(6)).toString();
}

function renderEmbedViewport(element: EmbedElement): string {
  const viewport = element.viewport;
  if (!viewport) {
    return "";
  }

  const zoom = viewport.zoom ?? 1;
  const top = viewport.top ?? 0;
  const right = viewport.right ?? 0;
  const bottom = viewport.bottom ?? 0;
  const left = viewport.left ?? 0;
  const reciprocalZoom = renderViewportNumber(100 / zoom);

  return [
    "display:block",
    "position:absolute",
    `width:calc(${reciprocalZoom}% + ${renderViewportNumber(left + right)}px)`,
    `height:calc(${reciprocalZoom}% + ${renderViewportNumber(top + bottom)}px)`,
    `left:-${renderViewportNumber(left)}px`,
    `top:-${renderViewportNumber(top)}px`,
    `transform:scale(${renderViewportNumber(zoom)})`,
    "transform-origin:top left",
  ].join(";");
}

const YOUTUBE_HOSTS = new Set([
  "youtube.com",
  "www.youtube.com",
  "m.youtube.com",
  "youtu.be",
]);

function resolveEmbedSrc(src: string): string {
  let url: URL;

  try {
    url = new URL(src);
  } catch {
    return src;
  }

  if (!YOUTUBE_HOSTS.has(url.hostname)) {
    return src;
  }

  if (url.hostname === "youtu.be") {
    const pathSegments = url.pathname.split("/");

    if (pathSegments.length !== 2 || !pathSegments[1]) {
      return src;
    }

    return `https://www.youtube.com/embed/${encodeURIComponent(pathSegments[1])}${url.search}${url.hash}`;
  }

  if (url.pathname === "/watch") {
    const videoId = url.searchParams.get("v");

    if (!videoId) {
      return src;
    }

    url.searchParams.delete("v");

    return `https://www.youtube.com/embed/${encodeURIComponent(videoId)}${url.search}${url.hash}`;
  }

  return src;
}

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

  const baseStyle = renderCanonicalSurfaceStyle(element);

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

  const iframe = (
    `<iframe` +
    (element.viewport
      ? ""
      : ` class="${escapeHtml(classes.join(" "))}"` +
        ` data-powershow-id="${escapeHtml(element.id)}"` +
        ` data-powershow-type="embed"`) +
    ` src="${escapeHtml(resolveEmbedSrc(element.src))}"` +
    ` title="${escapeHtml(element.title)}"` +
    ` sandbox="${EMBED_SANDBOX}"` +
    ` allow="${EMBED_ALLOW}"` +
    ` referrerpolicy="${EMBED_REFERRERPOLICY}"` +
    ` loading="lazy"` +
    ` style="${escapeHtml(element.viewport ? renderEmbedViewport(element) : styles.join(";"))}"` +
    `></iframe>`
  );

  if (!element.viewport) {
    return iframe;
  }

  return (
    `<div class="${escapeHtml(classes.join(" "))}"` +
    ` data-powershow-id="${escapeHtml(element.id)}"` +
    ` data-powershow-type="embed"` +
    ` style="${escapeHtml([
      ...styles,
      ...(element.layout?.position === undefined ? ["position:relative"] : []),
      "overflow:hidden",
    ].join(";"))}">` +
    iframe +
    `</div>`
  );
}
