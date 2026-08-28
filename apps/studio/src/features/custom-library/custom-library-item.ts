import type { FontResource, PowerShowElement, PresentationPalette } from "@powershow/document-schema";

import {
  composeCustomLibraryElementRecipe,
  type CustomLibraryElementRecipe,
  type ElementPropertySelectionMap,
} from "./custom-library-recipe";
import {
  snapshotCustomLibraryStyleFontDependencies,
  type CustomLibraryStyleDependencies,
} from "./custom-library-style-dependencies";

export interface CustomLibraryItemDraft {
  name: string;
  description?: string;
  root: CustomLibraryElementRecipe;
  dependencies?: CustomLibraryStyleDependencies;
}

export interface CreateCustomLibraryItemDraftInput {
  name: string;
  description?: string;
  root: PowerShowElement;
  selections: ElementPropertySelectionMap;
  palette?: PresentationPalette;
  fontResources?: readonly FontResource[];
}

export function createCustomLibraryItemDraft(
  input: CreateCustomLibraryItemDraftInput,
): CustomLibraryItemDraft {
  const name = input.name.trim();
  if (name.length === 0) {
    throw new Error("Custom Library item name must not be empty");
  }

  const description = input.description?.trim();
  const root = composeCustomLibraryElementRecipe(input.root, input.selections, input.palette);
  const dependencies = snapshotCustomLibraryStyleFontDependencies(root, input.fontResources);
  const draft: CustomLibraryItemDraft = {
    name,
    root,
  };

  if (description) {
    draft.description = description;
  }
  if (dependencies) {
    draft.dependencies = dependencies;
  }

  return draft;
}
