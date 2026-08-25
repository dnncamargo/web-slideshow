import type { PowerShowElement } from "@powershow/document-schema";

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
  type: PowerShowElement["type"];
  properties: ElementRecipeProperty[];
  children?: CustomLibraryElementRecipe[];
}

function composeRecipeNode(
  element: PowerShowElement,
  selections: ElementPropertySelectionMap,
): CustomLibraryElementRecipe {
  const selectedPaths = selections.get(element.id)
    ?? getDefaultSelectedPropertyPaths(element);
  const draft = extractElementRecipeDraft(element, selectedPaths);

  if (element.type !== "container" || element.children.length === 0) {
    return {
      type: draft.type,
      properties: draft.properties,
    };
  }

  return {
    type: draft.type,
    properties: draft.properties,
    children: element.children.map((child) => composeRecipeNode(child, selections)),
  };
}

export function composeCustomLibraryElementRecipe(
  root: PowerShowElement,
  selections: ElementPropertySelectionMap,
): CustomLibraryElementRecipe {
  return composeRecipeNode(root, selections);
}
