import type { Presentation } from "@web-slideshow/document-schema";

import {
  createLinkedTopicsStyleWithProperty,
  type LinkedTopicsStyleAuthorableProperty,
} from "./linked-style-authoring";
import {
  createLinkedStyleWithProperty,
  type LinkedStyleCreationProperty,
} from "./linked-style-property-authoring";
import {
  createLinkedCodeStyleWithProperty,
  createLinkedDividerStyleWithProperty,
  createLinkedSimpleTableStyleWithProperty,
  createLinkedStructuredTableStyleWithProperty,
  createLinkedTerminalStyleWithProperty,
  type CodeLinkedStyleAuthorableProperty,
  type DividerLinkedStyleAuthorableProperty,
  type SimpleTableLinkedStyleAuthorableProperty,
  type StructuredTableLinkedStyleAuthorableProperty,
  type TerminalLinkedStyleAuthorableProperty,
} from "./target-linked-style-property-authoring";

export type LinkedStyleCreationKind =
  | { kind: "container" }
  | { kind: "topics" }
  | { kind: "code" }
  | { kind: "terminal" }
  | { kind: "table"; mode: "simple" }
  | { kind: "table"; mode: "structured" }
  | { kind: "divider" };

export type LinkedStyleCreationRequest =
  | ({ kind: "container"; name: string; property: LinkedStyleCreationProperty })
  | ({ kind: "topics"; name: string; property: LinkedTopicsStyleAuthorableProperty })
  | ({ kind: "code"; name: string; property: CodeLinkedStyleAuthorableProperty })
  | ({ kind: "terminal"; name: string; property: TerminalLinkedStyleAuthorableProperty })
  | ({ kind: "table"; mode: "simple"; name: string; property: SimpleTableLinkedStyleAuthorableProperty })
  | ({ kind: "table"; mode: "structured"; name: string; property: StructuredTableLinkedStyleAuthorableProperty })
  | ({ kind: "divider"; name: string; property: DividerLinkedStyleAuthorableProperty });

export function createLinkedStyleFromCreationRequest(
  presentation: Presentation,
  request: LinkedStyleCreationRequest,
): { presentation: Presentation; linkedStyleId?: string } {
  switch (request.kind) {
    case "container": return createLinkedStyleWithProperty(presentation, request.name, request.property);
    case "topics": return createLinkedTopicsStyleWithProperty(presentation, request.name, request.property);
    case "code": return createLinkedCodeStyleWithProperty(presentation, request.name, request.property);
    case "terminal": return createLinkedTerminalStyleWithProperty(presentation, request.name, request.property);
    case "table": return request.mode === "simple"
      ? createLinkedSimpleTableStyleWithProperty(presentation, request.name, request.property)
      : createLinkedStructuredTableStyleWithProperty(presentation, request.name, request.property);
    case "divider": return createLinkedDividerStyleWithProperty(presentation, request.name, request.property);
  }
}
