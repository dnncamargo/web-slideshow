import type { CSSProperties } from "react";

import { normalizeColor, parseColor } from "@powershow/document-schema";

import type { CustomLibraryElementRecipe } from "./custom-library-recipe";

export type CustomLibraryPreviewType = CustomLibraryElementRecipe["type"];

export interface CustomLibraryStylePreviewModel {
  type: CustomLibraryPreviewType;
  style?: CSSProperties;
  textStyle?: CSSProperties;
  hasChildren?: boolean;
}

const previewTypes: ReadonlySet<CustomLibraryPreviewType> = new Set([
  "text", "image", "gallery", "code", "terminal", "table", "chart",
  "interactive", "divider", "embed", "blocks", "scripted", "topics", "container",
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function propertiesByPath(recipe: CustomLibraryElementRecipe): ReadonlyMap<string, unknown> {
  return new Map(recipe.properties.map((property) => [property.path, property.value]));
}

function safeColor(value: unknown): string | undefined {
  return typeof value === "string" && parseColor(value) !== undefined
    ? normalizeColor(value)
    : undefined;
}

function safeLength(value: unknown, min: number, max: number): number | undefined {
  let pixels: number;
  if (typeof value === "number") {
    pixels = value;
  } else if (typeof value === "string") {
    const match = /^\s*([+-]?(?:\d+(?:\.\d*)?|\.\d+))\s*(px|rem|em)?\s*$/i.exec(value);
    if (!match) return undefined;
    const amount = Number(match[1]);
    const unit = match[2]?.toLowerCase() ?? "px";
    pixels = unit === "rem" || unit === "em" ? amount * 16 : amount;
  } else {
    return undefined;
  }
  return Number.isFinite(pixels) ? Math.min(max, Math.max(min, pixels)) : undefined;
}

function safeOpacity(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.min(1, Math.max(0, value))
    : undefined;
}

function safeFontFamily(value: unknown): string | undefined {
  if (typeof value !== "string" || !/^[\w -]{1,80}$/u.test(value.trim())) return undefined;
  return `"${value.trim()}"`;
}

function safeTextAlign(value: unknown): CSSProperties["textAlign"] {
  return value === "left" || value === "center" || value === "right" || value === "justify" ? value : undefined;
}

function safeTextTransform(value: unknown): CSSProperties["textTransform"] {
  return value === "uppercase" || value === "lowercase" || value === "capitalize" || value === "none" ? value : undefined;
}

function safeTextDecorationLine(value: unknown): CSSProperties["textDecorationLine"] {
  return value === "underline" || value === "overline" || value === "line-through" || value === "none" ? value : undefined;
}

function safeBorder(value: unknown): CSSProperties["border"] {
  if (!isRecord(value)) return undefined;
  const width = safeLength(value.width, 0, 4);
  const color = safeColor(value.color);
  const borderStyle = value.style === "dashed" || value.style === "dotted" || value.style === "solid"
    ? value.style
    : "solid";
  return width !== undefined && color !== undefined ? `${width}px ${borderStyle} ${color}` : undefined;
}

function safeShadow(value: unknown): string | undefined {
  if (!isRecord(value)) return undefined;
  const x = safeLength(value.x, -8, 8);
  const y = safeLength(value.y, -8, 8);
  const blur = safeLength(value.blur, 0, 12);
  const spread = value.spread === undefined ? 0 : safeLength(value.spread, -4, 4);
  const color = safeColor(value.color);
  if (x === undefined || y === undefined || blur === undefined || spread === undefined || color === undefined) {
    return undefined;
  }
  return `${value.inset === true ? "inset " : ""}${x}px ${y}px ${blur}px ${spread}px ${color}`;
}

function textModel(recipe: CustomLibraryElementRecipe): CustomLibraryStylePreviewModel {
  const properties = propertiesByPath(recipe);
  const typography = (path: string) => properties.get(`typography.${path}`);
  const textStyle: CSSProperties = {
    color: safeColor(properties.get("style.color")),
    fontFamily: safeFontFamily(typography("fontFamily")),
    fontWeight: typeof typography("fontWeight") === "number" && Number.isInteger(typography("fontWeight"))
      ? Math.min(900, Math.max(100, typography("fontWeight") as number))
      : undefined,
    fontStyle: typography("fontStyle") === "italic" ? "italic" : typography("fontStyle") === "normal" ? "normal" : undefined,
    fontSize: safeLength(typography("fontSize"), 16, 32),
    textAlign: safeTextAlign(typography("textAlign")) ?? "left",
    textTransform: safeTextTransform(typography("textTransform")),
    textDecorationLine: safeTextDecorationLine(typography("textDecorationLine")),
    opacity: safeOpacity(properties.get("effect.opacity")),
  };
  const stroke = typography("textStroke");
  if (isRecord(stroke)) {
    const width = safeLength(stroke.width, 0.5, 4);
    const color = safeColor(stroke.color);
    if (width !== undefined && color !== undefined) textStyle.WebkitTextStroke = `${width}px ${color}`;
  }
  return { type: "text", textStyle };
}

function containerModel(recipe: CustomLibraryElementRecipe): CustomLibraryStylePreviewModel {
  const properties = propertiesByPath(recipe);
  const background = properties.get("style.background.color");
  const style: CSSProperties = {
    backgroundColor: safeColor(background),
    border: safeBorder(properties.get("style.border")),
    borderRadius: safeLength(properties.get("style.borderRadius"), 0, 18),
    boxShadow: safeShadow(properties.get("effect.shadow")),
    opacity: safeOpacity(properties.get("effect.opacity")),
  };
  return { type: "container", style, hasChildren: recipe.children !== undefined && recipe.children.length > 0 };
}

export function createCustomLibraryStylePreviewModel(
  recipe: CustomLibraryElementRecipe,
): CustomLibraryStylePreviewModel {
  const type = previewTypes.has(recipe.type) ? recipe.type : "container";
  if (type === "text") return textModel(recipe);
  if (type === "container") return containerModel(recipe);
  return { type };
}
