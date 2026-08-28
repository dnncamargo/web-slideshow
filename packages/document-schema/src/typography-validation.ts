import type { ContentSlot, PowerShowElement, TopicItem } from "./elements";
import type { Presentation } from "./presentation";
import {
  FundamentalTypographyStyleIdSchema,
  hasLocalTypographyStyleProperties,
} from "./typography";

function validateText(
  presentation: Presentation,
  element: Extract<PowerShowElement, { type: "text" }>,
  path: (string | number)[],
  addIssue: (path: (string | number)[], message: string) => void,
): void {
  if (FundamentalTypographyStyleIdSchema.safeParse(element.variant).success) {
    return;
  }

  const style = presentation.typographyStyles?.find(
    (candidate) => candidate.id === element.variant,
  );
  if (!style || FundamentalTypographyStyleIdSchema.safeParse(style.id).success) {
    addIssue([...path, "variant"], "Custom typography style variant does not resolve.");
  }
  if (hasLocalTypographyStyleProperties(element.typography)) {
    addIssue(
      [...path, "typography"],
      "Custom typography style variants cannot have local V1 typography properties.",
    );
  }
}

function validateSlot(
  presentation: Presentation,
  slot: ContentSlot,
  path: (string | number)[],
  addIssue: (path: (string | number)[], message: string) => void,
): void {
  slot.children.forEach((child, index) => validateElement(presentation, child, [...path, "children", index], addIssue));
}

function validateTopic(
  presentation: Presentation,
  item: TopicItem,
  path: (string | number)[],
  addIssue: (path: (string | number)[], message: string) => void,
): void {
  validateSlot(presentation, item.content, [...path, "content"], addIssue);
  item.children.forEach((child, index) => validateTopic(presentation, child, [...path, "children", index], addIssue));
}

function validateElement(
  presentation: Presentation,
  element: PowerShowElement,
  path: (string | number)[],
  addIssue: (path: (string | number)[], message: string) => void,
): void {
  if (element.type === "text") {
    validateText(presentation, element, path, addIssue);
  } else if (element.type === "container") {
    element.children.forEach((child, index) => validateElement(presentation, child, [...path, "children", index], addIssue));
  } else if (element.type === "table" && element.mode === "structured") {
    element.columns.forEach((column, index) => validateSlot(presentation, column.header, [...path, "columns", index, "header"], addIssue));
    element.rows.forEach((row, rowIndex) => row.cells.forEach((cell, cellIndex) => validateSlot(presentation, cell, [...path, "rows", rowIndex, "cells", cellIndex], addIssue)));
  } else if (element.type === "topics") {
    element.items.forEach((item, index) => validateTopic(presentation, item, [...path, "items", index], addIssue));
  }
}

export function validatePresentationTypographyReferences(
  presentation: Presentation,
  context: { addIssue: (issue: { code: "custom"; path: (string | number)[]; message: string }) => void },
): void {
  presentation.slides.forEach((slide, slideIndex) => {
    slide.elements.forEach((element, elementIndex) => {
      validateElement(presentation, element, ["slides", slideIndex, "elements", elementIndex], (path, message) => {
        context.addIssue({ code: "custom", path, message });
      });
    });
  });
}
