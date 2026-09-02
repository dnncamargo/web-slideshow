import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const rules = readFileSync(
  new URL("../../../firestore.rules", import.meta.url),
  "utf8",
);

describe("Firestore presentation record rules", () => {
  it("requires the strict draft record shape and operational field types", () => {
    expect(rules).toContain(
      "resource.keys().hasAll(['presentationJson', 'createdAt', 'updatedAt', 'draftRevision'])",
    );
    expect(rules).toContain(
      "resource.keys().hasOnly(['presentationJson', 'createdAt', 'updatedAt', 'draftRevision', 'folderId', 'archivedAt', 'publication'])",
    );
    expect(rules).toContain("resource.presentationJson is string");
    expect(rules).toContain("resource.createdAt is timestamp");
    expect(rules).toContain("resource.updatedAt is timestamp");
    expect(rules).toContain("resource.draftRevision is int");
  });

  it("keeps immutable version and authoritative equality invariants", () => {
    expect(rules).toContain(
      "resource.keys().hasOnly(['presentationId', 'presentationJson', 'publishedRevision', 'publishedAt'])",
    );
    expect(rules).toContain("resource.presentationId is string");
    expect(rules).toContain("resource.presentationJson == draft.data.presentationJson");
    expect(rules).toContain("version.data.presentationJson == draft.data.presentationJson");
    expect(rules).toContain("version.data.presentationId");
  });

  it("does not retain the legacy nested presentation rule shape", () => {
    expect(rules).not.toContain("resource.presentation is map");
    expect(rules).not.toContain("request.resource.data.presentation is map");
  });
});
