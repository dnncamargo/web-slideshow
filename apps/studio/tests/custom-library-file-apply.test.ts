import { describe, expect, it } from "vitest";

import {
  PresentationSchema,
  type Presentation,
} from "@web-slideshow/document-schema";

import {
  addCustomLibraryFileToPresentation,
  removeCustomLibraryFileFromPresentation,
} from "../src/features/custom-library/custom-library-file-apply";
import type { CustomLibraryFileDraft } from "../src/features/custom-library/custom-library-file";

const librarySource = {
  assetId: "123e4567-e89b-12d3-a456-426614174000",
  storagePath: "users/user-1/assets/123e4567-e89b-12d3-a456-426614174000",
  downloadUrl: "https://blob.example.com/workshop.png",
  contentType: "image/png" as const,
  sizeBytes: 42,
};

function presentation(overrides: Partial<Presentation> = {}): Presentation {
  return PresentationSchema.parse({
    schemaVersion: 1,
    id: "presentation",
    title: "Test",
    palette: { colors: [{ id: "accent", name: "Accent", value: "#fff" }] },
    slides: [{ id: "slide", title: "Slide", elements: [] }],
    ...overrides,
  });
}

function file(overrides: Partial<CustomLibraryFileDraft> = {}): CustomLibraryFileDraft {
  return {
    name: "Workshop image",
    kind: "image",
    representation: "binary",
    source: librarySource,
    ...overrides,
  };
}

describe("addCustomLibraryFileToPresentation", () => {
  it("materializes a binary file with a new local identity and only runtime data", () => {
    const result = addCustomLibraryFileToPresentation(presentation(), file());

    expect(result.kind).toBe("added");
    if (result.kind !== "added") return;
    expect(result.presentation.resources?.files).toEqual([{
      id: result.fileResourceId,
      name: "Workshop image",
      kind: "image",
      representation: "binary",
      contentType: "image/png",
      source: { type: "url", url: librarySource.downloadUrl },
    }]);
    expect(result.fileResourceId).not.toBe(librarySource.assetId);
    expect(JSON.stringify(result.presentation)).not.toContain(librarySource.assetId);
    expect(JSON.stringify(result.presentation)).not.toContain(librarySource.storagePath);
    expect(PresentationSchema.safeParse(result.presentation).success).toBe(true);
  });

  it("requires text content and stores it instead of the Blob URL", () => {
    const textFile = file({
      name: "Workshop notes",
      kind: "text",
      representation: "text",
      source: { ...librarySource, contentType: "text/plain" },
    });
    const missing = addCustomLibraryFileToPresentation(presentation(), textFile);
    expect(missing.kind).toBe("conflict");

    const result = addCustomLibraryFileToPresentation(presentation(), textFile, "hello");
    expect(result.kind).toBe("added");
    if (result.kind !== "added") return;
    expect(result.presentation.resources?.files?.[0]?.source).toEqual({
      type: "text",
      content: "hello",
    });
    expect(JSON.stringify(result.presentation)).not.toContain(librarySource.downloadUrl);
  });

  it("accepts empty text content", () => {
    const result = addCustomLibraryFileToPresentation(
      presentation(),
      file({
        name: "Empty notes",
        kind: "text",
        representation: "text",
        source: { ...librarySource, contentType: "text/plain" },
      }),
      "",
    );
    expect(result.kind).toBe("added");
  });

  it("allocates collision-safe IDs and never merges explicit materializations", () => {
    const first = addCustomLibraryFileToPresentation(presentation(), file());
    if (first.kind !== "added") throw new Error("expected first file to be added");
    const second = addCustomLibraryFileToPresentation(first.presentation, file());
    if (second.kind !== "added") throw new Error("expected second file to be added");
    expect(second.fileResourceId).not.toBe(first.fileResourceId);
    expect(second.presentation.resources?.files).toHaveLength(2);
  });

  it("preserves unrelated data and existing fonts", () => {
    const original = presentation({
      resources: {
        fonts: [{
          id: "inter",
          family: "Inter",
          source: {
            type: "url",
            url: "https://cdn.example.com/inter.woff2",
            format: "woff2",
          },
        }],
      },
    });
    const result = addCustomLibraryFileToPresentation(original, file());
    expect(result.kind).toBe("added");
    if (result.kind !== "added") return;
    expect(result.presentation.palette).toEqual(original.palette);
    expect(result.presentation.slides).toEqual(original.slides);
    expect(result.presentation.resources?.fonts).toEqual(original.resources?.fonts);
  });
});

describe("removeCustomLibraryFileFromPresentation", () => {
  it("removes one file while preserving other files and fonts", () => {
    const first = addCustomLibraryFileToPresentation(presentation(), file());
    if (first.kind !== "added") throw new Error("expected first file to be added");
    const second = addCustomLibraryFileToPresentation(first.presentation, file({ name: "Other image" }));
    if (second.kind !== "added") throw new Error("expected second file to be added");
    const withFont = PresentationSchema.parse({
      ...second.presentation,
      resources: {
        ...second.presentation.resources,
        fonts: [{
          id: "inter",
          family: "Inter",
          source: { type: "url", url: "https://cdn.example.com/inter.woff2", format: "woff2" },
        }],
      },
    });

    const result = removeCustomLibraryFileFromPresentation(withFont, first.fileResourceId);
    expect(result.kind).toBe("removed");
    if (result.kind !== "removed") return;
    expect(result.presentation.resources?.files).toHaveLength(1);
    expect(result.presentation.resources?.files?.[0]?.id).toBe(second.fileResourceId);
    expect(result.presentation.resources?.fonts).toHaveLength(1);
  });

  it("removes the final file without disturbing fonts", () => {
    const original = presentation({
      resources: {
        fonts: [{
          id: "inter",
          family: "Inter",
          source: { type: "url", url: "https://cdn.example.com/inter.woff2", format: "woff2" },
        }],
        files: [{
          id: "file-notes",
          name: "Notes",
          kind: "text",
          representation: "text",
          contentType: "text/plain",
          source: { type: "text", content: "notes" },
        }],
      },
    });
    const result = removeCustomLibraryFileFromPresentation(original, "file-notes");
    expect(result.kind).toBe("removed");
    if (result.kind !== "removed") return;
    expect(result.presentation.resources).toEqual({ fonts: original.resources?.fonts });
  });

  it("does not mutate when the local ID is missing", () => {
    const original = presentation();
    const result = removeCustomLibraryFileFromPresentation(original, "missing");
    expect(result.kind).toBe("not-found");
    expect(result.presentation).toBe(original);
  });
});
