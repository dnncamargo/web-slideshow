import { marked, Renderer } from "marked";

import { escapeHtml } from "./escape-html";

function safeLinkHref(href: string): boolean {
  const value = href.trim();
  if (value.length === 0 || /[\u0000-\u001f\u007f]/.test(value)) {
    return false;
  }

  try {
    const url = new URL(value, "https://markdown.invalid/");
    return url.protocol === "http:"
      || url.protocol === "https:"
      || url.protocol === "mailto:"
      || url.protocol === "tel:";
  } catch {
    return false;
  }
}

function safeImageHref(href: string): boolean {
  const value = href.trim();
  if (value.length === 0 || /[\u0000-\u001f\u007f]/.test(value)) {
    return false;
  }

  if (/^data:image\/(?:png|gif|jpe?g|webp);base64,/i.test(value)) {
    return true;
  }

  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

/**
 * Convert Markdown to renderer-owned HTML for Scripted previews.
 *
 * Raw HTML is escaped rather than interpreted, and links/images are
 * restricted to safe URL schemes before being emitted into the sandbox.
 */
export function renderMarkdownToSafeHtml(source: string): string {
  const renderer = new Renderer();

  renderer.html = ({ text }) => escapeHtml(text);
  renderer.link = ({ href, title, tokens }) => {
    const label = renderer.parser.parseInline(tokens);
    if (!safeLinkHref(href)) return label;

    const titleAttribute = typeof title !== "string" || title.length === 0
      ? ""
      : " title=\"" + escapeHtml(title) + "\"";

    return "<a href=\"" + escapeHtml(href) + "\"" + titleAttribute + " rel=\"noopener noreferrer\">" + label + "</a>";
  };
  renderer.image = ({ href, title, text }) => {
    if (!safeImageHref(href)) return escapeHtml(text);

    const titleAttribute = typeof title !== "string" || title.length === 0
      ? ""
      : " title=\"" + escapeHtml(title) + "\"";

    return "<img src=\"" + escapeHtml(href) + "\" alt=\"" + escapeHtml(text) + "\"" + titleAttribute + " loading=\"lazy\" decoding=\"async\">";
  };

  const html = marked.parse(source, {
    async: false,
    gfm: true,
    breaks: false,
    renderer,
  });

  return html;
}
