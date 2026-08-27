import {
  addPresentationPaletteColor,
  type PaletteOperationFailure,
  type Presentation,
  type PresentationPaletteColor,
} from "@powershow/document-schema";

import type { CustomLibraryPaletteDraft } from "./custom-library-palette";

export type CustomLibraryPaletteApplyResult =
  | {
      ok: true;
      presentation: Presentation;
      addedColors: PresentationPaletteColor[];
    }
  | {
      ok: false;
      reason: PaletteOperationFailure["reason"];
    };

export function addCustomLibraryPaletteToPresentation(
  presentation: Presentation,
  palette: CustomLibraryPaletteDraft,
): CustomLibraryPaletteApplyResult {
  let currentPresentation = presentation;
  const addedColors: PresentationPaletteColor[] = [];

  for (const color of palette.colors) {
    const result = addPresentationPaletteColor(
      currentPresentation,
      color.name,
      color.value,
    );

    if (!result.ok) {
      return { ok: false, reason: result.reason };
    }

    currentPresentation = result.presentation;
    addedColors.push(result.color);
  }

  return {
    ok: true,
    presentation: currentPresentation,
    addedColors,
  };
}
