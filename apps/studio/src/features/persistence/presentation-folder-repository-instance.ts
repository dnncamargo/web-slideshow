import { FirestorePresentationFolderRepository } from "./firestore-presentation-folder-repository";
import type { PresentationFolderRepository } from "./presentation-folder-repository";

const defaultFolderRepository = new FirestorePresentationFolderRepository();

export function getDefaultPresentationFolderRepository(): PresentationFolderRepository {
  return defaultFolderRepository;
}
