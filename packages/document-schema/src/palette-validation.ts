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
import type { Presentation } from "./presentation";
import type { TextStyle } from "./text-style";
import type { LinkedContainerStyle } from "./linked-style";

export type PaletteColorPath = (string | number)[];

export type PresentationColorValueVisitor = (
  value: ColorValue,
  path: PaletteColorPath,
) => ColorValue;

type ColorSlot = {
  value: ColorValue | undefined;
  set: (value: ColorValue) => void;
};

export function visitPresentationColorValues(
  presentation: {
    slides: Slide[];
    textStyles?: TextStyle[] | undefined;
    linkedStyles?: LinkedContainerStyle[] | undefined;
  },
  visitor: PresentationColorValueVisitor,
): void {
  const visitColor = (slot: ColorSlot, path: PaletteColorPath): void => {
    if (slot.value !== undefined) {
      slot.set(visitor(slot.value, path));
    }
  };

  const visitGradient = (gradient: Gradient | undefined, path: PaletteColorPath): void => {
    gradient?.stops.forEach((stop, index) => visitColor({
      value: stop.color,
      set: (value) => { stop.color = value; },
    }, [...path, "stops", index, "color"]));
  };

  const visitBorder = (border: Border | undefined, path: PaletteColorPath): void => {
    if (!border) return;
    visitColor({ value: border.color, set: (value) => { border.color = value; } }, [...path, "color"]);
    visitGradient(border.gradient, [...path, "gradient"]);
  };

  const visitShadow = (shadow: Shadow | undefined, path: PaletteColorPath): void => {
    if (shadow) visitColor({ value: shadow.color, set: (value) => { shadow.color = value; } }, [...path, "color"]);
  };

  const visitTextStroke = (stroke: TextStroke | undefined, path: PaletteColorPath): void => {
    if (stroke) visitColor({ value: stroke.color, set: (value) => { stroke.color = value; } }, [...path, "color"]);
  };

  const visitTypography = (typography: ElementTypography | undefined, path: PaletteColorPath): void => {
    if (!typography) return;
    visitColor({ value: typography.textDecorationColor, set: (value) => { typography.textDecorationColor = value; } }, [...path, "textDecorationColor"]);
    visitTextStroke(typography.textStroke, [...path, "textStroke"]);
  };

  const visitEffect = (effect: ElementEffect | undefined, path: PaletteColorPath): void => {
    if (effect) visitShadow(effect.shadow, [...path, "shadow"]);
  };

  const visitStyle = (style: {
    color?: ColorValue | undefined;
    background?: { color?: ColorValue | undefined; gradient?: Gradient | undefined } | undefined;
    border?: Border | undefined;
  } | undefined, path: PaletteColorPath): void => {
    if (!style) return;
    visitColor({ value: style.color, set: (value) => { style.color = value; } }, [...path, "color"]);
    if (style.background) {
      visitColor({ value: style.background.color, set: (value) => { style.background!.color = value; } }, [...path, "background", "color"]);
      visitGradient(style.background.gradient, [...path, "background", "gradient"]);
    }
    visitBorder(style.border, [...path, "border"]);
  };

  const visitContentSlot = (slot: ContentSlot, path: PaletteColorPath): void => {
    visitStyle(slot.style, [...path, "style"]);
    visitTypography(slot.typography, [...path, "typography"]);
    slot.children.forEach((child, index) => visitElement(child, [...path, "children", index]));
  };

  const visitTopicItem = (item: TopicItem, path: PaletteColorPath): void => {
    visitContentSlot(item.content, [...path, "content"]);
    item.children.forEach((child, index) => visitTopicItem(child, [...path, "children", index]));
  };

  const visitSlideBackground = (background: SlideBackground | undefined, path: PaletteColorPath): void => {
    if (!background) return;
    visitColor({ value: background.color, set: (value) => { background.color = value; } }, [...path, "color"]);
    visitGradient(background.gradient, [...path, "gradient"]);
    if (background.pattern) {
      visitColor({ value: background.pattern.color, set: (value) => { background.pattern!.color = value; } }, [...path, "pattern", "color"]);
      visitColor({ value: background.pattern.backgroundColor, set: (value) => { background.pattern!.backgroundColor = value; } }, [...path, "pattern", "backgroundColor"]);
    }
  };

  function visitElement(element: PowerShowElement, path: PaletteColorPath): void {
    switch (element.type) {
      case "text":
        visitStyle(element.style, [...path, "style"]);
        visitTypography(element.typography, [...path, "typography"]);
        visitEffect(element.effect, [...path, "effect"]);
        if (typeof element.content !== "string") {
          element.content.runs.forEach((run, index) => {
            if (run.marks) visitColor({ value: run.marks.color, set: (value) => { run.marks!.color = value; } }, [...path, "content", "runs", index, "marks", "color"]);
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
        visitColor({ value: element.markerColor, set: (value) => { element.markerColor = value; } }, [...path, "markerColor"]);
        element.items.forEach((item, index) => visitTopicItem(item, [...path, "items", index]));
        break;
      case "table":
        visitStyle(element.style, [...path, "style"]);
        visitEffect(element.effect, [...path, "effect"]);
        if (element.mode === "structured") {
          element.columns.forEach((column, index) => visitContentSlot(column.header, [...path, "columns", index, "header"]));
          element.rows.forEach((row, rowIndex) => row.cells.forEach((cell, cellIndex) => visitContentSlot(cell, [...path, "rows", rowIndex, "cells", cellIndex])));
        }
        break;
      case "blocks":
        visitStyle(element.style, [...path, "style"]);
        visitEffect(element.effect, [...path, "effect"]);
        if (element.style) {
          const style = element.style;
          visitColor({ value: style.statementColor, set: (value) => { const currentStyle = element.style; if (currentStyle) element.style = { ...currentStyle, statementColor: value }; } }, [...path, "style", "statementColor"]);
          visitColor({ value: style.scopeColor, set: (value) => { const currentStyle = element.style; if (currentStyle) element.style = { ...currentStyle, scopeColor: value }; } }, [...path, "style", "scopeColor"]);
          visitColor({ value: style.logicColor, set: (value) => { const currentStyle = element.style; if (currentStyle) element.style = { ...currentStyle, logicColor: value }; } }, [...path, "style", "logicColor"]);
          for (const category of ["events", "output", "control", "input", "math", "variables"] as const) {
            visitColor({ value: style.categoryColors?.[category], set: (value) => {
              const currentStyle = element.style;
              if (currentStyle) element.style = { ...currentStyle, categoryColors: { ...currentStyle.categoryColors, [category]: value } };
            } }, [...path, "style", "categoryColors", category]);
          }
          visitColor({ value: style.textColor, set: (value) => { const currentStyle = element.style; if (currentStyle) element.style = { ...currentStyle, textColor: value }; } }, [...path, "style", "textColor"]);
          visitBorder(style.blockBorder, [...path, "style", "blockBorder"]);
        }
        break;
      case "image": case "gallery": case "embed": case "scripted": case "code": case "terminal":
        visitStyle(element.style, [...path, "style"]);
        visitEffect(element.effect, [...path, "effect"]);
        break;
      case "divider":
        visitStyle(element.style, [...path, "style"]);
        break;
      case "interactive": case "chart":
        break;
    }
  }

  presentation.slides.forEach((slide, slideIndex) => {
    visitSlideBackground(slide.background, ["slides", slideIndex, "background"]);
    slide.elements.forEach((element, elementIndex) => visitElement(element, ["slides", slideIndex, "elements", elementIndex]));
  });

  presentation.textStyles?.forEach((textStyle, index) => {
    visitStyle(textStyle.style, ["textStyles", index, "style"]);
    visitTypography(textStyle.typography, ["textStyles", index, "typography"]);
  });

  presentation.linkedStyles?.forEach((linkedStyle, index) => {
    visitStyle(linkedStyle.style, ["linkedStyles", index, "style"]);
    visitTypography(linkedStyle.typography, ["linkedStyles", index, "typography"]);
    visitEffect(linkedStyle.effect, ["linkedStyles", index, "effect"]);
  });
}

export function mapPresentationColorValues(
  presentation: Presentation,
  visitor: PresentationColorValueVisitor,
): Presentation {
  const mapped = structuredClone(presentation);
  visitPresentationColorValues(mapped, visitor);
  return mapped;
}

export function mapPowerShowElementColorValues(
  element: PowerShowElement,
  visitor: PresentationColorValueVisitor,
): PowerShowElement {
  const mapped = structuredClone(element);
  visitPresentationColorValues({
    slides: [{ id: "palette-map", elements: [mapped] } as Slide],
  }, visitor);
  return mapped;
}

export function validatePresentationPaletteReferences(
  presentation: {
    palette?: PresentationPalette | undefined;
    slides: Slide[];
    textStyles?: TextStyle[] | undefined;
    linkedStyles?: LinkedContainerStyle[] | undefined;
  },
  context: z.RefinementCtx,
): void {
  const colorIds = new Set(
    presentation.palette?.colors.map((color) => color.id) ?? [],
  );

  visitPresentationColorValues(presentation, (value, path) => {
    if (
      isPaletteColorReference(value) &&
      !colorIds.has(value.colorId)
    ) {
      context.addIssue({
        code: "custom",
        path: [...path, "colorId"],
        message: "Palette color reference does not resolve in Presentation.palette.",
      });
    }
    return value;
  });
}
