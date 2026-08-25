import type { PowerShowElement } from "@powershow/document-schema";

import {
  composeCustomLibraryElementRecipe,
  type CustomLibraryElementRecipe,
  type ElementPropertySelectionMap,
} from "./custom-library-recipe";

export interface CustomLibraryItemDraft {
  name: string;
  description?: string;
  root: CustomLibraryElementRecipe;
}

export interface CreateCustomLibraryItemDraftInput {
  name: string;
  description?: string;
  root: PowerShowElement;
  selections: ElementPropertySelectionMap;
}

export function createCustomLibraryItemDraft(
  input: CreateCustomLibraryItemDraftInput,
): CustomLibraryItemDraft {
  const name = input.name.trim();
  if (name.length === 0) {
    throw new Error("Custom Library item name must not be empty");
  }

  const description = input.description?.trim();
  const draft: CustomLibraryItemDraft = {
    name,
    root: composeCustomLibraryElementRecipe(input.root, input.selections),
  };

  if (description) {
    draft.description = description;
  }

  return draft;
}
