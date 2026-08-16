import { FirestorePresentationNotesRepository } from "./firestore-presentation-notes-repository";
import type { PresentationNotesRepository } from "./presentation-notes-repository";

const defaultNotesRepository = new FirestorePresentationNotesRepository();

export function getDefaultPresentationNotesRepository(): PresentationNotesRepository {
  return defaultNotesRepository;
}
