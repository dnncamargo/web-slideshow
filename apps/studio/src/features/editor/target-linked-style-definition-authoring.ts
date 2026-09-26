import {
  PresentationSchema,
  type CodeElement,
  type DividerElement,
  type LinkedCodeStyle,
  type LinkedDividerStyle,
  type LinkedSimpleTableStyle,
  type LinkedStructuredTableStyle,
  type LinkedTerminalStyle,
  type LinkedTableStyle,
  type Presentation,
  type SimpleTableElement,
  type StructuredTableElement,
  type TerminalElement,
} from "@web-slideshow/document-schema";
import { parseAuthoringLength } from "@web-slideshow/theme/element-style-defaults";

import { updateElementById, visitElements } from "./element-hierarchy";
import { updatePresentationAuthoringTrees } from "./presentation-authoring-trees";

type TargetLinkedStyle = LinkedCodeStyle | LinkedTerminalStyle | LinkedTableStyle | LinkedDividerStyle;
type TargetElement = CodeElement | TerminalElement | SimpleTableElement | StructuredTableElement | DividerElement;
type Bag = Record<string, unknown>;

type OptionalPatch<T extends object> = { [K in keyof T]?: T[K] | undefined };
type BackgroundPatch = OptionalPatch<NonNullable<NonNullable<LinkedCodeStyle["style"]>["background"]>>;
type LayoutPatch = OptionalPatch<NonNullable<LinkedCodeStyle["layout"]>>;
type CodeStylePatch = OptionalPatch<NonNullable<LinkedCodeStyle["style"]>> & { background?: BackgroundPatch | undefined };
type TerminalStylePatch = OptionalPatch<NonNullable<LinkedTerminalStyle["style"]>> & { background?: BackgroundPatch | undefined };
type SimpleTableStylePatch = OptionalPatch<NonNullable<LinkedSimpleTableStyle["style"]>> & { background?: BackgroundPatch | undefined };
type StructuredTableStylePatch = OptionalPatch<NonNullable<LinkedStructuredTableStyle["style"]>> & { background?: BackgroundPatch | undefined };
type DividerStylePatch = Omit<OptionalPatch<NonNullable<LinkedDividerStyle["style"]>>, "className"> & { background?: BackgroundPatch | undefined };
type CodeTypographyPatch = OptionalPatch<NonNullable<LinkedCodeStyle["typography"]>>;
type TerminalTypographyPatch = OptionalPatch<NonNullable<LinkedTerminalStyle["typography"]>>;
type SimpleTableTypographyPatch = OptionalPatch<NonNullable<LinkedSimpleTableStyle["typography"]>>;
type TitleTypographyPatch = OptionalPatch<NonNullable<LinkedTerminalStyle["titleTypography"]>>;
type EffectPatch = OptionalPatch<NonNullable<LinkedCodeStyle["effect"]>>;

export type TargetLinkedStyleProperty =
  | "layout.position" | "layout.top" | "layout.right" | "layout.bottom" | "layout.left"
  | "layout.width" | "layout.height" | "layout.margin" | "layout.marginTop"
  | "layout.marginRight" | "layout.marginBottom" | "layout.marginLeft"
  | "style.color" | "style.background.color" | "style.background.gradient"
  | "style.border" | "style.borderRadius"
  | "style.commandColor" | "style.promptColor" | "style.outputColor"
  | "style.commentColor" | "style.errorColor" | "style.headerBackground"
  | "style.bodyRowAlternateBackground" | "style.dividerOpacity"
  | "typography.fontFamily" | "typography.fontSize" | "typography.lineHeight"
  | "typography.letterSpacing"
  | "titleTypography.fontFamily" | "titleTypography.fontSize" | "titleTypography.fontWeight"
  | "titleTypography.fontStyle" | "titleTypography.lineHeight" | "titleTypography.letterSpacing"
  | "titleTypography.textTransform"
  | "effect.opacity" | "effect.shadow";

export type TargetLinkedStyleDefinitionPatch =
  | { target: "code"; layout?: LayoutPatch | undefined; style?: CodeStylePatch | undefined; typography?: CodeTypographyPatch | undefined; effect?: EffectPatch | undefined }
  | { target: "terminal"; layout?: LayoutPatch | undefined; style?: TerminalStylePatch | undefined; typography?: TerminalTypographyPatch | undefined; titleTypography?: TitleTypographyPatch | undefined; effect?: EffectPatch | undefined }
  | { target: "table"; mode: "simple"; layout?: LayoutPatch | undefined; style?: SimpleTableStylePatch | undefined; typography?: SimpleTableTypographyPatch | undefined; effect?: EffectPatch | undefined }
  | { target: "table"; mode: "structured"; layout?: LayoutPatch | undefined; style?: StructuredTableStylePatch | undefined; effect?: EffectPatch | undefined }
  | { target: "divider"; layout?: Omit<LayoutPatch, "margin" | "marginTop" | "marginRight" | "marginBottom" | "marginLeft"> | undefined; style?: DividerStylePatch | undefined; effect?: Pick<EffectPatch, "opacity"> | undefined };

export type TargetLinkedStylePatch = TargetLinkedStyleDefinitionPatch;

const PROPERTIES = {
  code: ["layout.position", "layout.top", "layout.right", "layout.bottom", "layout.left", "layout.width", "layout.height", "layout.margin", "layout.marginTop", "layout.marginRight", "layout.marginBottom", "layout.marginLeft", "style.color", "style.background.color", "style.background.gradient", "style.border", "style.borderRadius", "typography.fontFamily", "typography.fontSize", "typography.lineHeight", "typography.letterSpacing", "effect.opacity", "effect.shadow"],
  terminal: ["layout.position", "layout.top", "layout.right", "layout.bottom", "layout.left", "layout.width", "layout.height", "layout.margin", "layout.marginTop", "layout.marginRight", "layout.marginBottom", "layout.marginLeft", "style.background.color", "style.background.gradient", "style.border", "style.borderRadius", "style.commandColor", "style.promptColor", "style.outputColor", "style.commentColor", "style.errorColor", "typography.fontFamily", "typography.fontSize", "typography.lineHeight", "typography.letterSpacing", "titleTypography.fontFamily", "titleTypography.fontSize", "titleTypography.fontWeight", "titleTypography.fontStyle", "titleTypography.lineHeight", "titleTypography.letterSpacing", "titleTypography.textTransform", "effect.opacity", "effect.shadow"],
  table: ["layout.position", "layout.top", "layout.right", "layout.bottom", "layout.left", "layout.width", "layout.height", "layout.margin", "layout.marginTop", "layout.marginRight", "layout.marginBottom", "layout.marginLeft", "style.color", "style.background.color", "style.background.gradient", "style.border", "style.borderRadius", "typography.fontFamily", "typography.fontSize", "typography.lineHeight", "effect.opacity", "effect.shadow", "style.headerBackground", "style.bodyRowAlternateBackground", "style.dividerOpacity"],
  divider: ["layout.position", "layout.top", "layout.right", "layout.bottom", "layout.left", "layout.width", "layout.height", "style.background.color", "style.background.gradient", "style.borderRadius", "effect.opacity"],
} as const;

export type CodeTargetLinkedStyleProperty = typeof PROPERTIES.code[number];
export type TerminalTargetLinkedStyleProperty = typeof PROPERTIES.terminal[number];
export type TableTargetLinkedStyleProperty = typeof PROPERTIES.table[number];
export type DividerTargetLinkedStyleProperty = typeof PROPERTIES.divider[number];
export type SimpleTableTargetLinkedStyleProperty = Exclude<TableTargetLinkedStyleProperty, "style.headerBackground" | "style.bodyRowAlternateBackground" | "style.dividerOpacity">;
export type StructuredTableTargetLinkedStyleProperty = Exclude<TableTargetLinkedStyleProperty, "style.color" | "typography.fontFamily" | "typography.fontSize" | "typography.lineHeight">;

const SIMPLE_TABLE_PROPERTIES = PROPERTIES.table.filter((property) => !property.startsWith("style.header") && !property.startsWith("style.body") && property !== "style.dividerOpacity");
const STRUCTURED_TABLE_PROPERTIES = PROPERTIES.table.filter((property) => !property.startsWith("style.color") && !property.startsWith("typography."));

export type TargetLinkedStyleContract =
  | { target: "code" }
  | { target: "terminal" }
  | { target: "table"; mode: "simple" }
  | { target: "table"; mode: "structured" }
  | { target: "divider" };

export function listTargetLinkedStyleSupportedProperties(contract: TargetLinkedStyleContract): readonly TargetLinkedStyleProperty[] {
  if (contract.target !== "table") return PROPERTIES[contract.target];
  return contract.mode === "simple" ? SIMPLE_TABLE_PROPERTIES : STRUCTURED_TABLE_PROPERTIES;
}

function propertiesFor(style: TargetLinkedStyle): readonly TargetLinkedStyleProperty[] {
  return listTargetLinkedStyleSupportedProperties(style);
}

function targetOf(style: TargetLinkedStyle | undefined): TargetLinkedStyle["target"] | undefined {
  return style?.target;
}

function modeOf(element: TargetElement | undefined): "simple" | "structured" | undefined {
  return element?.type === "table" ? (element.mode === "structured" ? "structured" : "simple") : undefined;
}

function compatible(style: TargetLinkedStyle | undefined, element: TargetElement): boolean {
  if (style === undefined || style.target !== element.type && !(style.target === "table" && element.type === "table")) return false;
  return style.target !== "table" || style.mode === modeOf(element);
}

function valueAt(value: TargetLinkedStyle | TargetElement | undefined, property: TargetLinkedStyleProperty): unknown {
  if (value === undefined) return undefined;
  const [bag, key] = property.split(".") as [string, string, string?];
  if (bag === "style" && key === "background") return (value.style as Bag | undefined)?.background && ((value.style as Bag).background as Bag)[key === "background" ? (property.split(".")[2] ?? "") : ""];
  if (bag === "style" && key !== undefined) return (value.style as Bag | undefined)?.[key];
  if (bag === "layout" && key !== undefined) return (value.layout as Bag | undefined)?.[key];
  if (bag === "typography" && key !== undefined) return ("typography" in value ? (value.typography as Bag | undefined)?.[key] : undefined);
  if (bag === "titleTypography" && key !== undefined) return ("titleTypography" in value ? (value.titleTypography as Bag | undefined)?.[key] : undefined);
  if (bag === "effect" && key !== undefined) return (value.effect as Bag | undefined)?.[key];
  return undefined;
}

function equal(left: unknown, right: unknown): boolean {
  if (Object.is(left, right)) return true;
  if (left === undefined || right === undefined || left === null || right === null) return false;
  if ((typeof left === "number" || typeof left === "string") && (typeof right === "number" || typeof right === "string")) {
    const leftLength = parseAuthoringLength(left);
    const rightLength = parseAuthoringLength(right);
    if (leftLength !== undefined && rightLength !== undefined) return leftLength.value === rightLength.value && leftLength.unit === rightLength.unit;
  }
  if (typeof left !== "object" || typeof right !== "object" || Array.isArray(left) || Array.isArray(right)) return false;
  const leftEntries = Object.entries(left as Bag).filter(([, v]) => v !== undefined);
  const rightEntries = Object.entries(right as Bag).filter(([, v]) => v !== undefined);
  return leftEntries.length === rightEntries.length && leftEntries.every(([key, value]) => Object.prototype.hasOwnProperty.call(right, key) && equal(value, (right as Bag)[key]));
}

export function changedTargetLinkedStyleProperties(before: TargetLinkedStyle | undefined, after: TargetLinkedStyle | undefined): TargetLinkedStyleProperty[] {
  if (before === undefined || after === undefined || targetOf(before) !== targetOf(after) || (before.target === "table" && after.target === "table" && before.mode !== after.mode)) return [];
  return propertiesFor(after).filter((property) => !equal(valueAt(before, property), valueAt(after, property)));
}

function clearPath<T extends TargetElement>(element: T, property: TargetLinkedStyleProperty): T {
  if (valueAt(element, property) === undefined) return element;
  const [bag, key, nested] = property.split(".");
  const source = (element as Bag)[bag] as Bag | undefined;
  if (source === undefined) return element;
  const nextBag = { ...source };
  if (nested !== undefined) {
    const nestedBag = nextBag[key] as Bag | undefined;
    if (nestedBag === undefined || nestedBag[nested] === undefined) return element;
    const nextNested = { ...nestedBag };
    delete nextNested[nested];
    if (Object.keys(nextNested).length === 0) delete nextBag[key];
    else nextBag[key] = nextNested;
  } else {
    delete nextBag[key];
  }
  const next = { ...(element as Bag) };
  if (Object.keys(nextBag).length === 0) delete next[bag];
  else next[bag] = nextBag;
  return next as T;
}

export function clearLinkedTargetStyleProperty<T extends TargetElement>(element: T, property: TargetLinkedStyleProperty): T {
  const targetProperties = element.type === "table"
    ? (element.mode === "structured" ? STRUCTURED_TABLE_PROPERTIES : SIMPLE_TABLE_PROPERTIES)
    : PROPERTIES[element.type];
  if (!(targetProperties as readonly TargetLinkedStyleProperty[]).includes(property)) return element;
  return clearPath(element, property);
}

function mergeBag(current: unknown, patch: Bag | undefined): unknown {
  if (patch === undefined) return undefined;
  const next: Bag = { ...((current ?? {}) as Bag) };
  for (const [key, value] of Object.entries(patch)) {
    if (value === undefined) delete next[key];
    else if (key === "background" && value !== null && typeof value === "object") {
      const background = { ...((next.background ?? {}) as Bag) };
      for (const [member, memberValue] of Object.entries(value as Bag)) {
        if (memberValue === undefined) delete background[member]; else background[member] = memberValue;
      }
      if (Object.keys(background).length === 0) delete next.background; else next.background = background;
    } else next[key] = value;
  }
  return Object.keys(next).length === 0 ? undefined : next;
}

function applyDefinitionPatch(style: TargetLinkedStyle, patch: TargetLinkedStyleDefinitionPatch): TargetLinkedStyle {
  const next: Bag = { ...(style as Bag) };
  for (const key of ["layout", "style", "typography", "titleTypography", "effect"] as const) {
    if (Object.prototype.hasOwnProperty.call(patch, key) && (patch as Bag)[key] !== undefined) next[key] = mergeBag(next[key], (patch as Bag)[key] as Bag);
  }
  return next as TargetLinkedStyle;
}

export function updateTargetLinkedStyleDefinition(
  presentation: Presentation,
  linkedStyleId: string,
  patch: TargetLinkedStyleDefinitionPatch,
): Presentation {
  const styles = presentation.linkedStyles;
  const current = styles?.find((style): style is TargetLinkedStyle => "target" in style && style.id === linkedStyleId);
  if (current === undefined || current.target !== patch.target || (current.target === "table" && patch.target === "table" && current.mode !== patch.mode)) return presentation;
  const updated = applyDefinitionPatch(current, patch);
  if (changedTargetLinkedStyleProperties(current, updated).length === 0) return presentation;
  const parsed = PresentationSchema.safeParse({ ...presentation, linkedStyles: styles!.map((style) => style.id === linkedStyleId ? updated : style) });
  return parsed.success ? parsed.data : presentation;
}

export function propagateTargetLinkedStyleDefinitionChanges(
  presentation: Presentation,
  linkedStyleId: string,
  before: TargetLinkedStyle | undefined,
  after: TargetLinkedStyle | undefined,
): Presentation {
  if (before === undefined || after === undefined || before.id !== linkedStyleId || after.id !== linkedStyleId || before.target !== after.target || (before.target === "table" && after.target === "table" && before.mode !== after.mode)) return presentation;
  const changed = changedTargetLinkedStyleProperties(before, after);
  if (changed.length === 0) return presentation;
  return updatePresentationAuthoringTrees(presentation, (elements) => {
    let next = elements as TargetElement[];
    visitElements(elements, (element) => {
      if (!("linkedStyleId" in element) || !compatible(after, element as TargetElement) || element.linkedStyleId !== linkedStyleId) return;
      const updated = changed.reduce((current, property) => clearLinkedTargetStyleProperty(current, property), element as TargetElement);
      if (updated !== element) next = updateElementById(next, element.id, () => updated) as TargetElement[];
    });
    return next;
  });
}

export const updateLinkedTargetStyle = updateTargetLinkedStyleDefinition;
export const propagateLinkedTargetStyleDefinitionChanges = propagateTargetLinkedStyleDefinitionChanges;

export type { TargetLinkedStyle };
