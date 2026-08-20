import type {
  ElementStyle,
  PowerShowElement,
  TopicItem,
  TopicMarkerStyle,
  TopicsElement,
} from "@powershow/document-schema";

import { escapeHtml } from "./escape-html";
import { quoteCssString } from "./escape-css-string";
import { renderLength } from "./render-length";
import { renderStyle } from "./render-style";

type RenderChild = (element: PowerShowElement) => string;

type TopicsListContext = {
  kind: TopicsElement["kind"];

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
  kind: TopicsElement["kind"],
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

type TopicsTextStyle = Pick<
  ElementStyle,
  | "color"
  | "textDecorationColor"
  | "fontFamily"
  | "fontSize"
  | "fontWeight"
  | "fontStyle"
  | "textAlign"
  | "lineHeight"
  | "letterSpacing"
  | "textTransform"
  | "whiteSpace"
  | "textWrapStyle"
  | "overflowWrap"
  | "textDecorationLine"
>;

function splitTopicsStyle(style: ElementStyle | undefined): {
  containerStyle: ElementStyle | undefined;
  topicTextStyle: TopicsTextStyle | undefined;
} {
  if (!style) {
    return {
      containerStyle: undefined,
      topicTextStyle: undefined,
    };
  }

  const {
    color,
    textDecorationColor,
    fontFamily,
    fontSize,
    fontWeight,
    fontStyle,
    textAlign,
    lineHeight,
    letterSpacing,
    textTransform,
    whiteSpace,
    textWrapStyle,
    overflowWrap,
    textDecorationLine,
    ...containerStyle
  } = style;

  const topicTextStyle: TopicsTextStyle = {};

  if (color !== undefined) {
    topicTextStyle.color = color;
  }

  if (textDecorationColor !== undefined) {
    topicTextStyle.textDecorationColor = textDecorationColor;
  }

  if (fontFamily !== undefined) {
    topicTextStyle.fontFamily = fontFamily;
  }

  if (fontSize !== undefined) {
    topicTextStyle.fontSize = fontSize;
  }

  if (fontWeight !== undefined) {
    topicTextStyle.fontWeight = fontWeight;
  }

  if (fontStyle !== undefined) {
    topicTextStyle.fontStyle = fontStyle;
  }

  if (textAlign !== undefined) {
    topicTextStyle.textAlign = textAlign;
  }

  if (lineHeight !== undefined) {
    topicTextStyle.lineHeight = lineHeight;
  }

  if (letterSpacing !== undefined) {
    topicTextStyle.letterSpacing = letterSpacing;
  }

  if (textTransform !== undefined) {
    topicTextStyle.textTransform = textTransform;
  }

  if (whiteSpace !== undefined) {
    topicTextStyle.whiteSpace = whiteSpace;
  }

  if (textWrapStyle !== undefined) {
    topicTextStyle.textWrapStyle = textWrapStyle;
  }

  if (overflowWrap !== undefined) {
    topicTextStyle.overflowWrap = overflowWrap;
  }

  if (textDecorationLine !== undefined) {
    topicTextStyle.textDecorationLine = textDecorationLine;
  }

  return {
    containerStyle: Object.keys(containerStyle).length > 0
      ? containerStyle
      : undefined,
    topicTextStyle: Object.keys(topicTextStyle).length > 0
      ? topicTextStyle
      : undefined,
  };
}

function renderTopicsStyleOverrides(
  element: TopicsElement,
): string {
  const styles: string[] = [];
  const { containerStyle, topicTextStyle } = splitTopicsStyle(element.style);

  const baseStyle = renderStyle(containerStyle);

  if (baseStyle) {
    styles.push(baseStyle);
  }

  if (topicTextStyle) {
    if (topicTextStyle.color !== undefined) {
      styles.push(`--powershow-topic-color:${topicTextStyle.color}`);
    }

    if (topicTextStyle.textDecorationColor !== undefined) {
      styles.push(
        `--powershow-topic-text-decoration-color:${topicTextStyle.textDecorationColor}`,
      );
    }

    if (topicTextStyle.fontFamily !== undefined) {
      styles.push(
        `--powershow-topic-font-family:${quoteCssString(topicTextStyle.fontFamily)}`,
      );
    }

    if (topicTextStyle.fontSize !== undefined) {
      styles.push(`--powershow-topic-font-size:${renderLength(topicTextStyle.fontSize)}`);
    }

    if (topicTextStyle.fontWeight !== undefined) {
      styles.push(`--powershow-topic-font-weight:${topicTextStyle.fontWeight}`);
    }

    if (topicTextStyle.fontStyle !== undefined) {
      styles.push(`--powershow-topic-font-style:${topicTextStyle.fontStyle}`);
    }

    if (topicTextStyle.textAlign !== undefined) {
      styles.push(`--powershow-topic-text-align:${topicTextStyle.textAlign}`);
    }

    if (topicTextStyle.lineHeight !== undefined) {
      styles.push(`--powershow-topic-line-height:${topicTextStyle.lineHeight}`);
    }

    if (topicTextStyle.letterSpacing !== undefined) {
      styles.push(
        `--powershow-topic-letter-spacing:${renderLength(topicTextStyle.letterSpacing)}`,
      );
    }

    if (topicTextStyle.textTransform !== undefined) {
      styles.push(`--powershow-topic-text-transform:${topicTextStyle.textTransform}`);
    }

    if (topicTextStyle.whiteSpace !== undefined) {
      styles.push(`--powershow-topic-white-space:${topicTextStyle.whiteSpace}`);
    }

    if (topicTextStyle.textWrapStyle !== undefined) {
      styles.push(`--powershow-topic-text-wrap-style:${topicTextStyle.textWrapStyle}`);
    }

    if (topicTextStyle.overflowWrap !== undefined) {
      styles.push(`--powershow-topic-overflow-wrap:${topicTextStyle.overflowWrap}`);
    }

    if (topicTextStyle.textDecorationLine !== undefined) {
      styles.push(
        `--powershow-topic-text-decoration-line:${topicTextStyle.textDecorationLine}`,
      );
    }
  }

  styles.push(
    `--powershow-topic-marker-style:${resolveTopicMarkerStyle(
      element.kind,
      element.rootMarkerStyle,
      0,
    )}`,
  );

  if (element.markerColor !== undefined) {
    styles.push(`--powershow-topic-marker-color:${element.markerColor}`);
  }

  if (element.itemGap !== undefined) {
    styles.push(`--powershow-topic-item-gap:${element.itemGap}px`);
  }

  return styles.join(";");
}

function renderTopicListTag(
  kind: TopicsElement["kind"],
): "ul" | "ol" {
  return kind === "ordered" ? "ol" : "ul";
}

function renderTopicItem(
  item: TopicItem,
  context: TopicsListContext,
  depth: number,
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
    `data-powershow-content-slot-id="${escapeHtml(item.content.id)}"`,
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
  const classes = ["powershow-topics"];

  const markerStyle = resolveTopicMarkerStyle(
    context.kind,
    context.rootMarkerStyle,
    depth,
  );

  const attributes = [
    `class="${escapeHtml(classes.join(" "))}"`,
    `style="--powershow-topic-marker-style:${markerStyle}"`,
  ].join(" ");

  const children = items
    .map((item) => renderTopicItem(item, context, depth, renderChild))
    .join("");

  return `<${tag} ${attributes}>${children}</${tag}>`;
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

  const combinedStyle = renderTopicsStyleOverrides(element);

  const attributes = [
    `class="${escapeHtml(classes.join(" "))}"`,
    `data-powershow-id="${escapeHtml(element.id)}"`,
    `data-powershow-type="topics"`,
    combinedStyle ? `style="${escapeHtml(combinedStyle)}"` : "",
  ]
    .filter(Boolean)
    .join(" ");

  const context: TopicsListContext = {
    kind: element.kind,
    rootMarkerStyle: element.rootMarkerStyle,
  };

  const items = element.items
    .map((item) => renderTopicItem(item, context, 0, renderChild))
    .join("");

  return `<${tag} ${attributes}>${items}</${tag}>`;
}
