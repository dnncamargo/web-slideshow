import type { Presentation } from "@powershow/document-schema";

import type { PresentationSummary } from "./presentation-persistence";

export interface PresentationPublishResult {
  publicationId: string;
  versionId: string;
  publishedRevision: number;
  createdVersion: boolean;
}

export interface ListPresentationsOptions {
  includeArchived?: boolean;
}

export interface CreatePresentationOptions {
  folderId?: string | null;
}

/**
 * Domain-facing Presentation repository abstraction.
 *
 * Callers must not import firebase/firestore directly; Firebase implementation
 * details stay behind this interface.
 */
export interface PresentationRepository {
  listPresentations(
    options?: ListPresentationsOptions,
  ): Promise<PresentationSummary[]>;
  getPresentation(id: string): Promise<Presentation | null>;
  createPresentation(
    presentation: Presentation,
    options?: CreatePresentationOptions,
  ): Promise<void>;
  savePresentation(presentation: Presentation): Promise<void>;
  archivePresentation(id: string): Promise<void>;
  restorePresentation(id: string): Promise<void>;
  movePresentationToFolder(id: string, folderId: string | null): Promise<void>;
  publishPresentation(id: string): Promise<PresentationPublishResult>;
}
