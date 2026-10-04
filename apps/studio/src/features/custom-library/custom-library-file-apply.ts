import {
  PresentationFileResourceSchema,
  PresentationSchema,
  type Presentation,
} from "@web-slideshow/document-schema";

import type { CustomLibraryFileRecord } from "./custom-library-file";

export type CustomLibraryFileApplyResult =
  | {
      kind: "added";
      presentation: Presentation;
      fileResourceId: string;
    }
  | {
      kind: "unchanged";
      presentation: Presentation;
      fileResourceId: string;
    }
  | {
      kind: "conflict";
      presentation: Presentation;
      fileResourceId: string;
    };

export type CustomLibraryFileRemoveResult =
  | {
      kind: "removed";
      presentation: Presentation;
    }
  | {
      kind: "not-found";
      presentation: Presentation;
    };

export function getCustomLibraryFileResourceId(libraryRecordId: string): string {
  return `file-${libraryRecordId}`;
}

function withoutResources(presentation: Presentation): Presentation {
  const { resources: _resources, ...presentationWithoutResources } = presentation;
  return presentationWithoutResources;
}

export function addCustomLibraryFileToPresentation(
  presentation: Presentation,
  libraryRecord: CustomLibraryFileRecord,
  textContent?: string,
): CustomLibraryFileApplyResult {
  const libraryFile = libraryRecord.file;
  const fileResourceId = getCustomLibraryFileResourceId(libraryRecord.id);
  const currentFiles = presentation.resources?.files ?? [];
  const currentFonts = presentation.resources?.fonts ?? [];

  if (currentFiles.some((resource) => resource.id === fileResourceId)) {
    return { kind: "unchanged", presentation, fileResourceId };
  }
  if (currentFonts.some((resource) => resource.id === fileResourceId)) {
    return { kind: "conflict", presentation, fileResourceId };
  }
  if (libraryFile.representation === "text" && textContent === undefined) {
    return { kind: "conflict", presentation, fileResourceId };
  }

  const candidate = libraryFile.representation === "binary"
    ? {
        id: fileResourceId,
        name: libraryFile.name,
        kind: libraryFile.kind,
        representation: "binary",
        contentType: libraryFile.source.contentType,
        source: {
          type: "url",
          url: libraryFile.source.downloadUrl,
        },
      }
    : (() => {
        if (textContent === undefined) {
          return null;
        }
        return {
          id: fileResourceId,
          name: libraryFile.name,
          kind: libraryFile.kind,
          representation: "text" as const,
          contentType: libraryFile.source.contentType,
          source: {
            type: "text" as const,
            content: textContent,
          },
        };
      })();

  if (candidate === null) return { kind: "conflict", presentation, fileResourceId };

  const parsedResource = PresentationFileResourceSchema.safeParse(candidate);
  if (!parsedResource.success) return { kind: "conflict", presentation, fileResourceId };

  const candidatePresentation = {
    ...presentation,
    resources: {
      ...presentation.resources,
      files: [...currentFiles, parsedResource.data],
    },
  };
  const parsedPresentation = PresentationSchema.safeParse(candidatePresentation);
  if (!parsedPresentation.success) return { kind: "conflict", presentation, fileResourceId };

  return {
    kind: "added",
    presentation: parsedPresentation.data,
    fileResourceId,
  };
}

export function removeCustomLibraryFileFromPresentation(
  presentation: Presentation,
  fileResourceId: string,
): CustomLibraryFileRemoveResult {
  const resources = presentation.resources;
  if (resources === undefined || resources.files === undefined) {
    return { kind: "not-found", presentation };
  }
  const files = resources.files;
  if (!files.some((file) => file.id === fileResourceId)) {
    return { kind: "not-found", presentation };
  }

  const remainingFiles = files.filter((file) => file.id !== fileResourceId);
  if (remainingFiles.length > 0) {
    return {
      kind: "removed",
      presentation: {
        ...presentation,
        resources: {
          ...resources,
          files: remainingFiles,
        },
      },
    };
  }

  if (resources.fonts !== undefined) {
    return {
      kind: "removed",
      presentation: {
        ...presentation,
        resources: { fonts: resources.fonts },
      },
    };
  }

  return { kind: "removed", presentation: withoutResources(presentation) };
}
