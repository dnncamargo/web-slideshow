import type { ContentSlot, PresentationElement, TopicItem } from "./elements";
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

type LinkedStyleTarget = "container" | "topics" | "code" | "terminal" | "table" | "divider";

function validateLinkedStyleReference(
  presentation: Presentation,
  linkedStyleId: string,
  target: LinkedStyleTarget,
  mode: "simple" | "structured" | undefined,
  path: (string | number)[],
  addIssue: (path: (string | number)[], message: string) => void,
): void {
  const linked = presentation.linkedStyles?.find((style) => style.id === linkedStyleId);
  const compatible = target === "container"
    ? linked !== undefined && !("target" in linked)
    : linked !== undefined && "target" in linked && linked.target === target &&
      (target !== "table" || ("mode" in linked && linked.mode === mode));

  if (linked === undefined) {
    addIssue([...path, "linkedStyleId"], `Linked ${target} style reference does not resolve.`);
  } else if (!compatible) {
    const modeSuffix = mode === undefined ? "" : ` with mode ${mode}`;
    addIssue(
      [...path, "linkedStyleId"],
      `Linked ${target}${modeSuffix} style reference is incompatible with the element.`,
    );
  }
}

function validateElement(
  presentation: Presentation,
  element: PresentationElement,
  path: (string | number)[],
  addIssue: (path: (string | number)[], message: string) => void,
): void {
  if (element.type === "container") {
    if (element.linkedStyleId !== undefined) {
      validateLinkedStyleReference(presentation, element.linkedStyleId, "container", undefined, path, addIssue);
    }
    element.children.forEach((child, index) =>
      validateElement(presentation, child, [...path, "children", index], addIssue),
    );
  } else if (element.type === "table") {
    if (element.linkedStyleId !== undefined) {
      validateLinkedStyleReference(
        presentation,
        element.linkedStyleId,
        "table",
        element.mode === "structured" ? "structured" : "simple",
        path,
        addIssue,
      );
    }
    if (element.mode !== "structured") return;
    element.columns.forEach((column, index) =>
      validateSlot(presentation, column.header, [...path, "columns", index, "header"], addIssue),
    );
    element.rows.forEach((row, rowIndex) =>
      row.cells.forEach((cell, cellIndex) =>
        validateSlot(presentation, cell, [...path, "rows", rowIndex, "cells", cellIndex], addIssue),
      ),
    );
  } else if (element.type === "topics") {
    if (element.linkedStyleId !== undefined) {
      validateLinkedStyleReference(presentation, element.linkedStyleId, "topics", undefined, path, addIssue);
    }
    element.items.forEach((item, index) =>
      validateTopic(presentation, item, [...path, "items", index], addIssue),
    );
  } else if (element.type === "code" || element.type === "terminal" || element.type === "divider") {
    if (element.linkedStyleId !== undefined) {
      validateLinkedStyleReference(presentation, element.linkedStyleId, element.type, undefined, path, addIssue);
    }
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

  presentation.rootDefinitions?.forEach((definition, definitionIndex) => {
    validateElement(
      presentation,
      definition.root,
      ["rootDefinitions", definitionIndex, "root"],
      (path, message) => context.addIssue({ code: "custom", path, message }),
    );
  });

  presentation.slides.forEach((slide, slideIndex) => {
    slide.localRootChildren?.forEach((record, recordIndex) => {
      record.children.forEach((element, elementIndex) => {
        validateElement(
          presentation,
          element,
          ["slides", slideIndex, "localRootChildren", recordIndex, "children", elementIndex],
          (path, message) => context.addIssue({ code: "custom", path, message }),
        );
      });
    });
  });
}
