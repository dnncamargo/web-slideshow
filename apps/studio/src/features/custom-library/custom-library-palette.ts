import type {
  Color,
  PresentationPalette,
} from "@powershow/document-schema";

export interface CustomLibraryPaletteColor {
  name: string;
  value: Color;
}

export interface CustomLibraryPaletteDraft {
  name: string;
  description?: string;
  colors: CustomLibraryPaletteColor[];
}

export interface CreateCustomLibraryPaletteDraftInput {
  name: string;
  description?: string;
  palette: PresentationPalette;
}

export function createCustomLibraryPaletteDraft(
  input: CreateCustomLibraryPaletteDraftInput,
): CustomLibraryPaletteDraft {
  const name = input.name.trim();
  if (name.length === 0) {
    throw new Error("Custom Library palette name must not be empty");
  }

  if (input.palette.colors.length === 0) {
    throw new Error("Custom Library palette must contain at least one color");
  }

  const colors = input.palette.colors.map((color) => {
    const colorName = color.name.trim();
    if (colorName.length === 0) {
      throw new Error("Custom Library palette color name must not be empty");
    }

    return {
      name: colorName,
      value: color.value,
    };
  });

  const draft: CustomLibraryPaletteDraft = { name, colors };
  const description = input.description?.trim();
  if (description) {
    draft.description = description;
  }

  return draft;
}
