import type {
  ContainerElement,
  PowerShowElement,
} from "@powershow/document-schema";

import { escapeHtml } from "./escape-html";
import {
  renderLength,
  renderStyle,
} from "./render-style";

type RenderChild = (
  element: PowerShowElement,
) => string;

type Alignment =
  | "start"
  | "center"
  | "end"
  | "stretch";

function renderMainAxisAlignment(
  value: Alignment,
): string {
  switch (value) {
    case "start":
      return "flex-start";

    case "center":
      return "center";

    case "end":
      return "flex-end";

    case "stretch":
      // Flexbox não estica itens no eixo principal.
      return "flex-start";
  }
}

function renderCrossAxisAlignment(
  value: Alignment,
): string {
  switch (value) {
    case "start":
      return "flex-start";

    case "center":
      return "center";

    case "end":
      return "flex-end";

    case "stretch":
      return "stretch";
  }
}

function getTagName(
  role: ContainerElement["role"],
): "div" | "main" | "header" | "footer" {
  switch (role) {
    case "main":
      return "main";

    case "header":
      return "header";

    case "footer":
      return "footer";

    default:
      return "div";
  }
}

export function renderContainer(
  element: ContainerElement,
  renderChild: RenderChild,
): string {
  if (element.hidden) {
    return "";
  }

  const styles: string[] = [];

  const baseStyle = renderStyle(
    element.style,
  );

  if (baseStyle) {
    styles.push(baseStyle);
  }

  styles.push("display:flex");
  styles.push(
    `flex-direction:${element.direction}`,
  );

  if (element.gap !== undefined) {
    styles.push(
      `gap:${renderLength(element.gap)}`,
    );
  }

  if (element.width !== undefined) {
    styles.push(
      `width:${renderLength(element.width)}`,
    );
  }

  const horizontalAlign =
    element.horizontalAlign ??
    element.style?.horizontalAlign;

  const verticalAlign =
    element.verticalAlign ??
    element.style?.verticalAlign;

  if (element.direction === "row") {
    if (horizontalAlign) {
      styles.push(
        `justify-content:${renderMainAxisAlignment(
          horizontalAlign,
        )}`,
      );
    }

    if (verticalAlign) {
      styles.push(
        `align-items:${renderCrossAxisAlignment(
          verticalAlign,
        )}`,
      );
    }
  } else {
    if (horizontalAlign) {
      styles.push(
        `align-items:${renderCrossAxisAlignment(
          horizontalAlign,
        )}`,
      );
    }

    if (verticalAlign) {
      styles.push(
        `justify-content:${renderMainAxisAlignment(
          verticalAlign,
        )}`,
      );
    }
  }

  const classes = [
    "powershow-element",
    "powershow-container",
  ];

  if (element.role) {
    classes.push(
      `powershow-container-${element.role}`,
    );
  }

  const customClass =
    element.style?.className?.trim();

  if (customClass) {
    classes.push(customClass);
  }

  const tag = getTagName(element.role);

  const children = element.children
    .map(renderChild)
    .join("");

  const roleAttribute = element.role
    ? ` data-powershow-role="${escapeHtml(
        element.role,
      )}"`
    : "";

  return (
    `<${tag}` +
    ` class="${escapeHtml(
      classes.join(" "),
    )}"` +
    ` data-powershow-id="${escapeHtml(
      element.id,
    )}"` +
    ` data-powershow-type="container"` +
    roleAttribute +
    ` style="${escapeHtml(
      styles.join(";"),
    )}"` +
    `>` +
    children +
    `</${tag}>`
  );
}