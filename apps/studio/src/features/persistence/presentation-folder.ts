/**
 * Private Studio presentation-folder domain.
 *
 * Folders are FLAT Studio organization metadata. They live in a private
 * per-user collection and carry no relation to the canonical Presentation
 * document. The stable folderId is authoritative; the display name is not an
 * identity.
 */
export interface PresentationFolder {
  id: string;
  name: string;
  createdAt: unknown;
  updatedAt: unknown;
}

export const MAX_FOLDER_NAME_LENGTH = 80;

export function normalizeFolderName(raw: string): string {
  return raw.trim();
}

export function isValidFolderName(raw: string): boolean {
  const name = normalizeFolderName(raw);

  return name.length > 0 && name.length <= MAX_FOLDER_NAME_LENGTH;
}
