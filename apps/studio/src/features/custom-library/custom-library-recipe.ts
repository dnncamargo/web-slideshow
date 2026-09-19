import type { PresentationElement, PresentationPalette } from "@web-slideshow/document-schema";

import {
  getDefaultSelectedPropertyPaths,
} from "../editor/element-property-selection";
import {
  extractElementRecipeDraft,
  type ElementRecipeProperty,
} from "../editor/element-recipe";

export type ElementPropertySelectionMap =
  ReadonlyMap<string, ReadonlySet<string>>;

export interface CustomLibraryElementRecipe {
  type: PresentationElement["type"];
  properties: ElementRecipeProperty[];
  children?: CustomLibraryElementRecipe[];
}

function composeRecipeNode(
  element: PresentationElement,
  selections: ElementPropertySelectionMap,
  palette?: PresentationPalette,
): CustomLibraryElementRecipe {
  const selectedPaths = selections.get(element.id)
    ?? getDefaultSelectedPropertyPaths(element);
  const draft = extractElementRecipeDraft(element, selectedPaths, palette);

  if (element.type !== "container" || element.children.length === 0) {
    return {
      type: draft.type,
      properties: draft.properties,
    };
  }

  return {
    type: draft.type,
    properties: draft.properties,
    children: element.children.map((child) => composeRecipeNode(child, selections, palette)),
  };
}

export function composeCustomLibraryElementRecipe(
  root: PresentationElement,
  selections: ElementPropertySelectionMap,
  palette?: PresentationPalette,
): CustomLibraryElementRecipe {
  return composeRecipeNode(root, selections, palette);
}
