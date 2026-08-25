import type { CustomLibraryRepository } from "../custom-library/custom-library-repository";

import { FirestoreCustomLibraryRepository } from "./firestore-custom-library-repository";

const defaultCustomLibraryRepository = new FirestoreCustomLibraryRepository();

export function getDefaultCustomLibraryRepository(): CustomLibraryRepository {
  return defaultCustomLibraryRepository;
}
