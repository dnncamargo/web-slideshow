import type {
  Border,
  GradientSurfaceBackground,
  Gradient,
  Shadow,
} from "@powershow/document-schema";

import {
  renderLength,
} from "./render-length";
import { renderColorValue } from "./render-palette";

export function renderGradient(
  gradient: Gradient,
): string {
  const stops = gradient.stops
    .map(
      (stop) =>
        `${renderColorValue(stop.color)} ${stop.position}%`,
    )
    .join(",");

  switch (gradient.type) {
    case "linear": {
      const angle =
        gradient.angle ?? 180;

      return (
        `linear-gradient(` +
        `${angle}deg,${stops}` +
        `)`
      );
    }

    case "radial": {
      const shape =
        gradient.shape ?? "ellipse";

      return (
        `radial-gradient(` +
        `${shape},${stops}` +
        `)`
      );
    }
  }
}

export function renderGradientBorder(
  gradient: Gradient,
  width: Border["width"],
): string[] {
  return [
    `--presentation-gradient-border-width:${renderLength(width)}`,
    `--presentation-gradient-border-paint:${renderGradient(gradient)}`,
  ];
}

export function renderGradientBorderBox(
  width: Border["width"],
): string[] {
  return [
    `border-width:${renderLength(width)}`,
    "border-style:solid",
    "border-color:transparent",
  ];
}

export function renderBackground(
  background: GradientSurfaceBackground,
): string[] {
  const styles: string[] = [];

  if (background.color !== undefined) {
    styles.push(`background:${renderColorValue(background.color)}`);
  }

  if (background.gradient !== undefined) {
    styles.push(`background-image:${renderGradient(background.gradient)}`);
  }

  return styles;
}

export function renderShadow(
  shadow: Shadow,
): string {
  const values: string[] = [];

  if (shadow.inset) {
    values.push("inset");
  }

  values.push(
    renderLength(shadow.x),
    renderLength(shadow.y),
    renderLength(shadow.blur),
  );

  if (
    shadow.spread !== undefined
  ) {
    values.push(
      renderLength(shadow.spread),
    );
  }

  values.push(renderColorValue(shadow.color));

  return values.join(" ");
}

export function renderBorder(
  border: Border,
): string[] {
  const styles: string[] = [];

  const width =
    renderLength(border.width);

  const style =
    border.style ?? "solid";

  styles.push(
    `border-width:${width}`,
  );

  styles.push(
    `border-style:${style}`,
  );

  if (border.color) {
    styles.push(
      `border-color:${renderColorValue(border.color)}`,
    );

    return styles;
  }

  if (border.gradient) {
    styles.push(
      "border-color:transparent",
    );

    styles.push(
      `border-image:${renderGradient(
        border.gradient,
      )} 1`,
    );
  }

  return styles;
}
