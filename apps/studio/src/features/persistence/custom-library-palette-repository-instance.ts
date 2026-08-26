import type { CustomLibraryPaletteRepository } from "../custom-library/custom-library-palette-repository";

import { FirestoreCustomLibraryPaletteRepository } from "./firestore-custom-library-palette-repository";

const defaultCustomLibraryPaletteRepository =
  new FirestoreCustomLibraryPaletteRepository();

export function getDefaultCustomLibraryPaletteRepository(): CustomLibraryPaletteRepository {
  return defaultCustomLibraryPaletteRepository;
}
