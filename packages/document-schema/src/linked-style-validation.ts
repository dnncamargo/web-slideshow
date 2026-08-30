import type { ContentSlot, PowerShowElement, TopicItem } from "./elements";
import type { Presentation } from "./presentation";

function validateSlot(
  presentation: Presentation,
  slot: ContentSlot,
  path: (string | number)[],
  addIssue: (path: (string | number)[], message: string) => void,
): void {
  slot.children.forEach((child, index) =>
    validateElement(presentation, child, [...path, "children", index], addIssue),
  );
}

function validateTopic(
  presentation: Presentation,
  item: TopicItem,
  path: (string | number)[],
  addIssue: (path: (string | number)[], message: string) => void,
): void {
  validateSlot(presentation, item.content, [...path, "content"], addIssue);
  item.children.forEach((child, index) =>
    validateTopic(presentation, child, [...path, "children", index], addIssue),
  );
}

function validateElement(
  presentation: Presentation,
  element: PowerShowElement,
  path: (string | number)[],
  addIssue: (path: (string | number)[], message: string) => void,
): void {
  if (element.type === "container") {
    if (
      element.linkedStyleId !== undefined &&
      !presentation.linkedStyles?.some((style) => style.id === element.linkedStyleId)
    ) {
      addIssue(
        [...path, "linkedStyleId"],
        "Linked container style reference does not resolve.",
      );
    }
    element.children.forEach((child, index) =>
      validateElement(presentation, child, [...path, "children", index], addIssue),
    );
  } else if (element.type === "table" && element.mode === "structured") {
    element.columns.forEach((column, index) =>
      validateSlot(presentation, column.header, [...path, "columns", index, "header"], addIssue),
    );
    element.rows.forEach((row, rowIndex) =>
      row.cells.forEach((cell, cellIndex) =>
        validateSlot(presentation, cell, [...path, "rows", rowIndex, "cells", cellIndex], addIssue),
      ),
    );
  } else if (element.type === "topics") {
    element.items.forEach((item, index) =>
      validateTopic(presentation, item, [...path, "items", index], addIssue),
    );
  }
}

export function validatePresentationLinkedStyleReferences(
  presentation: Presentation,
  context: { addIssue: (issue: { code: "custom"; path: (string | number)[]; message: string }) => void },
): void {
  presentation.slides.forEach((slide, slideIndex) => {
    slide.elements.forEach((element, elementIndex) => {
      validateElement(
        presentation,
        element,
        ["slides", slideIndex, "elements", elementIndex],
        (path, message) => context.addIssue({ code: "custom", path, message }),
      );
    });
  });
}
