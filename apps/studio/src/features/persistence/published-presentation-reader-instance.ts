import { FirestorePublishedPresentationReader } from "./firestore-published-presentation-reader";
import type { PublishedPresentationReader } from "./published-presentation-reader";

const defaultReader = new FirestorePublishedPresentationReader();

export function getDefaultPublishedPresentationReader(): PublishedPresentationReader {
  return defaultReader;
}
