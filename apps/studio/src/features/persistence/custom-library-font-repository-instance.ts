import type { CustomLibraryFontRepository } from "../custom-library/custom-library-font-repository";

import { FirestoreCustomLibraryFontRepository } from "./firestore-custom-library-font-repository";

const defaultCustomLibraryFontRepository = new FirestoreCustomLibraryFontRepository();

export function getDefaultCustomLibraryFontRepository(): CustomLibraryFontRepository {
  return defaultCustomLibraryFontRepository;
}
