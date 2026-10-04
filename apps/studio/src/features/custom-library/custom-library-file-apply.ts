import {
  PresentationFileResourceSchema,
  PresentationSchema,
  type Presentation,
} from "@web-slideshow/document-schema";

import type { CustomLibraryFileDraft } from "./custom-library-file";

export type CustomLibraryFileApplyResult =
  | {
      kind: "added";
      presentation: Presentation;
      fileResourceId: string;
    }
  | {
      kind: "conflict";
      presentation: Presentation;
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

function createFileResourceId(
  name: string,
  existingIds: readonly string[],
): string {
  const baseName = name
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "file";
  const baseId = `file-${baseName}`;
  const usedIds = new Set(existingIds);

  if (!usedIds.has(baseId)) return baseId;

  let suffix = 2;
  while (usedIds.has(`${baseId}-${suffix}`)) suffix += 1;
  return `${baseId}-${suffix}`;
}

function withoutResources(presentation: Presentation): Presentation {
  const { resources: _resources, ...presentationWithoutResources } = presentation;
  return presentationWithoutResources;
}

export function addCustomLibraryFileToPresentation(
  presentation: Presentation,
  libraryFile: CustomLibraryFileDraft,
  textContent?: string,
): CustomLibraryFileApplyResult {
  if (libraryFile.representation === "text" && textContent === undefined) {
    return { kind: "conflict", presentation };
  }

  const currentFiles = presentation.resources?.files ?? [];
  const currentFonts = presentation.resources?.fonts ?? [];
  const fileResourceId = createFileResourceId(
    libraryFile.name,
    [...currentFonts.map((resource) => resource.id), ...currentFiles.map((resource) => resource.id)],
  );

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

  if (candidate === null) return { kind: "conflict", presentation };

  const parsedResource = PresentationFileResourceSchema.safeParse(candidate);
  if (!parsedResource.success) return { kind: "conflict", presentation };

  const candidatePresentation = {
    ...presentation,
    resources: {
      ...presentation.resources,
      files: [...currentFiles, parsedResource.data],
    },
  };
  const parsedPresentation = PresentationSchema.safeParse(candidatePresentation);
  if (!parsedPresentation.success) return { kind: "conflict", presentation };

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
