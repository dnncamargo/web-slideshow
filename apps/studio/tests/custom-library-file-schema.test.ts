import { describe, expect, it } from "vitest";

import {
  CustomLibraryFileDraftSchema,
  parseCustomLibraryFileDraft,
} from "../src/features/custom-library/custom-library-file-schema";

const validFile = {
  name: "Workshop audio",
  kind: "audio" as const,
  representation: "binary" as const,
  source: {
    assetId: "123e4567-e89b-12d3-a456-426614174000",
    storagePath: "users/user-1/assets/123e4567-e89b-12d3-a456-426614174000",
    downloadUrl: "https://blob.vercel-storage.test/workshop.mp3",
    contentType: "audio/mpeg" as const,
    sizeBytes: 42,
  },
};

describe("CustomLibraryFileDraftSchema", () => {
  it("accepts a valid strict persisted record body", () => {
    expect(parseCustomLibraryFileDraft(validFile)).toEqual(validFile);
  });

  it.each([
    { ...validFile, extra: true },
    { ...validFile, source: { ...validFile.source, extra: true } },
    { ...validFile, name: " Workshop audio" },
    { ...validFile, source: { ...validFile.source, contentType: "video/mp4" } },
    { ...validFile, kind: "image", source: { ...validFile.source, contentType: "audio/mpeg" } },
  ])("rejects malformed or extra fields", (value) => {
    expect(() => CustomLibraryFileDraftSchema.parse(value)).toThrow();
  });

  it("requires a canonical managed-asset source identity", () => {
    const { source, ...withoutSource } = validFile;
    expect(() => parseCustomLibraryFileDraft(withoutSource)).toThrow();
    expect(() => parseCustomLibraryFileDraft({ ...validFile, source: { ...source, assetId: "asset-1" } })).toThrow();
  });
});
