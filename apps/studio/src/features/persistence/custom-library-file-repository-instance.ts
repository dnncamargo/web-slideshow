import type { CustomLibraryFileRepository } from "../custom-library/custom-library-file-repository";

import { FirestoreCustomLibraryFileRepository } from "./firestore-custom-library-file-repository";

const defaultCustomLibraryFileRepository = new FirestoreCustomLibraryFileRepository();

export function getDefaultCustomLibraryFileRepository(): CustomLibraryFileRepository {
  return defaultCustomLibraryFileRepository;
}
