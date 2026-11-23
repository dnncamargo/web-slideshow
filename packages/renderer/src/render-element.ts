import { renderCode } from "./render-code";
import { renderRichText, renderTextContent } from "./render-rich-text";
import { renderTable } from "./render-table";
import { renderTopics } from "./render-topics";
import { renderTerminal } from "./render-terminal";
import { renderDivider } from "./render-divider";
import { renderGallery } from "./render-gallery";
import { renderEmbed } from "./render-embed";
import { renderBlocks } from "./render-blocks";
import { renderScripted, type ScriptedExecutionPolicy } from "./render-scripted";
import { renderShape } from "./render-shape";
import katex from "katex";

import type {
  ElementLink,
  ContainerElement,
  ImageElement,
  PresentationElement,
  TextElement,
  PlotElement,
  InteractiveElement,
} from "@web-slideshow/document-schema";
import type { Presentation } from "@web-slideshow/document-schema";
import { resolveTextStyle } from "@web-slideshow/document-schema";
import { FundamentalTextStyleIdSchema } from "@web-slideshow/document-schema";

import { escapeHtml } from "./escape-html";
import { renderContainer } from "./render-container";
import { renderCanonicalTextStyle, renderTextGlowFilter, renderTextShadow } from "./render-canonical-text";
import { renderPlot } from "./render-plot";
import { renderLength } from "./render-length";
import { renderGradient, renderGradientBorder, renderGradientBorderBox, renderBorder, renderShadow } from "./render-visual";
import { renderColorValue } from "./render-palette";
import {
  renderCanonicalImageCropMetadata,
  renderCanonicalImageMediaStyle,
  renderCanonicalImageStyle,
  resolveCanonicalImageSource,
} from "./render-canonical-image";

const AUTHORED_LINK_APPEARANCE = "color:inherit;text-decoration:inherit";
const TEXT_CONTENT_CLASS = "presentation-text-content";
const TEXT_GRADIENT_CONTENT_CLASS = "presentation-text-gradient-content";

function hasGradientBorder(element: ImageElement): boolean {
  return element.style?.border?.gradient !== undefined;
}

export type RenderContext = Readonly<{
  presentation: Presentation;
  scriptedExecutionPolicy?: ScriptedExecutionPolicy;
}>;

function renderImageCropBoxStyle(element: ImageElement): string {
  return element.layout?.position === "absolute"
    ? "overflow:hidden"
    : "position:relative;overflow:hidden";
}

function renderCroppedImageMedia(element: ImageElement, src: string): string {
  return `<img class="presentation-image-media"` +
    ` src="${escapeHtml(src)}"` +
    ` alt="${escapeHtml(element.alt)}"` +
    ` style="display:block;position:absolute;max-width:none">`;
}

function renderLinkContent(
  content: string,
  link: ElementLink | undefined,
): string {
  if (!link) {
    return content;
  }

  const attributes: string[] = [
    `href="${escapeHtml(link.href)}"`,
    'data-presentation-link="true"',
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
  element: PresentationElement,
  classes: string[],
  context?: RenderContext,
  extraStyle?: string,
  options: { includeTextBorder?: boolean } = {},
): string {
  const outputClasses = ["presentation-element", ...classes];

  const customClass =
    element.type === "container" || element.type === "text" || element.type === "image" || element.type === "math"
      ? element.style?.className?.trim()
      : undefined;

  if (customClass) {
    outputClasses.push(customClass);
  }

  const styles: string[] = [];

  let baseStyle = "";
  if (element.type === "text") {
    const resolved = context ? resolveTextStyle(context.presentation, element) : undefined;
    const effectiveStyle = context
      ? { ...element.style, ...resolved?.style }
      : element.style;
    baseStyle = renderCanonicalTextStyle(
      element,
      resolved?.typography ?? element.typography,
      effectiveStyle,
      options.includeTextBorder === false ? { includeBorder: false } : {},
      resolved?.layout,
    );
  } else if (element.type === "image") {
    baseStyle = renderCanonicalImageStyle(element);
  }

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
    ` data-presentation-id="${escapeHtml(element.id)}"` +
    ` data-presentation-type="${escapeHtml(element.type)}"` +
    styleAttribute
  );
}

function renderTextContentSurface(
  content: string,
  gradient: NonNullable<TextElement["style"]>["gradient"],
  glowFilter: string | undefined,
): string {
  const classes = [TEXT_CONTENT_CLASS];
  const styles: string[] = [];
  if (gradient !== undefined) {
    classes.push(TEXT_GRADIENT_CONTENT_CLASS);
    styles.push(`--presentation-text-gradient:${renderGradient(gradient)}`);
  }
  if (glowFilter !== undefined) styles.push(`filter:${glowFilter}`);
  const styleAttribute = styles.length > 0 ? ` style="${escapeHtml(styles.join(";"))}"` : "";
  return `<span class="${classes.join(" ")}"${styleAttribute}>${content}</span>`;
}

function renderText(element: TextElement, context?: RenderContext): string {
  if (element.hidden) {
    return "";
  }

  const resolved = context
    ? resolveTextStyle(context.presentation, element)
    : undefined;
  const effectiveStyle = context
    ? { ...element.style, ...resolved?.style }
    : element.style;
  const gradient = effectiveStyle?.gradient;
  const renderedContent =
    typeof element.content === "string"
      ? renderTextContent(element.content, gradient === undefined ? {} : { gradientFill: true })
      : renderRichText(element.content, gradient === undefined ? {} : { gradientFill: true });
  const linkedContent = renderLinkContent(renderedContent, element.link);
  const glowFilter = renderTextGlowFilter(element.effect?.glow);
  const content = gradient !== undefined || glowFilter !== undefined
    ? renderTextContentSurface(linkedContent, gradient, glowFilter)
    : linkedContent;
  const role = resolved?.role ?? FundamentalTextStyleIdSchema.parse(element.variant);
  const gradientBorder = element.style?.border?.gradient;
  const migratesGradientBorder = gradientBorder !== undefined &&
    (role === "title" || role === "subtitle" || role === "body");
  const gradientStyles = migratesGradientBorder && gradientBorder
    ? [
      "border:0",
      `padding:${renderLength(element.style?.border?.width ?? 0)}`,
      ...renderGradientBorder(gradientBorder, element.style?.border?.width ?? 0),
      ...(element.layout?.position === undefined ? ["position:relative"] : []),
    ].join(";")
    : undefined;
  const textClasses = [
    "presentation-text",
    `presentation-text-${role}`,
    ...(migratesGradientBorder ? ["presentation-gradient-border"] : []),
  ];

  const attributes = buildAttributes(element, textClasses, context, gradientStyles, {
    includeTextBorder: !migratesGradientBorder,
  });

  switch (role) {
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

function renderLinkedImage(element: ImageElement, link: ElementLink, src: string): string {
  const classes = ["presentation-element", "presentation-image"];

  if (hasGradientBorder(element)) {
    classes.push("presentation-gradient-border");
  }

  const customClass = element.style?.className?.trim();

  if (customClass) {
    classes.push(customClass);
  }

  // The anchor owns the presentation element box. The authored-link
  // appearance is emitted first so an explicit element style (color,
  // text-decoration-line) keeps precedence while the browser link look
  // stays suppressed otherwise.
  const styleParts = ["display:inline-block", AUTHORED_LINK_APPEARANCE];

  if (hasGradientBorder(element) && element.layout?.position === undefined) {
    styleParts.push("position:relative");
  }

  const elementStyle = renderCanonicalImageStyle(element);

  if (elementStyle) {
    styleParts.push(elementStyle);
  }

  if (element.crop) {
    styleParts.push(renderImageCropBoxStyle(element));
  }

  const attributes: string[] = [
    `href="${escapeHtml(link.href)}"`,
    'data-presentation-link="true"',
    `class="${escapeHtml(classes.join(" "))}"`,
    `data-presentation-id="${escapeHtml(element.id)}"`,
    `data-presentation-type="image"`,
    ` style="${escapeHtml(styleParts.join(";"))}"`,
  ];

  const cropMetadata = renderCanonicalImageCropMetadata(element);
  if (cropMetadata) attributes.push(cropMetadata);

  if (link.target === "_blank") {
    attributes.push('target="_blank"', 'rel="noopener noreferrer"');
  } else if (link.target === "_self") {
    attributes.push('target="_self"');
  }

  const media = element.crop
    ? renderCroppedImageMedia(element, src)
    : `<img class="presentation-image-media"` +
      ` src="${escapeHtml(src)}"` +
      ` alt="${escapeHtml(element.alt)}"` +
      ` style="${escapeHtml(renderCanonicalImageMediaStyle(element))}">`;

  if (!element.crop) {
    return `<a ${attributes.join(" ")}>${media}</a>`;
  }

  return `<a ${attributes.join(" ")}><div class="presentation-image-crop-viewport">${media}</div></a>`;
}

function renderImage(element: ImageElement, context?: RenderContext): string {
  if (element.hidden) {
    return "";
  }

  const src = resolveCanonicalImageSource(element, context?.presentation);
  if (src === null) {
    return "";
  }

  if (element.link) {
    return renderLinkedImage(element, element.link, src);
  }

  if (element.crop) {
    const gradientClass = hasGradientBorder(element)
      ? "presentation-gradient-border"
      : undefined;
    const attributes = buildAttributes(
      element,
      ["presentation-image", ...(gradientClass ? [gradientClass] : [])],
      undefined,
      renderImageCropBoxStyle(element),
    );
    return (
      `<div ${attributes} ${renderCanonicalImageCropMetadata(element)}>` +
      `<div class="presentation-image-crop-viewport">` +
      renderCroppedImageMedia(element, src) +
      `</div></div>`
    );
  }

  if (hasGradientBorder(element)) {
    const attributes = buildAttributes(
      element,
      ["presentation-image", "presentation-image-gradient-frame", "presentation-gradient-border"],
      undefined,
      element.layout?.position === undefined ? "position:relative" : undefined,
    );

    return (
      `<div ${attributes}>` +
      `<img class="presentation-image-media"` +
      ` src="${escapeHtml(src)}"` +
      ` alt="${escapeHtml(element.alt)}"` +
      ` style="${escapeHtml(renderCanonicalImageMediaStyle(element))}">` +
      `</div>`
    );
  }

  const attributes = buildAttributes(
    element,
    ["presentation-image"],
    undefined,
    `object-fit:${element.fit};object-position:${element.focalPoint?.x ?? 50}% ${element.focalPoint?.y ?? 50}%`,
  );

  return (
    `<img ${attributes}` +
    ` src="${escapeHtml(src)}"` +
    ` alt="${escapeHtml(element.alt)}">`
  );
}

function renderPlaceholder(element: InteractiveElement): string {
  if (element.hidden) {
    return "";
  }

  const classes = [
    "presentation-element",
    "presentation-placeholder",
    `presentation-placeholder-${element.type}`,
  ];
  const layout = element.layout;
  const styles: string[] = [];
  if (layout?.position !== undefined) styles.push(`position:${layout.position}`);
  for (const [property, value] of [["top", layout?.top], ["right", layout?.right], ["bottom", layout?.bottom], ["left", layout?.left]] as const) {
    if (value !== undefined) styles.push(`${property}:${renderLength(value)}`);
  }
  const attributes = `class="${escapeHtml(classes.join(" "))}"` +
    ` data-presentation-id="${escapeHtml(element.id)}"` +
    ` data-presentation-type="${escapeHtml(element.type)}"` +
    (styles.length > 0 ? ` style="${escapeHtml(styles.join(";"))}"` : "");

  return `<div ${attributes}>` + `[${escapeHtml(element.type)}]` + "</div>";
}

function assertNever(value: never): never {
  throw new Error(`Unsupported presentation element: ${String(value)}`);
}

export function renderElement(
  element: PresentationElement,
  context?: RenderContext,
): string {
  switch (element.type) {
    case "math": {
      if (element.hidden) return "";
      const gradient = element.style?.gradient;
      const extra = ["overflow-x:auto", "overflow-y:hidden", "max-width:100%", "box-sizing:border-box"];
      const layout = element.layout;
      for (const [key, value] of [["width", layout?.width], ["height", layout?.height], ["top", layout?.top], ["right", layout?.right], ["bottom", layout?.bottom], ["left", layout?.left], ["margin", layout?.margin], ["margin-top", layout?.marginTop], ["margin-right", layout?.marginRight], ["margin-bottom", layout?.marginBottom], ["margin-left", layout?.marginLeft]] as const) if (value !== undefined) extra.push(`${key}:${renderLength(value)}`);
      const gradientBorder = element.style?.border?.gradient !== undefined ? element.style.border : undefined;
      const borderGradient = gradientBorder?.gradient;
      if (gradientBorder && borderGradient) {
        const borderWidth = renderLength(gradientBorder.width);
        const effectivePadding = (side: "Top" | "Right" | "Bottom" | "Left") => {
          const value = layout?.[`padding${side}`] ?? layout?.padding;
          return value === undefined ? borderWidth : `calc(${renderLength(value)} + ${borderWidth})`;
        };
        for (const side of ["Top", "Right", "Bottom", "Left"] as const) extra.push(`padding-${side.toLowerCase()}:${effectivePadding(side)}`);
        extra.push("border:0", ...renderGradientBorder(borderGradient, gradientBorder.width), ...renderGradientBorderBox(gradientBorder.width));
        if (layout?.position === undefined) extra.push("position:relative");
      } else if (element.style?.border) extra.push(...renderBorder(element.style.border));
      if (!gradientBorder && layout?.padding !== undefined) extra.push(`padding:${renderLength(layout.padding)}`);
      if (!gradientBorder) {
        for (const [key, value] of [["padding-top", layout?.paddingTop], ["padding-right", layout?.paddingRight], ["padding-bottom", layout?.paddingBottom], ["padding-left", layout?.paddingLeft]] as const) if (value !== undefined) extra.push(`${key}:${renderLength(value)}`);
      }
      if (layout?.position) extra.push(`position:${layout.position}`);
      if (element.style?.color) extra.push(`color:${renderColorValue(element.style.color)}`);
      if (element.style?.background?.color) extra.push(`background:${renderColorValue(element.style.background.color)}`);
      if (element.style?.background?.gradient) extra.push(`background-image:${renderGradient(element.style.background.gradient)}`);
      if (element.style?.borderRadius !== undefined) extra.push(`border-radius:${renderLength(element.style.borderRadius)}`);
      if (element.typography?.fontSize !== undefined) extra.push(`font-size:${renderLength(element.typography.fontSize)}`);
      if (element.typography?.fontWeight !== undefined) extra.push(`font-weight:${element.typography.fontWeight}`);
      if (element.typography?.fontStyle !== undefined) extra.push(`font-style:${element.typography.fontStyle}`);
      if (element.typography?.textAlign) extra.push(`text-align:${element.typography.textAlign}`);
      if (element.typography?.lineHeight !== undefined) extra.push(`line-height:${element.typography.lineHeight}`);
      if (element.effect?.opacity !== undefined) extra.push(`opacity:${element.effect.opacity}`);
      const filters: string[] = [];
      if (element.effect?.shadow) extra.push(`text-shadow:${renderTextShadow(element.effect.shadow)}`);
      if (element.effect?.glow) filters.push(`drop-shadow(0 0 ${renderLength(element.effect.glow.blur)} ${renderColorValue(element.effect.glow.color)})`);
      if (filters.length > 0) extra.push(`filter:${filters.join(" ")}`);
      if (gradient) extra.push(`--presentation-text-gradient:${renderGradient(gradient)}`);
      const mathClasses = [
        "presentation-math",
        ...(gradientBorder ? ["presentation-gradient-border"] : []),
        ...(element.typography?.fontWeight !== undefined ? ["presentation-math-weight"] : []),
        ...(element.typography?.fontStyle !== undefined ? ["presentation-math-style"] : []),
        ...(gradient ? [TEXT_GRADIENT_CONTENT_CLASS] : []),
      ];
      const attrs = buildAttributes(element, mathClasses, context, extra.join(";"));
      let body: string;
      try {
        if (element.source.length > 4096) throw new Error("Math source exceeds limit");
        if (/\\(?:href|url|includegraphics|htmlClass|htmlId|htmlStyle|htmlData)\b/.test(element.source)) throw new Error("Untrusted TeX command");
        body = katex.renderToString(element.source, { output: "htmlAndMathml", displayMode: true, throwOnError: true, trust: false, maxExpand: 1000, maxSize: 50 });
        if (/class="[^"]*katex-error/.test(body)) throw new Error("KaTeX returned error markup");
      } catch {
        body = `<span class="presentation-math-error" role="img" aria-label="Mathematical expression unavailable">&#xFFFD;</span>`;
      }
      return `<div ${attrs}>${renderLinkContent(body, element.link)}</div>`;
    }
    case "text":
      return renderText(element, context);

    case "image":
      return renderImage(element, context);

    case "container":
      return renderContainer(
        element,
        (child) => renderElement(child, context),
        context?.presentation,
      );

    case "code":
      return renderCode(element, context?.presentation);

    case "terminal":
      return renderTerminal(element, context?.presentation);

    case "table":
      return renderTable(element, (child) => renderElement(child, context), context?.presentation);

    case "topics":
      return renderTopics(element, (child) => renderElement(child, context), context?.presentation);

    case "divider":
      return renderDivider(element, context?.presentation);

    case "gallery":
      return renderGallery(element, context?.presentation);

    case "embed":
      return renderEmbed(element);

    case "blocks":
      return renderBlocks(element);
    case "scripted": {
      const selectedFiles = element.resourceIds.flatMap((resourceId) => {
        const file = context?.presentation.resources?.files?.find((candidate) => candidate.id === resourceId);
        return file === undefined ? [] : [file];
      });
      return renderScripted(
        element,
        context?.presentation.resources?.fonts,
        selectedFiles,
        context?.scriptedExecutionPolicy,
      );
    }

    case "plot":
      return renderPlot(element);

    case "interactive":
      return renderPlaceholder(element);

    case "shape":
      return renderShape(element, context?.presentation);

    default:
      return assertNever(element);
  }
}
