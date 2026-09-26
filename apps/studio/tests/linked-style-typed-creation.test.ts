import { describe, expect, it } from "vitest";
import { PresentationSchema } from "@web-slideshow/document-schema";

import { createLinkedTopicsStyleWithProperty } from "../src/features/editor/linked-style-authoring";
import {
  createLinkedCodeStyleWithProperty,
  createLinkedDividerStyleWithProperty,
  createLinkedSimpleTableStyleWithProperty,
  createLinkedStructuredTableStyleWithProperty,
  createLinkedTerminalStyleWithProperty,
  listTargetLinkedStyleCreationProperties,
} from "../src/features/editor/target-linked-style-property-authoring";
import {
  createLinkedStyleFromCreationRequest,
  type LinkedStyleCreationRequest,
} from "../src/features/editor/linked-style-creation";
import { createLinkedStyleWithProperty } from "../src/features/editor/linked-style-property-authoring";

const emptyPresentation = () => PresentationSchema.parse({ schemaVersion: 1, id: "p", title: "P", slides: [] });

describe("typed linked-style creation", () => {
  it("keeps target first-property compatibility in one canonical matrix", () => {
    expect(listTargetLinkedStyleCreationProperties("code")).toContain("style.color");
    expect(listTargetLinkedStyleCreationProperties("code")).not.toContain("style.outputColor");
    expect(listTargetLinkedStyleCreationProperties("terminal")).toContain("titleTypography.fontSize");
    expect(listTargetLinkedStyleCreationProperties("simpleTable")).not.toContain("style.headerBackground");
    expect(listTargetLinkedStyleCreationProperties("simpleTable")).not.toContain("typography.letterSpacing");
    expect(listTargetLinkedStyleCreationProperties("structuredTable")).toContain("style.headerBackground");
    expect(listTargetLinkedStyleCreationProperties("structuredTable")).not.toContain("typography.fontSize");
    expect(listTargetLinkedStyleCreationProperties("divider")).toEqual(expect.arrayContaining(["layout.width", "layout.height", "style.background.color", "style.borderRadius", "effect.opacity"]));
    expect(listTargetLinkedStyleCreationProperties("divider")).not.toContain("layout.margin");
    expect(listTargetLinkedStyleCreationProperties("divider")).not.toContain("style.border");
    expect(listTargetLinkedStyleCreationProperties("divider")).not.toContain("layout.top");
  });

  it("creates every persisted contract with one authored first property", () => {
    const requests: LinkedStyleCreationRequest[] = [
      { kind: "container", name: " Container ", property: "gap" },
      { kind: "topics", name: " Topics ", property: "itemGap" },
      { kind: "code", name: " Code ", property: "style.color" },
      { kind: "terminal", name: " Terminal ", property: "style.outputColor" },
      { kind: "table", mode: "simple", name: " Simple ", property: "typography.fontSize" },
      { kind: "table", mode: "structured", name: " Structured ", property: "style.headerBackground" },
      { kind: "divider", name: " Divider ", property: "style.borderRadius" },
    ];

    let presentation = emptyPresentation();
    for (const request of requests) {
      const before = structuredClone(presentation);
      const result = createLinkedStyleFromCreationRequest(presentation, request);
      expect(result.linkedStyleId).toBeDefined();
      expect(presentation).toEqual(before);
      presentation = result.presentation;
    }

    expect(presentation.linkedStyles).toHaveLength(requests.length);
    expect(presentation.linkedStyles?.map((style) => style.name)).toEqual(["Container", "Topics", "Code", "Terminal", "Simple", "Structured", "Divider"]);
    expect(presentation.linkedStyles?.map((style) => style.id)).toEqual(["container", "topics", "code", "terminal", "simple", "structured", "divider"]);
    expect(presentation.linkedStyles?.[0]).not.toHaveProperty("target");
    expect(presentation.linkedStyles?.[1]).toMatchObject({ target: "topics", itemGap: 6 });
    expect(presentation.linkedStyles?.[2]).toMatchObject({ target: "code", style: { color: "#f8fafc" } });
    expect(presentation.linkedStyles?.[3]).toMatchObject({ target: "terminal", style: { outputColor: "#cbd5e1" } });
    expect(presentation.linkedStyles?.[4]).toMatchObject({ target: "table", mode: "simple", typography: { fontSize: 18 } });
    expect(presentation.linkedStyles?.[5]).toMatchObject({ target: "table", mode: "structured", style: { headerBackground: "#020617" } });
    expect(presentation.linkedStyles?.[6]).toMatchObject({ target: "divider", style: { borderRadius: 0 } });
    expect(PresentationSchema.safeParse(presentation).success).toBe(true);
  });

  it("fails closed for blank names and forced incompatible runtime properties", () => {
    const presentation = emptyPresentation();
    expect(createLinkedStyleWithProperty(presentation, "   ", "gap").presentation).toBe(presentation);
    expect(createLinkedStyleWithProperty(presentation, "Invalid", "top").presentation).toBe(presentation);
    expect(createLinkedCodeStyleWithProperty(presentation, "Invalid", "style.outputColor" as never).presentation).toBe(presentation);
    expect(createLinkedTerminalStyleWithProperty(presentation, "Invalid", "style.headerBackground" as never).presentation).toBe(presentation);
    expect(createLinkedSimpleTableStyleWithProperty(presentation, "Invalid", "style.headerBackground" as never).presentation).toBe(presentation);
    expect(createLinkedStructuredTableStyleWithProperty(presentation, "Invalid", "typography.fontSize" as never).presentation).toBe(presentation);
    expect(createLinkedDividerStyleWithProperty(presentation, "Invalid", "style.border" as never).presentation).toBe(presentation);
    expect(createLinkedTopicsStyleWithProperty(presentation, "Invalid", "top" as never).presentation).toBe(presentation);
  });

  it("preserves the exact Table mode and does not offer position edges as first properties", () => {
    const presentation = emptyPresentation();
    const simple = createLinkedSimpleTableStyleWithProperty(presentation, "Simple", "style.color");
    const structured = createLinkedStructuredTableStyleWithProperty(simple.presentation, "Structured", "style.dividerOpacity");
    expect(simple.presentation.linkedStyles?.[0]).toMatchObject({ target: "table", mode: "simple", style: { color: "#f8fafc" } });
    expect(structured.presentation.linkedStyles?.[1]).toMatchObject({ target: "table", mode: "structured", style: { dividerOpacity: 1 } });
    expect(listTargetLinkedStyleCreationProperties("code")).not.toEqual(expect.arrayContaining(["layout.top", "layout.right", "layout.bottom", "layout.left"]));
  });

  it("allocates globally unique IDs across heterogeneous Linked Style types", () => {
    const presentation = PresentationSchema.parse({
      schemaVersion: 1,
      id: "p",
      title: "P",
      slides: [],
      linkedStyles: [
        { id: "shared", name: "Shared", layout: { margin: 1 } },
        { target: "code", id: "shared-2", name: "Shared Code", style: { color: "#111111" } },
        { target: "topics", id: "shared-3", name: "Shared Topics", itemGap: 4 },
      ],
    });
    const result = createLinkedDividerStyleWithProperty(presentation, "Shared", "style.borderRadius");
    expect(result.linkedStyleId).toBe("shared-4");
    expect(result.presentation.linkedStyles?.map((style) => style.id)).toEqual(["shared", "shared-2", "shared-3", "shared-4"]);
  });

  it("fails closed at the discriminated dispatch boundary for a forced invalid request", () => {
    const presentation = emptyPresentation();
    const result = createLinkedStyleFromCreationRequest(presentation, {
      kind: "divider",
      name: "Invalid",
      property: "style.border",
    } as unknown as LinkedStyleCreationRequest);
    expect(result.presentation).toBe(presentation);
    expect(result.linkedStyleId).toBeUndefined();
  });
});

// Keep the discriminant contract exercised by the compiler as well as at runtime.
// @ts-expect-error Code cannot author Terminal semantic colors.
const incompatibleRequest: LinkedStyleCreationRequest = {
  kind: "code",
  name: "invalid",
  property: "style.outputColor",
};
void incompatibleRequest;

// @ts-expect-error Simple Table cannot author Structured Table header appearance.
const incompatibleSimpleTableRequest: LinkedStyleCreationRequest = {
  kind: "table",
  mode: "simple",
  name: "invalid",
  property: "style.headerBackground",
};
void incompatibleSimpleTableRequest;
