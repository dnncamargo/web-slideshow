import type {
  PresentationElement,
  TopicItem,
  TopicMarkerStyle,
  TopicsElement,
  Presentation,
} from "@web-slideshow/document-schema";
import { resolveLinkedTopicsStyle } from "@web-slideshow/document-schema";

import { escapeHtml } from "./escape-html";
import { quoteCssString } from "./escape-css-string";
import { renderLength } from "./render-length";
import { renderContentSlotStyle } from "./render-content-slot";
import { renderColorValue } from "./render-palette";

type RenderChild = (element: PresentationElement) => string;

type TopicsListContext = {
  kind: NonNullable<TopicsElement["kind"]>;

  rootMarkerStyle: TopicMarkerStyle | undefined;
};

const UNORDERED_MARKER_SEQUENCE = [
  "disc",
  "circle",
  "square",
] as const;

const ORDERED_LOWERCASE_SEQUENCE = [
  "decimal",
  "lower-alpha",
  "lower-roman",
] as const;

const ORDERED_UPPER_ALPHA_SEQUENCE = [
  "upper-alpha",
  "upper-roman",
  "decimal",
] as const;

const ORDERED_UPPER_ROMAN_SEQUENCE = [
  "upper-roman",
  "decimal",
  "upper-alpha",
] as const;

function sequenceAt<T extends string>(
  sequence: readonly [T, T, T],
  start: number,
  depth: number,
): T {
  return sequence[(start + depth) % sequence.length] ?? sequence[0];
}

// rootMarkerStyle defines only depth 0. Structural TopicItem.children
// lists derive their marker deterministically from structural depth.
// An autonomous nested TopicsElement starts a new depth-0 context because
// it is rendered by a separate renderTopics() call.
export function resolveTopicMarkerStyle(
  kind: NonNullable<TopicsElement["kind"]>,
  rootMarkerStyle: TopicMarkerStyle | undefined,
  depth: number,
): TopicMarkerStyle {
  if (rootMarkerStyle === "none") {
    return "none";
  }

  if (kind === "unordered") {
    const start =
      rootMarkerStyle === "disc" ||
      rootMarkerStyle === "circle" ||
      rootMarkerStyle === "square"
        ? UNORDERED_MARKER_SEQUENCE.indexOf(rootMarkerStyle)
        : 0;

    // Undefined or an incompatible ordered marker: fall back to the
    // unordered default sequence starting at disc.
    return sequenceAt(UNORDERED_MARKER_SEQUENCE, start, depth);
  }

  if (rootMarkerStyle === "upper-alpha") {
    return sequenceAt(ORDERED_UPPER_ALPHA_SEQUENCE, 0, depth);
  }

  if (rootMarkerStyle === "upper-roman") {
    return sequenceAt(ORDERED_UPPER_ROMAN_SEQUENCE, 0, depth);
  }

  const start =
    rootMarkerStyle === "decimal" ||
    rootMarkerStyle === "lower-alpha" ||
    rootMarkerStyle === "lower-roman"
      ? ORDERED_LOWERCASE_SEQUENCE.indexOf(rootMarkerStyle)
      : 0;

  // Undefined or an incompatible unordered marker: fall back to the
  // ordered default sequence starting at decimal.
  return sequenceAt(ORDERED_LOWERCASE_SEQUENCE, start, depth);
}

function renderTopicsStyleOverrides(element: TopicsElement): string {
  const styles: string[] = [];
  const kind = element.kind ?? "unordered";
  if (element.layout) {
    if (element.layout.position !== undefined) styles.push(`position:${element.layout.position}`);
    for (const [property, value] of [["top", element.layout.top], ["right", element.layout.right], ["bottom", element.layout.bottom], ["left", element.layout.left], ["margin", element.layout.margin], ["margin-top", element.layout.marginTop], ["margin-right", element.layout.marginRight], ["margin-bottom", element.layout.marginBottom], ["margin-left", element.layout.marginLeft]] as const) {
      if (value !== undefined) styles.push(`${property}:${renderLength(value)}`);
    }
  }
  if (element.style?.color !== undefined) styles.push(`--presentation-topic-color:${renderColorValue(element.style.color)}`);
  const typography = element.typography;
  if (typography?.fontFamily !== undefined) styles.push(`--presentation-topic-font-family:${quoteCssString(typography.fontFamily)}`);
  if (typography?.fontSize !== undefined) styles.push(`--presentation-topic-font-size:${renderLength(typography.fontSize)}`);
  if (typography?.fontWeight !== undefined) styles.push(`--presentation-topic-font-weight:${typography.fontWeight}`);
  if (typography?.fontStyle !== undefined) styles.push(`--presentation-topic-font-style:${typography.fontStyle}`);
  if (typography?.textAlign !== undefined) styles.push(`--presentation-topic-text-align:${typography.textAlign}`);
  if (typography?.lineHeight !== undefined) styles.push(`--presentation-topic-line-height:${typography.lineHeight}`);
  if (typography?.letterSpacing !== undefined) styles.push(`--presentation-topic-letter-spacing:${renderLength(typography.letterSpacing)}`);
  if (typography?.textTransform !== undefined) styles.push(`--presentation-topic-text-transform:${typography.textTransform}`);
  if (typography?.whiteSpace !== undefined) styles.push(`--presentation-topic-white-space:${typography.whiteSpace}`);
  if (typography?.textWrapStyle !== undefined) styles.push(`--presentation-topic-text-wrap-style:${typography.textWrapStyle}`);
  if (typography?.overflowWrap !== undefined) styles.push(`--presentation-topic-overflow-wrap:${typography.overflowWrap}`);
  if (typography?.textDecorationLine !== undefined) styles.push(`--presentation-topic-text-decoration-line:${typography.textDecorationLine}`);

  styles.push(
    `--presentation-topic-marker-style:${resolveTopicMarkerStyle(
      kind,
      element.rootMarkerStyle,
      0,
    )}`,
  );

  if (element.markerColor !== undefined) {
    styles.push(`--presentation-topic-marker-color:${renderColorValue(element.markerColor)}`);
  }

  if (element.itemGap !== undefined) {
    styles.push(`--presentation-topic-item-gap:${element.itemGap}px`);
  }

  return styles.join(";");
}

function renderTopicListTag(
  kind: NonNullable<TopicsElement["kind"]>,
): "ul" | "ol" {
  return kind === "ordered" ? "ol" : "ul";
}

function renderTopicItem(
  item: TopicItem,
  context: TopicsListContext,
  depth: number,
  renderChild: RenderChild,
): string {
  const classes = ["presentation-topic-item"];

  const customClass = item.content.style?.className?.trim();

  if (customClass) {
    classes.push(customClass);
  }

  const style = renderContentSlotStyle(item.content);

  const attributes = [
    `class="${escapeHtml(classes.join(" "))}"`,
    `data-presentation-content-slot-id="${escapeHtml(item.content.id)}"`,
    style ? `style="${escapeHtml(style)}"` : "",
  ]
  .filter(Boolean)
    .join(" ");

  const content = item.content.children
    .map(renderChild)
    .join("");

  const nested =
    item.children.length > 0
      ? renderTopicList(item.children, context, depth + 1, renderChild)
      : "";

  return `<li ${attributes}>${content}${nested}</li>`;
}

function renderTopicList(
  items: TopicItem[],
  context: TopicsListContext,
  depth: number,
  renderChild: RenderChild,
): string {
  const tag = renderTopicListTag(context.kind);
  const classes = ["presentation-topics"];

  const markerStyle = resolveTopicMarkerStyle(
    context.kind,
    context.rootMarkerStyle,
    depth,
  );

  const attributes = [
    `class="${escapeHtml(classes.join(" "))}"`,
    `style="--presentation-topic-marker-style:${markerStyle}"`,
  ].join(" ");

  const children = items
    .map((item) => renderTopicItem(item, context, depth, renderChild))
    .join("");

  return `<${tag} ${attributes}>${children}</${tag}>`;
}

export function renderTopics(
  element: TopicsElement,
  renderChild: RenderChild,
  presentation?: Presentation,
): string {
  if (element.hidden) {
    return "";
  }

  if (element.linkedStyleId !== undefined && presentation === undefined) {
    throw new Error(
      `Cannot render linked topics style without presentation context: ${element.linkedStyleId}`,
    );
  }

  const resolved = presentation
    ? resolveLinkedTopicsStyle(presentation, element)
    : undefined;
  const renderedElement: TopicsElement = resolved
    ? { ...element, ...resolved }
    : element;
  const effectiveKind = renderedElement.kind ?? "unordered";

  const tag = renderTopicListTag(effectiveKind);

  const classes = ["presentation-element", "presentation-topics"];

  const customClass = renderedElement.style?.className?.trim();

  if (customClass) {
    classes.push(customClass);
  }

  const combinedStyle = renderTopicsStyleOverrides(renderedElement);

  const attributes = [
    `class="${escapeHtml(classes.join(" "))}"`,
    `data-presentation-id="${escapeHtml(renderedElement.id)}"`,
    `data-presentation-type="topics"`,
    combinedStyle ? `style="${escapeHtml(combinedStyle)}"` : "",
  ]
    .filter(Boolean)
    .join(" ");

  const context: TopicsListContext = {
    kind: effectiveKind,
    rootMarkerStyle: renderedElement.rootMarkerStyle,
  };

  const items = renderedElement.items
    .map((item) => renderTopicItem(item, context, 0, renderChild))
    .join("");

  return `<${tag} ${attributes}>${items}</${tag}>`;
}
