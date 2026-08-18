import type {
  PowerShowElement,
  TopicItem,
  TopicsElement,
} from "@powershow/document-schema";

import { escapeHtml } from "./escape-html";
import { renderStyle } from "./render-style";

type RenderChild = (element: PowerShowElement) => string;

function renderTopicListTag(
  kind: TopicsElement["kind"],
): "ul" | "ol" {
  return kind === "ordered" ? "ol" : "ul";
}

function renderTopicItem(
  item: TopicItem,
  kind: TopicsElement["kind"],
  renderChild: RenderChild,
): string {
  const classes = ["powershow-topic-item"];

  const customClass = item.content.style?.className?.trim();

  if (customClass) {
    classes.push(customClass);
  }

  const style = renderStyle(item.content.style);

  const attributes = [
    `class="${escapeHtml(classes.join(" "))}"`,
    style ? `style="${escapeHtml(style)}"` : "",
  ]
  .filter(Boolean)
    .join(" ");

  const content = item.content.children
    .map(renderChild)
    .join("");

  const nested =
    item.children.length > 0
      ? renderTopicList(item.children, kind, renderChild)
      : "";

  return `<li ${attributes}>${content}${nested}</li>`;
}

function renderTopicList(
  items: TopicItem[],
  kind: TopicsElement["kind"],
  renderChild: RenderChild,
): string {
  const tag = renderTopicListTag(kind);
  const classes = ["powershow-topics"];

  const children = items
    .map((item) => renderTopicItem(item, kind, renderChild))
    .join("");

  return `<${tag} class="${escapeHtml(classes.join(" "))}">${children}</${tag}>`;
}

export function renderTopics(
  element: TopicsElement,
  renderChild: RenderChild,
): string {
  if (element.hidden) {
    return "";
  }

  const tag = renderTopicListTag(element.kind);

  const classes = ["powershow-element", "powershow-topics"];

  const customClass = element.style?.className?.trim();

  if (customClass) {
    classes.push(customClass);
  }

  const style = renderStyle(element.style);

  const attributes = [
    `class="${escapeHtml(classes.join(" "))}"`,
    `data-powershow-id="${escapeHtml(element.id)}"`,
    `data-powershow-type="topics"`,
    style ? `style="${escapeHtml(style)}"` : "",
  ]
    .filter(Boolean)
    .join(" ");

  const items = element.items
    .map((item) => renderTopicItem(item, element.kind, renderChild))
    .join("");

  return `<${tag} ${attributes}>${items}</${tag}>`;
}
