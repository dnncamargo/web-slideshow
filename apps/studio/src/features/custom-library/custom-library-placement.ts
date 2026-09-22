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

function createRoot(
  recipe: CustomLibraryElementRecipe,
  slide: Slide,
  usedIds: Set<string>,
): CustomLibraryPlacementResult {
  const materialized = materializeCustomLibraryElementRecipe(recipe, usedIds);

  if (!materialized.ok) {
    return materialized;
  }

  return {
    ok: true,
    slide: {
      ...slide,
      elements: [...slide.elements, materialized.element],
    },
    appliedElementId: materialized.element.id,
    mode: "create-root",
  };
}

export function placeCustomLibraryElementRecipe(
  recipe: CustomLibraryElementRecipe,
  slide: Slide,
  usedIds: Set<string>,
  selectedElementId: string | null,
): CustomLibraryPlacementResult {
  const selected = selectedElementId === null
    ? null
    : findElementById(slide.elements, selectedElementId);

  if (selected === null) {
    return createRoot(recipe, slide, usedIds);
  }

  if (selected.type === recipe.type) {
    const merged = mergeCustomLibraryElementRecipe(recipe, selected, usedIds);

    if (!merged.ok) {
      return merged;
    }

    return {
      ok: true,
      slide: {
        ...slide,
        elements: updateElementById(slide.elements, selected.id, () => merged.element),
      },
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
    slide: {
      ...slide,
      elements: insertElementAfterId(slide.elements, selected.id, materialized.element),
    },
    appliedElementId: materialized.element.id,
    mode: "create-sibling",
  };
}
