import type { PresentationFolder } from "./presentation-folder";

/**
 * Domain-facing private presentation-folder repository abstraction.
 *
 * Folders are flat Studio organization metadata. Callers must not import
 * firebase/firestore directly; Firebase implementation details stay behind
 * this interface.
 */
export interface PresentationFolderRepository {
  listFolders(): Promise<PresentationFolder[]>;
  createFolder(name: string): Promise<string>;
  renameFolder(id: string, name: string): Promise<void>;
}
