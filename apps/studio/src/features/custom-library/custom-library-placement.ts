import type { PresentationElement, Slide } from "@web-slideshow/document-schema";

import {
  findElementById,
  updateElementById,
} from "../editor/element-hierarchy";
import {
  insertElementAfterId,
} from "../editor/element-operations";
import {
  materializeCustomLibraryElementRecipe,
  mergeCustomLibraryElementRecipe,
  type CustomLibraryApplyFailureReason,
} from "./custom-library-apply";
import type { CustomLibraryElementRecipe } from "./custom-library-recipe";

export type CustomLibraryPlacementMode =
  | "create-root"
  | "merge-selected"
  | "create-sibling";

export type CustomLibraryPlacementResult =
  | {
      ok: true;
      slide: Slide;
      appliedElementId: string;
      mode: CustomLibraryPlacementMode;
    }
  | {
      ok: false;
      reason: CustomLibraryApplyFailureReason;
  };

export type CustomLibraryElementPlacementResult =
  | {
      ok: true;
      elements: PresentationElement[];
      appliedElementId: string;
      mode: CustomLibraryPlacementMode;
    }
  | {
      ok: false;
      reason: CustomLibraryApplyFailureReason;
    };

function createRoot(
  recipe: CustomLibraryElementRecipe,
  elements: PresentationElement[],
  usedIds: Set<string>,
): CustomLibraryElementPlacementResult {
  const materialized = materializeCustomLibraryElementRecipe(recipe, usedIds);

  if (!materialized.ok) {
    return materialized;
  }

  return {
    ok: true,
    elements: [...elements, materialized.element],
    appliedElementId: materialized.element.id,
    mode: "create-root",
  };
}

export function placeCustomLibraryElementRecipeInElements(
  recipe: CustomLibraryElementRecipe,
  elements: PresentationElement[],
  usedIds: Set<string>,
  selectedElementId: string | null,
): CustomLibraryElementPlacementResult {
  const selected = selectedElementId === null
    ? null
    : findElementById(elements, selectedElementId);

  if (selected === null) {
    return createRoot(recipe, elements, usedIds);
  }

  if (selected.type === recipe.type) {
    const merged = mergeCustomLibraryElementRecipe(recipe, selected, usedIds);

    if (!merged.ok) {
      return merged;
    }

    return {
      ok: true,
      elements: updateElementById(elements, selected.id, () => merged.element),
      appliedElementId: selected.id,
      mode: "merge-selected",
    };
  }

  const materialized = materializeCustomLibraryElementRecipe(recipe, usedIds);

  if (!materialized.ok) {
    return materialized;
  }

  return {
    ok: true,
    elements: insertElementAfterId(elements, selected.id, materialized.element),
    appliedElementId: materialized.element.id,
    mode: "create-sibling",
  };
}

export function placeCustomLibraryElementRecipe(
  recipe: CustomLibraryElementRecipe,
  slide: Slide,
  usedIds: Set<string>,
  selectedElementId: string | null,
): CustomLibraryPlacementResult {
  const result = placeCustomLibraryElementRecipeInElements(
    recipe,
    slide.elements,
    usedIds,
    selectedElementId,
  );
  return result.ok
    ? {
        ok: true,
        slide: { ...slide, elements: result.elements },
        appliedElementId: result.appliedElementId,
        mode: result.mode,
      }
    : result;
}
