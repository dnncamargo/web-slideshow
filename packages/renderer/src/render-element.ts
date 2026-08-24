import { renderCode } from "./render-code";
import { renderRichText } from "./render-rich-text";
import { renderTable } from "./render-table";
import { renderTopics } from "./render-topics";
import { renderTerminal } from "./render-terminal";
import { renderDivider } from "./render-divider";
import { renderGallery } from "./render-gallery";
import { renderEmbed } from "./render-embed";
import { renderBlocks } from "./render-blocks";
import { renderScripted } from "./render-scripted";

import type {
  ElementLink,
  ElementStyle,
  ContainerElement,
  ImageElement,
  PowerShowElement,
  TextboxElement,
  TextElement,
} from "@powershow/document-schema";

import { escapeHtml } from "./escape-html";
import { renderContainer } from "./render-container";
import { renderStyle } from "./render-style";
import { renderCanonicalTextStyle } from "./render-canonical-text";
import {
  renderCanonicalImageCropMetadata,
  renderCanonicalImageMediaStyle,
  renderCanonicalImageStyle,
} from "./render-canonical-image";

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

  const customClass =
    element.type === "container" || element.type === "text" || element.type === "textbox" || element.type === "image"
      ? element.style?.className?.trim()
      : undefined;

  if (customClass) {
    outputClasses.push(customClass);
  }

  const styles: string[] = [];

  const baseStyle =
    element.type === "container"
      ? ""
      : element.type === "text" || element.type === "textbox"
        ? renderCanonicalTextStyle(element)
        : element.type === "image"
          ? renderCanonicalImageStyle(element)
        : renderStyle(element.style as ElementStyle | undefined);

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

  const elementStyle = renderCanonicalImageStyle(element);

  if (elementStyle) {
    styleParts.push(elementStyle);
  }

  if (element.crop) {
    styleParts.push("position:relative;overflow:hidden");
  }

  const attributes: string[] = [
    `href="${escapeHtml(link.href)}"`,
    'data-powershow-link="true"',
    `class="${escapeHtml(classes.join(" "))}"`,
    `data-powershow-id="${escapeHtml(element.id)}"`,
    `data-powershow-type="image"`,
    ` style="${escapeHtml(styleParts.join(";"))}"`,
  ];

  const cropMetadata = renderCanonicalImageCropMetadata(element);
  if (cropMetadata) attributes.push(cropMetadata);

  if (link.target === "_blank") {
    attributes.push('target="_blank"', 'rel="noopener noreferrer"');
  } else if (link.target === "_self") {
    attributes.push('target="_self"');
  }

  const media = `<img class="powershow-image-media"` +
    ` src="${escapeHtml(element.src)}"` +
    ` alt="${escapeHtml(element.alt)}"` +
    ` style="${escapeHtml(renderCanonicalImageMediaStyle(element))}">`;

  if (!element.crop) {
    return `<a ${attributes.join(" ")}>${media}</a>`;
  }

  return `<a ${attributes.join(" ")}><div class="powershow-image-crop-viewport">${media}</div></a>`;
}

function renderImage(element: ImageElement): string {
  if (element.hidden) {
    return "";
  }

  if (element.link) {
    return renderLinkedImage(element, element.link);
  }

  if (element.crop) {
    const attributes = buildAttributes(
      element,
      ["powershow-image"],
      "position:relative;overflow:hidden",
    );
    return (
      `<div ${attributes} ${renderCanonicalImageCropMetadata(element)}>` +
      `<div class="powershow-image-crop-viewport">` +
      `<img class="powershow-image-media"` +
      ` src="${escapeHtml(element.src)}"` +
      ` alt="${escapeHtml(element.alt)}"` +
      ` style="display:block;position:absolute;max-width:none">` +
      `</div></div>`
    );
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
    case "scripted":
      return renderScripted(element);

    case "chart":
    case "interactive":
      return renderPlaceholder(element);

    default:
      return assertNever(element);
  }
}
