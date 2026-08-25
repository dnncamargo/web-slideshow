import type { PowerShowElement, Slide } from "@powershow/document-schema";

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
  slides: readonly Slide[],
): CustomLibraryPlacementResult {
  const materialized = materializeCustomLibraryElementRecipe(recipe, slides);

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
  slides: readonly Slide[],
  selectedElementId: string | null,
): CustomLibraryPlacementResult {
  const selected = selectedElementId === null
    ? null
    : findElementById(slide.elements, selectedElementId);

  if (selected === null) {
    return createRoot(recipe, slide, slides);
  }

  if (selected.type === recipe.type) {
    const merged = mergeCustomLibraryElementRecipe(recipe, selected, slides);

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

  const materialized = materializeCustomLibraryElementRecipe(recipe, slides);

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
