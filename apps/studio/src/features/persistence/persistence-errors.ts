import type { FirebaseError } from "firebase/app";
export { PresentationTooLargeError } from "@powershow/firebase";

/**
 * Persistence-layer error model.
 *
 * These are the public error categories the Studio can rely on. Raw Firebase
 * exceptions are translated into these by the repository so callers do not
 * depend on the Firebase SDK.
 */

export abstract class PersistenceError extends Error {
  readonly cause?: unknown;

  constructor(message: string, cause?: unknown) {
    super(message);
    this.name = new.target.name;
    this.cause = cause;
  }
}

export class FirebaseConfigurationError extends PersistenceError {}

export class FirebaseAuthenticationError extends PersistenceError {
  constructor(message: string, cause?: unknown) {
    super(message, cause);
    this.name = "FirebaseAuthenticationError";
  }
}

export class FirestoreOperationError extends PersistenceError {
  constructor(message: string, cause?: unknown) {
    super(message, cause);
    this.name = "FirestoreOperationError";
  }
}

export class InvalidPersistedPresentationError extends PersistenceError {}

export class PresentationRecoveryFailedError extends PersistenceError {
  constructor(message: string, cause?: unknown) {
    super(message, cause);
    this.name = "PresentationRecoveryFailedError";
  }
}

export class InvalidPresentationForPersistenceError extends PersistenceError {}

export class InvalidCustomLibraryItemForPersistenceError extends PersistenceError {}

export class InvalidPersistedCustomLibraryItemError extends PersistenceError {}

export class InvalidCustomLibraryPaletteForPersistenceError extends PersistenceError {}

export class InvalidPersistedCustomLibraryPaletteError extends PersistenceError {}

export class InvalidCustomLibraryFontForPersistenceError extends PersistenceError {}

export class InvalidPersistedCustomLibraryFontError extends PersistenceError {}

export class InvalidFolderNameError extends PersistenceError {
  constructor(message: string) {
    super(message);
    this.name = "InvalidFolderNameError";
  }
}

export function isFirebaseError(error: unknown): error is FirebaseError {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    "message" in error
  );
}
