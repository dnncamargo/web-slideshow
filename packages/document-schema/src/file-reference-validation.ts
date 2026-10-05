import type { ContentSlot, PresentationElement, TopicItem } from "./elements";
import type { Presentation } from "./presentation";

type AddIssue = (path: (string | number)[], message: string) => void;

function validateBinaryImageFileReference(
  presentation: Presentation,
  fileResourceId: string,
  path: (string | number)[],
  addIssue: AddIssue,
  label: "Image" | "Gallery item",
): void {
  const file = presentation.resources?.files?.find((candidate) => candidate.id === fileResourceId);
  if (file === undefined) {
    addIssue(
      path,
      `${label} file reference does not resolve: ${fileResourceId}`,
    );
  } else if (file.kind !== "image" || file.representation !== "binary") {
    addIssue(
      path,
      `${label} file reference must resolve to a binary image File: ${fileResourceId}`,
    );
  }
}

function validateSlot(
  presentation: Presentation,
  slot: ContentSlot,
  path: (string | number)[],
  addIssue: AddIssue,
): void {
  slot.children.forEach((child, index) =>
    validateElement(presentation, child, [...path, "children", index], addIssue),
  );
}

function validateTopic(
  presentation: Presentation,
  item: TopicItem,
  path: (string | number)[],
  addIssue: AddIssue,
): void {
  validateSlot(presentation, item.content, [...path, "content"], addIssue);
  item.children.forEach((child, index) =>
    validateTopic(presentation, child, [...path, "children", index], addIssue),
  );
}

function validateElement(
  presentation: Presentation,
  element: PresentationElement,
  path: (string | number)[],
  addIssue: AddIssue,
): void {
  if (element.type === "image" && "fileResourceId" in element) {
    validateBinaryImageFileReference(
      presentation,
      element.fileResourceId,
      [...path, "fileResourceId"],
      addIssue,
      "Image",
    );
  }

  if (element.type === "gallery") {
    element.items.forEach((item, index) => {
      if ("fileResourceId" in item) {
        validateBinaryImageFileReference(
          presentation,
          item.fileResourceId,
          [...path, "items", index, "fileResourceId"],
          addIssue,
          "Gallery item",
        );
      }
    });
  }

  if (element.type === "scripted") {
    const files = presentation.resources?.files ?? [];
    element.resourceIds.forEach((resourceId, index) => {
      if (!files.some((file) => file.id === resourceId)) {
        addIssue(
          [...path, "resourceIds", index],
          `Scripted resource reference does not resolve: ${resourceId}`,
        );
      }
    });
  }

  if (element.type === "container") {
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

export function validatePresentationFileReferences(
  presentation: Presentation,
  context: { addIssue: (issue: { code: "custom"; path: (string | number)[]; message: string }) => void },
): void {
  const addIssue: AddIssue = (path, message) => context.addIssue({
    code: "custom",
    path,
    message,
  });

  presentation.slides.forEach((slide, slideIndex) => {
    slide.elements.forEach((element, elementIndex) =>
      validateElement(presentation, element, ["slides", slideIndex, "elements", elementIndex], addIssue),
    );
    slide.localRootChildren?.forEach((record, recordIndex) =>
      record.children.forEach((element, elementIndex) =>
        validateElement(
          presentation,
          element,
          ["slides", slideIndex, "localRootChildren", recordIndex, "children", elementIndex],
          addIssue,
        ),
      ),
    );
  });

  presentation.rootDefinitions?.forEach((definition, definitionIndex) =>
    validateElement(presentation, definition.root, ["rootDefinitions", definitionIndex, "root"], addIssue),
  );
}
