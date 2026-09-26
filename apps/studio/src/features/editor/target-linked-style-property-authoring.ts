import {
  PresentationSchema,
  type Presentation,
} from "@web-slideshow/document-schema";
import {
  AUTHORING_ROOT_FONT_SIZE_PX,
  CODE_TYPOGRAPHY_DEFAULTS,
  ELEMENT_BORDER_RADIUS_DEFAULTS,
  TERMINAL_SEMANTIC_COLORS,
  TERMINAL_TYPOGRAPHY_DEFAULTS,
  TEXT_VARIANT_TYPOGRAPHY_DEFAULTS,
  THEME_COLORS,
} from "@web-slideshow/theme/element-style-defaults";

import { createDefaultBorder } from "./inspector/sections/element-border-control";
import { createDefaultGradient } from "./inspector/sections/element-gradient-control";
import { createDefaultShadow } from "./inspector/sections/container-effects-section";
import { createLinkedStyleId } from "./linked-style-authoring";
import {
  listTargetLinkedStyleSupportedProperties,
  type TargetLinkedStyleContract,
  type CodeTargetLinkedStyleProperty,
  type DividerTargetLinkedStyleProperty,
  type SimpleTableTargetLinkedStyleProperty,
  type StructuredTableTargetLinkedStyleProperty,
  type TerminalTargetLinkedStyleProperty,
  type TargetLinkedStyleProperty,
} from "./target-linked-style-definition-authoring";

type PropertyBag = Record<string, unknown>;
type PositionEdgeProperty = "layout.top" | "layout.right" | "layout.bottom" | "layout.left";

export type TargetLinkedStyleCreationKind =
  | "code"
  | "terminal"
  | "simpleTable"
  | "structuredTable"
  | "divider";

export type CodeLinkedStyleAuthorableProperty = Exclude<CodeTargetLinkedStyleProperty, PositionEdgeProperty>;
export type TerminalLinkedStyleAuthorableProperty = Exclude<TerminalTargetLinkedStyleProperty, PositionEdgeProperty>;
export type SimpleTableLinkedStyleAuthorableProperty = Exclude<SimpleTableTargetLinkedStyleProperty, PositionEdgeProperty>;
export type StructuredTableLinkedStyleAuthorableProperty = Exclude<StructuredTableTargetLinkedStyleProperty, PositionEdgeProperty>;
export type DividerLinkedStyleAuthorableProperty = Exclude<DividerTargetLinkedStyleProperty, PositionEdgeProperty>;

export type TargetLinkedStyleAuthorableProperty =
  | CodeLinkedStyleAuthorableProperty
  | TerminalLinkedStyleAuthorableProperty
  | SimpleTableLinkedStyleAuthorableProperty
  | StructuredTableLinkedStyleAuthorableProperty
  | DividerLinkedStyleAuthorableProperty;

const POSITION_EDGES = new Set<PositionEdgeProperty>(["layout.top", "layout.right", "layout.bottom", "layout.left"]);

function contractFor(kind: TargetLinkedStyleCreationKind): TargetLinkedStyleContract {
  if (kind === "simpleTable") return { target: "table", mode: "simple" };
  if (kind === "structuredTable") return { target: "table", mode: "structured" };
  return { target: kind };
}

export function listTargetLinkedStyleCreationProperties<K extends TargetLinkedStyleCreationKind>(kind: K): readonly Extract<TargetLinkedStyleAuthorableProperty, K extends "code" ? CodeLinkedStyleAuthorableProperty : K extends "terminal" ? TerminalLinkedStyleAuthorableProperty : K extends "simpleTable" ? SimpleTableLinkedStyleAuthorableProperty : K extends "structuredTable" ? StructuredTableLinkedStyleAuthorableProperty : DividerLinkedStyleAuthorableProperty>[] {
  return listTargetLinkedStyleSupportedProperties(contractFor(kind)).filter((property) => !POSITION_EDGES.has(property as PositionEdgeProperty)) as never;
}

function setPath(target: PropertyBag, property: TargetLinkedStyleProperty, value: unknown): void {
  const [namespace, key, nested] = property.split(".");
  const namespaceBag = (target[namespace] ?? {}) as PropertyBag;
  if (nested === undefined) namespaceBag[key] = value;
  else namespaceBag[key] = { ...((namespaceBag[key] ?? {}) as PropertyBag), [nested]: value };
  target[namespace] = namespaceBag;
}

function defaultValue(kind: TargetLinkedStyleCreationKind, property: TargetLinkedStyleProperty): unknown {
  switch (property) {
    case "layout.position": return "absolute";
    case "layout.width":
    case "layout.height": return "100%";
    case "layout.margin":
    case "layout.marginTop":
    case "layout.marginRight":
    case "layout.marginBottom":
    case "layout.marginLeft": return 0;
    case "style.color": return THEME_COLORS.textPrimary;
    case "style.background.color": return THEME_COLORS.surfaceStrong;
    case "style.background.gradient": return createDefaultGradient("linear");
    case "style.border": return createDefaultBorder();
    case "style.borderRadius": return ELEMENT_BORDER_RADIUS_DEFAULTS[kind === "simpleTable" || kind === "structuredTable" ? "table" : kind];
    case "style.commandColor": return TERMINAL_SEMANTIC_COLORS.command;
    case "style.promptColor": return TERMINAL_SEMANTIC_COLORS.prompt;
    case "style.outputColor": return TERMINAL_SEMANTIC_COLORS.output;
    case "style.commentColor": return TERMINAL_SEMANTIC_COLORS.comment;
    case "style.errorColor": return TERMINAL_SEMANTIC_COLORS.error;
    case "style.headerBackground": return THEME_COLORS.surfaceStrong;
    case "style.bodyRowAlternateBackground": return THEME_COLORS.surface;
    case "style.dividerOpacity": return 1;
    case "typography.fontFamily": return "monospace";
    case "typography.fontSize": return kind === "code" ? CODE_TYPOGRAPHY_DEFAULTS.fontSize : kind === "terminal" ? TERMINAL_TYPOGRAPHY_DEFAULTS.fontSize : TEXT_VARIANT_TYPOGRAPHY_DEFAULTS.body.fontSize;
    case "typography.lineHeight": return kind === "code" ? CODE_TYPOGRAPHY_DEFAULTS.lineHeight : kind === "terminal" ? TERMINAL_TYPOGRAPHY_DEFAULTS.lineHeight : TEXT_VARIANT_TYPOGRAPHY_DEFAULTS.body.lineHeight;
    case "typography.letterSpacing": return kind === "code" ? CODE_TYPOGRAPHY_DEFAULTS.letterSpacing : TERMINAL_TYPOGRAPHY_DEFAULTS.letterSpacing;
    case "titleTypography.fontFamily": return "monospace";
    case "titleTypography.fontSize": return 0.8125 * AUTHORING_ROOT_FONT_SIZE_PX;
    case "titleTypography.fontWeight": return 400;
    case "titleTypography.fontStyle": return "normal";
    case "titleTypography.lineHeight": return 1.2;
    case "titleTypography.letterSpacing": return 0;
    case "titleTypography.textTransform": return "none";
    case "effect.opacity": return 1;
    case "effect.shadow": return createDefaultShadow();
    default: return undefined;
  }
}

function createTargetLinkedStyleWithProperty(
  presentation: Presentation,
  name: string,
  kind: TargetLinkedStyleCreationKind,
  property: TargetLinkedStyleProperty,
): { presentation: Presentation; linkedStyleId?: string } {
  const trimmed = name.trim();
  if (!trimmed || !listTargetLinkedStyleCreationProperties(kind).includes(property as never)) return { presentation };
  const ids = (presentation.linkedStyles ?? []).map((style) => style.id);
  const id = createLinkedStyleId(trimmed, ids);
  const contract = contractFor(kind);
  const candidate: PropertyBag = { ...contract, id, name: trimmed };
  const value = defaultValue(kind, property);
  if (value === undefined) return { presentation };
  setPath(candidate, property, value);
  const parsed = PresentationSchema.safeParse({ ...presentation, linkedStyles: [...(presentation.linkedStyles ?? []), candidate] });
  return parsed.success ? { presentation: parsed.data, linkedStyleId: id } : { presentation };
}

export function createLinkedCodeStyleWithProperty(presentation: Presentation, name: string, property: CodeLinkedStyleAuthorableProperty) {
  return createTargetLinkedStyleWithProperty(presentation, name, "code", property);
}

export function createLinkedTerminalStyleWithProperty(presentation: Presentation, name: string, property: TerminalLinkedStyleAuthorableProperty) {
  return createTargetLinkedStyleWithProperty(presentation, name, "terminal", property);
}

export function createLinkedSimpleTableStyleWithProperty(presentation: Presentation, name: string, property: SimpleTableLinkedStyleAuthorableProperty) {
  return createTargetLinkedStyleWithProperty(presentation, name, "simpleTable", property);
}

export function createLinkedStructuredTableStyleWithProperty(presentation: Presentation, name: string, property: StructuredTableLinkedStyleAuthorableProperty) {
  return createTargetLinkedStyleWithProperty(presentation, name, "structuredTable", property);
}

export function createLinkedDividerStyleWithProperty(presentation: Presentation, name: string, property: DividerLinkedStyleAuthorableProperty) {
  return createTargetLinkedStyleWithProperty(presentation, name, "divider", property);
}
