import type { z } from "zod";

import type {
  ColorValue,
  PresentationPalette,
} from "./palette";
import {
  isPaletteColorReference,
} from "./palette";
import type {
  ContentSlot,
  PowerShowElement,
  TopicItem,
} from "./elements";
import type {
  Border,
  Gradient,
  Shadow,
  TextStroke,
} from "./visual";
import type {
  ElementEffect,
  ElementTypography,
} from "./element-properties";
import type { Slide, SlideBackground } from "./slide";

type Path = (string | number)[];

export function validatePresentationPaletteReferences(
  presentation: {
    palette?: PresentationPalette | undefined;
    slides: Slide[];
  },
  context: z.RefinementCtx,
): void {
  const colorIds = new Set(
    presentation.palette?.colors.map((color) => color.id) ?? [],
  );

  const visitColor = (value: ColorValue | undefined, path: Path): void => {
    if (
      value !== undefined &&
      isPaletteColorReference(value) &&
      !colorIds.has(value.colorId)
    ) {
      context.addIssue({
        code: "custom",
        path: [...path, "colorId"],
        message: "Palette color reference does not resolve in Presentation.palette.",
      });
    }
  };

  const visitGradient = (gradient: Gradient | undefined, path: Path): void => {
    gradient?.stops.forEach((stop, index) =>
      visitColor(stop.color, [...path, "stops", index, "color"]),
    );
  };

  const visitBorder = (border: Border | undefined, path: Path): void => {
    if (!border) return;
    visitColor(border.color, [...path, "color"]);
    visitGradient(border.gradient, [...path, "gradient"]);
  };

  const visitShadow = (shadow: Shadow | undefined, path: Path): void => {
    if (shadow) visitColor(shadow.color, [...path, "color"]);
  };

  const visitTextStroke = (stroke: TextStroke | undefined, path: Path): void => {
    if (stroke) visitColor(stroke.color, [...path, "color"]);
  };

  const visitTypography = (
    typography: ElementTypography | undefined,
    path: Path,
  ): void => {
    if (!typography) return;
    visitColor(typography.textDecorationColor, [...path, "textDecorationColor"]);
    visitTextStroke(typography.textStroke, [...path, "textStroke"]);
  };

  const visitEffect = (effect: ElementEffect | undefined, path: Path): void => {
    if (effect) visitShadow(effect.shadow, [...path, "shadow"]);
  };

  const visitStyle = (
    style: {
      color?: ColorValue | undefined;
      background?: { color?: ColorValue | undefined; gradient?: Gradient | undefined } | undefined;
      border?: Border | undefined;
    } | undefined,
    path: Path,
  ): void => {
    if (!style) return;
    visitColor(style.color, [...path, "color"]);
    if (style.background) {
      visitColor(style.background.color, [...path, "background", "color"]);
      visitGradient(style.background.gradient, [...path, "background", "gradient"]);
    }
    visitBorder(style.border, [...path, "border"]);
  };

  const visitContentSlot = (slot: ContentSlot, path: Path): void => {
    visitStyle(slot.style, [...path, "style"]);
    visitTypography(slot.typography, [...path, "typography"]);
    slot.children.forEach((child, index) => visitElement(child, [...path, "children", index]));
  };

  const visitTopicItem = (item: TopicItem, path: Path): void => {
    visitContentSlot(item.content, [...path, "content"]);
    item.children.forEach((child, index) => visitTopicItem(child, [...path, "children", index]));
  };

  const visitSlideBackground = (background: SlideBackground | undefined, path: Path): void => {
    if (!background) return;
    visitColor(background.color, [...path, "color"]);
    visitGradient(background.gradient, [...path, "gradient"]);
    if (background.pattern) {
      visitColor(background.pattern.color, [...path, "pattern", "color"]);
      visitColor(background.pattern.backgroundColor, [...path, "pattern", "backgroundColor"]);
    }
  };

  function visitElement(element: PowerShowElement, path: Path): void {
    switch (element.type) {
      case "text":
        visitStyle(element.style, [...path, "style"]);
        visitTypography(element.typography, [...path, "typography"]);
        visitEffect(element.effect, [...path, "effect"]);
        if (typeof element.content !== "string") {
          element.content.runs.forEach((run, index) => {
            if (run.marks) visitColor(run.marks.color, [...path, "content", "runs", index, "marks", "color"]);
          });
        }
        break;
      case "container":
        visitStyle(element.style, [...path, "style"]);
        visitTypography(element.typography, [...path, "typography"]);
        visitEffect(element.effect, [...path, "effect"]);
        element.children.forEach((child, index) => visitElement(child, [...path, "children", index]));
        break;
      case "topics":
        visitStyle(element.style, [...path, "style"]);
        visitTypography(element.typography, [...path, "typography"]);
        visitColor(element.markerColor, [...path, "markerColor"]);
        element.items.forEach((item, index) => visitTopicItem(item, [...path, "items", index]));
        break;
      case "table":
        visitStyle(element.style, [...path, "style"]);
        if (element.mode === "structured") {
          element.columns.forEach((column, index) => visitContentSlot(column.header, [...path, "columns", index, "header"]));
          element.rows.forEach((row, rowIndex) => row.cells.forEach((cell, cellIndex) =>
            visitContentSlot(cell, [...path, "rows", rowIndex, "cells", cellIndex]),
          ));
        }
        break;
      case "blocks":
        visitStyle(element.style, [...path, "style"]);
        element.categories.forEach((category, index) => visitColor(category.color, [...path, "categories", index, "color"]));
        break;
      case "image":
        visitStyle(element.style, [...path, "style"]);
        visitEffect(element.effect, [...path, "effect"]);
        break;
      case "gallery":
      case "embed":
      case "scripted":
        visitStyle(element.style, [...path, "style"]);
        visitEffect(element.effect, [...path, "effect"]);
        break;
      case "code":
      case "terminal":
        visitStyle(element.style, [...path, "style"]);
        visitEffect(element.effect, [...path, "effect"]);
        break;
      case "divider":
        visitStyle(element.style, [...path, "style"]);
        break;
      case "interactive":
      case "chart":
        break;
    }
  }

  presentation.slides.forEach((slide, slideIndex) => {
    visitSlideBackground(slide.background, ["slides", slideIndex, "background"]);
    slide.elements.forEach((element, elementIndex) => visitElement(element, ["slides", slideIndex, "elements", elementIndex]));
  });
}
