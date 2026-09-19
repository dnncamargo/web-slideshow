import type {
  EmbedElement,
} from "@web-slideshow/document-schema";

import { escapeHtml } from "./escape-html";
import { renderCanonicalSurfaceStyle } from "./render-canonical-surface";
import { renderLength } from "./render-length";
import { renderGradientBorder } from "./render-visual";

// ============================================================
// BEGIN: EMBED SANDBOX
//
// Embed renders external web content as a sandboxed iframe.
//
// The sandbox is a fixed renderer-owned policy. It is NOT authored
// state and is never made author-configurable. It permits scripts and
// forms, while allowing the embedded provider to retain its own origin.
// Cross-origin providers remain cross-origin relative to PowerShow.
// Top navigation, popups, and downloads remain denied by sandbox.
// Sandbox policy remains renderer-owned.
// ============================================================

const EMBED_SANDBOX =
  "allow-scripts allow-forms allow-same-origin";

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
    "border:0",
    `width:calc(${reciprocalZoom}% + ${renderViewportNumber(left + right)}px)`,
    `height:calc(${reciprocalZoom}% + ${renderViewportNumber(top + bottom)}px)`,
    `left:-${renderViewportNumber(left * zoom)}px`,
    `top:-${renderViewportNumber(top * zoom)}px`,
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

  const gradientBorder = element.style?.border?.gradient;
  const hasGradientBorder = gradientBorder !== undefined;
  const borderWidth = element.style?.border?.width;
  const baseStyle = renderCanonicalSurfaceStyle(element, {
    includeBorder: !hasGradientBorder,
  });

  if (baseStyle) {
    styles.push(baseStyle);
  }

  if (hasGradientBorder && gradientBorder && borderWidth !== undefined) {
    styles.push(
      "border:0",
      `padding:${renderLength(borderWidth)}`,
      ...renderGradientBorder(gradientBorder, borderWidth),
    );

    if (!element.viewport && element.layout?.width === undefined) {
      styles.push("width:max-content");
    }

    if (element.layout?.position === undefined) {
      styles.push("position:relative");
    }

    if (element.style?.borderRadius !== undefined) {
      styles.push(
        `--presentation-embed-inner-radius:max(0px,calc(${renderLength(element.style.borderRadius)} - ${renderLength(borderWidth)}))`,
      );
    }
  }

  // The browser iframe default is a visible border or not. When no
  // canonical border is authored, the renderer collapses it so the
  // Embed box matches other PowerShow elements. An authored border
  // remains authoritative and is never overridden.
  if (element.style?.border === undefined) {
    styles.push("border:0");
  }

  const iframeStyles = element.viewport
    ? renderEmbedViewport(element)
    : hasGradientBorder
      ? [
        "display:block",
        ...(element.layout?.width !== undefined ? ["width:100%"] : []),
        ...(element.layout?.height !== undefined ? ["height:100%"] : []),
        "border:0",
        ...(element.style?.borderRadius !== undefined
          ? ["border-radius:var(--presentation-embed-inner-radius)"]
          : []),
      ].join(";")
      : styles.join(";");

  const iframe = (
    `<iframe` +
    (element.viewport
      ? ""
      : hasGradientBorder
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
    ` style="${escapeHtml(iframeStyles)}"` +
    `></iframe>`
  );

  if (!element.viewport && !hasGradientBorder) {
    return iframe;
  }

  if (!element.viewport) {
    return (
      `<div class="${escapeHtml([...classes, "presentation-gradient-border"].join(" "))}"` +
      ` data-powershow-id="${escapeHtml(element.id)}"` +
      ` data-powershow-type="embed"` +
      ` style="${escapeHtml(styles.join(";"))}">` +
      iframe +
      `</div>`
    );
  }

  if (hasGradientBorder) {
    const surfaceStyles = [
      "display:block",
      "position:relative",
      "width:100%",
      "height:100%",
      "overflow:hidden",
    ];

    if (element.style?.borderRadius !== undefined) {
      surfaceStyles.push(
        "border-radius:var(--presentation-embed-inner-radius)",
      );
    }

    return (
      `<div class="${escapeHtml([...classes, "presentation-gradient-border"].join(" "))}"` +
      ` data-powershow-id="${escapeHtml(element.id)}"` +
      ` data-powershow-type="embed"` +
      ` style="${escapeHtml(styles.join(";"))}">` +
      `<div class="presentation-embed-gradient-surface" style="${escapeHtml(surfaceStyles.join(";"))}">` +
      iframe +
      `</div>` +
      `</div>`
    );
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
