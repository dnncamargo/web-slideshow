import { renderCode } from "./render-code";
import { renderRichText } from "./render-rich-text";
import { renderTable } from "./render-table";
import { renderTopics } from "./render-topics";
import { renderTerminal } from "./render-terminal";
import { renderDivider } from "./render-divider";
import { renderGallery } from "./render-gallery";
import { renderEmbed } from "./render-embed";
import { renderBlocks } from "./render-blocks";

import type {
  ElementLink,
  ImageElement,
  PowerShowElement,
  TextboxElement,
  TextElement,
} from "@powershow/document-schema";

import { escapeHtml } from "./escape-html";
import { renderContainer } from "./render-container";
import { renderLength } from "./render-length";
import { renderStyle } from "./render-style";

const AUTHORED_LINK_APPEARANCE = "color:inherit;text-decoration:inherit";

function renderLinkContent(
  content: string,
  link: ElementLink | undefined,
): string {
  if (!link) {
    return content;
  }

  const attributes: string[] = [
    `href="${escapeHtml(link.href)}"`,
    'data-powershow-link="true"',
    `style="${AUTHORED_LINK_APPEARANCE}"`,
  ];

  if (link.target === "_blank") {
    attributes.push('target="_blank"', 'rel="noopener noreferrer"');
  } else if (link.target === "_self") {
    attributes.push('target="_self"');
  }

  return `<a ${attributes.join(" ")}>${content}</a>`;
}

function buildAttributes(
  element: PowerShowElement,
  classes: string[],
  extraStyle?: string,
): string {
  const outputClasses = ["powershow-element", ...classes];

  const customClass = element.style?.className?.trim();

  if (customClass) {
    outputClasses.push(customClass);
  }

  const styles: string[] = [];

  const baseStyle = renderStyle(element.style);

  if (baseStyle) {
    styles.push(baseStyle);
  }

  if (extraStyle) {
    styles.push(extraStyle);
  }

  const styleAttribute =
    styles.length > 0 ? ` style="${escapeHtml(styles.join(";"))}"` : "";

  return (
    `class="${escapeHtml(outputClasses.join(" "))}"` +
    ` data-powershow-id="${escapeHtml(element.id)}"` +
    ` data-powershow-type="${escapeHtml(element.type)}"` +
    styleAttribute
  );
}

function renderText(element: TextElement): string {
  if (element.hidden) {
    return "";
  }

  const renderedContent =
    typeof element.content === "string"
      ? escapeHtml(element.content)
      : renderRichText(element.content);
  const content = renderLinkContent(renderedContent, element.link);

  const attributes = buildAttributes(element, [
    "powershow-text",
    `powershow-text-${element.variant}`,
  ]);

  switch (element.variant) {
    case "title":
      return `<h1 ${attributes}>${content}</h1>`;

    case "subtitle":
      return `<h2 ${attributes}>${content}</h2>`;

    case "caption":
      return `<small ${attributes}>${content}</small>`;

    case "body":
      return `<p ${attributes}>${content}</p>`;
  }
}

function renderTextbox(element: TextboxElement): string {
  if (element.hidden) {
    return "";
  }

  const classes = ["powershow-textbox"];

  if (element.preset) {
    classes.push(`powershow-textbox-${element.preset}`);
  }

  const attributes = buildAttributes(element, classes);

  return (
    `<div ${attributes}>` +
    renderLinkContent(escapeHtml(element.content), element.link) +
    "</div>"
  );
}

function renderImageMediaStyle(element: ImageElement): string {
  const styles: string[] = [
    "display:block",
    `object-fit:${element.fit}`,
    `object-position:${element.focalPoint?.x ?? 50}% ${element.focalPoint?.y ?? 50}%`,
  ];

  // The media fills an explicitly sized root dimension so object-fit
  // resolves against the PowerShow element box. Dimensions that are not
  // defined on the canonical element are intentionally left alone so the
  // media keeps its intrinsic sizing behavior.
  if (element.style?.width !== undefined) {
    styles.push("width:100%");
  }

  if (element.style?.height !== undefined) {
    styles.push("height:100%");
  }

  // Border radius is duplicated onto the media so the rounded appearance
  // of the rendered bitmap matches the unlinked Image, where the radius
  // sits on the img root itself.
  if (element.style?.borderRadius !== undefined) {
    styles.push(`border-radius:${renderLength(element.style.borderRadius)}`);
  }

  return styles.join(";");
}

function renderLinkedImage(element: ImageElement, link: ElementLink): string {
  const classes = ["powershow-element", "powershow-image"];

  const customClass = element.style?.className?.trim();

  if (customClass) {
    classes.push(customClass);
  }

  // The anchor owns the PowerShow element box. The authored-link
  // appearance is emitted first so an explicit element style (color,
  // text-decoration-line) keeps precedence while the browser link look
  // stays suppressed otherwise.
  const styleParts = ["display:inline-block", AUTHORED_LINK_APPEARANCE];

  const elementStyle = renderStyle(element.style);

  if (elementStyle) {
    styleParts.push(elementStyle);
  }

  const attributes: string[] = [
    `href="${escapeHtml(link.href)}"`,
    'data-powershow-link="true"',
    `class="${escapeHtml(classes.join(" "))}"`,
    `data-powershow-id="${escapeHtml(element.id)}"`,
    `data-powershow-type="image"`,
    ` style="${escapeHtml(styleParts.join(";"))}"`,
  ];

  if (link.target === "_blank") {
    attributes.push('target="_blank"', 'rel="noopener noreferrer"');
  } else if (link.target === "_self") {
    attributes.push('target="_self"');
  }

  return (
    `<a ${attributes.join(" ")}>` +
    `<img class="powershow-image-media"` +
    ` src="${escapeHtml(element.src)}"` +
    ` alt="${escapeHtml(element.alt)}"` +
    ` style="${escapeHtml(renderImageMediaStyle(element))}">` +
    `</a>`
  );
}

function renderImage(element: ImageElement): string {
  if (element.hidden) {
    return "";
  }

  if (element.link) {
    return renderLinkedImage(element, element.link);
  }

  const attributes = buildAttributes(
    element,
    ["powershow-image"],
    `object-fit:${element.fit};object-position:${element.focalPoint?.x ?? 50}% ${element.focalPoint?.y ?? 50}%`,
  );

  return (
    `<img ${attributes}` +
    ` src="${escapeHtml(element.src)}"` +
    ` alt="${escapeHtml(element.alt)}">`
  );
}

function renderPlaceholder(element: PowerShowElement): string {
  if (element.hidden) {
    return "";
  }

  const attributes = buildAttributes(element, [
    "powershow-placeholder",
    `powershow-placeholder-${element.type}`,
  ]);

  return `<div ${attributes}>` + `[${escapeHtml(element.type)}]` + "</div>";
}

function assertNever(value: never): never {
  throw new Error(`Unsupported PowerShow element: ${String(value)}`);
}

export function renderElement(element: PowerShowElement): string {
  switch (element.type) {
    case "text":
      return renderText(element);

    case "textbox":
      return renderTextbox(element);

    case "image":
      return renderImage(element);

    case "container":
      return renderContainer(element, renderElement);

    case "code":
      return renderCode(element);

    case "terminal":
      return renderTerminal(element);

    case "table":
      return renderTable(element, renderElement);

    case "topics":
      return renderTopics(element, renderElement);

    case "divider":
      return renderDivider(element);

    case "gallery":
      return renderGallery(element);

    case "embed":
      return renderEmbed(element);

    case "blocks":
      return renderBlocks(element);

    case "chart":
    case "interactive":
      return renderPlaceholder(element);

    default:
      return assertNever(element);
  }
}
