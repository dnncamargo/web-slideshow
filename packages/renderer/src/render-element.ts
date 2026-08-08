import { renderCode } from "./render-code";
import { renderTable } from "./render-table";
import { renderTerminal } from "./render-terminal";

import type {
  ImageElement,
  PowerShowElement,
  TextboxElement,
  TextElement,
} from "@powershow/document-schema";

import { escapeHtml } from "./escape-html";
import { renderContainer } from "./render-container";
import { renderStyle } from "./render-style";

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

  const content = escapeHtml(element.content);

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

  return `<div ${attributes}>` + escapeHtml(element.content) + "</div>";
}

function renderImage(element: ImageElement): string {
  if (element.hidden) {
    return "";
  }

  const attributes = buildAttributes(
    element,
    ["powershow-image"],
    `object-fit:${element.fit}`,
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
      return renderTable(element);

    case "chart":
    case "interactive":
      return renderPlaceholder(element);

    default:
      return assertNever(element);
  }
}
