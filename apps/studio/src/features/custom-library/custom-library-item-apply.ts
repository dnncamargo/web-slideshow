import type { Presentation } from "@powershow/document-schema";

import type { CustomLibraryItemDraft } from "./custom-library-item";
import { addCustomLibraryFontToPresentation } from "./custom-library-font-apply";
import {
  placeCustomLibraryElementRecipe,
  type CustomLibraryPlacementMode,
} from "./custom-library-placement";
import type { CustomLibraryApplyFailureReason } from "./custom-library-apply";

export type CustomLibraryItemApplyFailureReason =
  | CustomLibraryApplyFailureReason
  | "font-dependency-conflict";

export type CustomLibraryItemApplyResult =
  | {
      ok: true;
      presentation: Presentation;
      appliedElementId: string;
      mode: CustomLibraryPlacementMode;
    }
  | {
      ok: false;
      reason: CustomLibraryItemApplyFailureReason;
    };

export function applyCustomLibraryItemToPresentation(
  item: CustomLibraryItemDraft,
  presentation: Presentation,
  selectedSlideIndex: number,
  selectedElementId: string | null,
): CustomLibraryItemApplyResult {
  if (!presentation.slides[selectedSlideIndex]) {
    return { ok: false, reason: "invalid-recipe-application" };
  }

  let workingPresentation = presentation;
  for (const dependency of item.dependencies?.fonts ?? []) {
    const result = addCustomLibraryFontToPresentation(workingPresentation, dependency);
    if (result.kind === "conflict") {
      return { ok: false, reason: "font-dependency-conflict" };
    }
    workingPresentation = result.presentation;
  }

  const workingSlide = workingPresentation.slides[selectedSlideIndex];
  if (!workingSlide) {
    return { ok: false, reason: "invalid-recipe-application" };
  }

  const placement = placeCustomLibraryElementRecipe(
    item.root,
    workingSlide,
    workingPresentation.slides,
    selectedElementId,
  );
  if (!placement.ok) {
    return placement;
  }

  return {
    ok: true,
    presentation: {
      ...workingPresentation,
      slides: workingPresentation.slides.map((slide, index) =>
        index === selectedSlideIndex ? placement.slide : slide,
      ),
    },
    appliedElementId: placement.appliedElementId,
    mode: placement.mode,
  };
}
