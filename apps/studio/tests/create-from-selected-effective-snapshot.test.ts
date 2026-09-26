import { describe, expect, it } from "vitest";

import {
  PresentationSchema,
  resolveLinkedCodeStyle,
  resolveLinkedContainerStyle,
  resolveLinkedDividerStyle,
  resolveLinkedTableStyle,
  resolveLinkedTerminalStyle,
  type Presentation,
  type PresentationElement,
} from "@web-slideshow/document-schema";
import {
  AUTHORING_ROOT_FONT_SIZE_PX,
  resolveEffectiveElementStyleDefaults,
  TERMINAL_SEMANTIC_COLORS,
} from "@web-slideshow/theme/element-style-defaults";

import {
  createLinkedStyleFromCodeElement,
  createLinkedStyleFromContainerElement,
  createLinkedStyleFromDividerElement,
  createLinkedStyleFromSimpleTableElement,
  createLinkedStyleFromStructuredTableElement,
  createLinkedStyleFromTerminalElement,
} from "../src/features/editor/linked-style-authoring";
import { DIVIDER_GEOMETRY_DEFAULTS } from "../src/features/editor/divider-geometry-defaults";

type SnapshotElement = Extract<PresentationElement, { type: "container" | "code" | "terminal" | "table" | "divider" }>;
type Created = { presentation: Presentation; element: SnapshotElement };

function presentation(element: SnapshotElement): Presentation {
  return PresentationSchema.parse({
    schemaVersion: 1,
    id: "effective-snapshot",
    title: "Effective snapshot",
    slides: [{ id: "slide", title: "", elements: [element] }],
  });
}

function withoutClassName<T extends { className?: string }>(style: T | undefined): Omit<T, "className"> | undefined {
  if (style === undefined) return undefined;
  const { className: _className, ...shareable } = style;
  return shareable;
}

function effectiveShareableState(source: Presentation, element: SnapshotElement): object {
  if (element.type === "container") {
    const resolved = resolveLinkedContainerStyle(source, element);
    const defaults = resolveEffectiveElementStyleDefaults(element);
    return {
      layout: resolved.layout,
      style: { ...(withoutClassName(resolved.style) ?? {}), borderRadius: resolved.style?.borderRadius ?? defaults.borderRadius },
      typography: resolved.typography,
      effect: { opacity: 1, ...(resolved.effect ?? {}) },
    };
  }

  if (element.type === "code") {
    const resolved = resolveLinkedCodeStyle(source, element);
    const defaults = resolveEffectiveElementStyleDefaults(element);
    return {
      layout: resolved.layout,
      style: { ...(withoutClassName(resolved.style) ?? {}), borderRadius: resolved.style?.borderRadius ?? defaults.borderRadius },
      typography: { ...(defaults.typography ?? {}), ...(resolved.typography ?? {}) },
      effect: { opacity: 1, ...(resolved.effect ?? {}) },
    };
  }

  if (element.type === "terminal") {
    const resolved = resolveLinkedTerminalStyle(source, element);
    const defaults = resolveEffectiveElementStyleDefaults(element);
    return {
      layout: resolved.layout,
      style: {
        commandColor: TERMINAL_SEMANTIC_COLORS.command,
        promptColor: TERMINAL_SEMANTIC_COLORS.prompt,
        outputColor: TERMINAL_SEMANTIC_COLORS.output,
        commentColor: TERMINAL_SEMANTIC_COLORS.comment,
        errorColor: TERMINAL_SEMANTIC_COLORS.error,
        ...(withoutClassName(resolved.style) ?? {}),
        borderRadius: resolved.style?.borderRadius ?? defaults.borderRadius,
      },
      typography: { ...(defaults.typography ?? {}), ...(resolved.typography ?? {}) },
      titleTypography: { fontSize: 0.8125 * AUTHORING_ROOT_FONT_SIZE_PX, ...(resolved.titleTypography ?? {}) },
      effect: { opacity: 1, ...(resolved.effect ?? {}) },
    };
  }

  if (element.type === "table") {
    const resolved = resolveLinkedTableStyle(source, element);
    const defaults = resolveEffectiveElementStyleDefaults(element);
    return {
      layout: resolved.layout,
      style: { ...(withoutClassName(resolved.style) ?? {}), borderRadius: resolved.style?.borderRadius ?? defaults.borderRadius },
      typography: "typography" in resolved ? resolved.typography : undefined,
      effect: { opacity: 1, ...(resolved.effect ?? {}) },
    };
  }

  const resolved = resolveLinkedDividerStyle(source, element);
  const geometry = DIVIDER_GEOMETRY_DEFAULTS[element.orientation];
  const defaults = resolveEffectiveElementStyleDefaults(element);
  return {
    layout: {
      ...(resolved.layout ?? {}),
      width: resolved.layout?.width ?? geometry.width.length,
      height: resolved.layout?.height ?? geometry.height.length,
    },
    style: { ...(withoutClassName(resolved.style) ?? {}), borderRadius: resolved.style?.borderRadius ?? defaults.borderRadius },
    effect: { opacity: 1, ...(resolved.effect ?? {}) },
  };
}

function createFromSelected(source: Presentation, element: SnapshotElement): Created | null {
  if (element.type === "container") return createLinkedStyleFromContainerElement(source, element, "Shared") as Created | null;
  if (element.type === "code") return createLinkedStyleFromCodeElement(source, element, "Shared") as Created | null;
  if (element.type === "terminal") return createLinkedStyleFromTerminalElement(source, element, "Shared") as Created | null;
  if (element.type === "table" && element.mode === "structured") return createLinkedStyleFromStructuredTableElement(source, element, "Shared") as Created | null;
  if (element.type === "table") return createLinkedStyleFromSimpleTableElement(source, element, "Shared") as Created | null;
  return createLinkedStyleFromDividerElement(source, element, "Shared") as Created | null;
}

function afterCreation(source: Presentation, created: Created): Presentation {
  return PresentationSchema.parse({
    ...created.presentation,
    slides: [{ ...source.slides[0]!, elements: [created.element] }],
  });
}

const matrix: Array<{ name: string; element: SnapshotElement }> = [
  {
    name: "Container",
    element: {
      id: "container",
      type: "container",
      hidden: false,
      role: "column",
      link: { kind: "url", href: "https://example.com" },
      layout: { position: "absolute", left: 12, width: "80%", padding: 10, children: { direction: "row", gap: 8, verticalAlign: "center" } },
      style: { color: "#123456", background: { color: "#111111" }, border: { width: 2, style: "solid", color: "#ffffff" }, borderRadius: 18, className: "local" },
      typography: { fontSize: 24, fontWeight: 700 },
      effect: { opacity: 0.75, shadow: { x: 0, y: 2, blur: 4, color: "#000000" } },
      children: [{ id: "child", type: "text", variant: "body", hidden: false, content: "Child" }],
    },
  },
  {
    name: "Code",
    element: {
      id: "code",
      type: "code",
      hidden: false,
      code: "const x = 1",
      language: "typescript",
      showLineNumbers: true,
      highlightedLines: [1],
      layout: { width: 400, margin: 8 },
      style: { color: "#abcdef", background: { color: "#111111" }, border: { width: 1, style: "solid", color: "#222222" }, className: "local" },
      typography: { fontSize: 18 },
      effect: { opacity: 0.8, shadow: { x: 1, y: 2, blur: 3, color: "#000000" } },
    },
  },
  {
    name: "Terminal",
    element: {
      id: "terminal",
      type: "terminal",
      hidden: false,
      title: "Shell",
      titleStyle: { color: "#ffffff", className: "title-local" },
      lines: [{ type: "output", content: "ready" }],
      layout: { width: 420 },
      style: { outputColor: "#abcdef", borderRadius: 12, className: "local" },
      typography: { lineHeight: 1.8 },
      titleTypography: { fontSize: 14 },
      effect: { opacity: 0.6 },
    },
  },
  {
    name: "Simple Table omitted mode",
    element: {
      id: "simple-omitted",
      type: "table",
      hidden: false,
      columns: [{ key: "name", label: "Name" }],
      rows: [{ name: "Ada" }],
      layout: { width: 500 },
      style: { background: { color: "#101010" }, border: { width: 1, style: "solid", color: "#202020" }, className: "local" },
      typography: { fontSize: 16 },
      effect: { opacity: 0.9 },
    },
  },
  {
    name: "Simple Table explicit mode",
    element: {
      id: "simple-explicit",
      type: "table",
      mode: "simple",
      hidden: false,
      columns: [{ key: "name", label: "Name" }],
      rows: [{ name: "Ada" }],
      style: { color: "#abcdef", className: "local" },
    },
  },
  {
    name: "Structured Table",
    element: {
      id: "structured",
      type: "table",
      mode: "structured",
      hidden: false,
      showHeader: false,
      columns: [{ id: "name", header: { id: "header", children: [] }, width: 120 }],
      rows: [{ id: "row", cells: [{ id: "cell", children: [] }] }],
      style: { background: { color: "#101010" }, headerBackground: "#202020", bodyRowAlternateBackground: "#303030", dividerOpacity: 0.4, className: "local" },
      effect: { opacity: 0.8 },
    },
  },
  {
    name: "Divider horizontal",
    element: { id: "divider-horizontal", type: "divider", hidden: false, orientation: "horizontal", style: { background: { color: "#123456" }, className: "local" } },
  },
  {
    name: "Divider vertical",
    element: { id: "divider-vertical", type: "divider", hidden: false, orientation: "vertical", style: { background: { color: "#123456" }, className: "local" } },
  },
];

describe("Add to Linked Styles effective snapshots", () => {
  it.each(matrix)("preserves the effective shareable state for $name", ({ element }) => {
    const source = presentation(element);
    const original = structuredClone(element);
    const before = effectiveShareableState(source, element);
    const created = createFromSelected(source, element);

    expect(created).not.toBeNull();
    expect(element).toEqual(original);
    const afterPresentation = afterCreation(source, created!);
    expect(effectiveShareableState(afterPresentation, created!.element)).toEqual(before);
  });

  it("keeps the default Divider geometry in the definition", () => {
    const source = presentation(matrix.find(({ name }) => name === "Divider horizontal")!.element);
    const element = source.slides[0]!.elements[0]!;
    if (element.type !== "divider") throw new Error("Expected Divider");
    const created = createLinkedStyleFromDividerElement(source, element, "Divider")!;
    expect(created.presentation.linkedStyles?.[0]).toMatchObject({ layout: { width: "100%", height: 2 }, style: { background: { color: "#123456" } } });
    expect(created.element).toMatchObject({ orientation: "horizontal", linkedStyleId: "divider" });
  });
});
