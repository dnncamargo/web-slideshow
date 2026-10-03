import { describe, expect, it } from "vitest";

import {
  classifyCustomLibraryFile,
  UnsupportedCustomLibraryFileError,
} from "../src/features/custom-library/custom-library-file-classification";

const cases = [
  [".jpg", "image", "binary", "image/jpeg"],
  [".jpeg", "image", "binary", "image/jpeg"],
  [".png", "image", "binary", "image/png"],
  [".webp", "image", "binary", "image/webp"],
  [".gif", "image", "binary", "image/gif"],
  [".svg", "image", "text", "image/svg+xml"],
  [".mp3", "audio", "binary", "audio/mpeg"],
  [".wav", "audio", "binary", "audio/wav"],
  [".ogg", "audio", "binary", "audio/ogg"],
  [".ttf", "font", "binary", "font/ttf"],
  [".otf", "font", "binary", "font/otf"],
  [".woff", "font", "binary", "font/woff"],
  [".woff2", "font", "binary", "font/woff2"],
  [".txt", "text", "text", "text/plain"],
  [".md", "markdown", "text", "text/markdown"],
  [".csv", "structured-data", "text", "text/csv"],
  [".json", "structured-data", "text", "application/json"],
  [".xml", "structured-data", "text", "application/xml"],
] as const;

describe("classifyCustomLibraryFile", () => {
  it.each(cases)("classifies %s by extension", (extension, kind, representation, contentType) => {
    expect(classifyCustomLibraryFile({ name: `asset${extension}`, type: "application/octet-stream" })).toEqual({
      extension,
      kind,
      representation,
      contentType,
    });
  });

  it("does not trust an empty or inconsistent File.type", () => {
    expect(classifyCustomLibraryFile({ name: "diagram.svg", type: "" }).contentType).toBe("image/svg+xml");
    expect(classifyCustomLibraryFile({ name: "photo.jpg", type: "text/plain" }).contentType).toBe("image/jpeg");
  });

  it.each(["asset", "asset.exe", "asset.tar.gz"])("rejects unsupported extension %s", (name) => {
    expect(() => classifyCustomLibraryFile({ name, type: "" })).toThrow(UnsupportedCustomLibraryFileError);
  });
});
