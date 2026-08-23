import { z } from "zod";

import {
  ColorSchema,
  DirectionSchema,
  DistributionSchema,
  ElementIdSchema,
  HorizontalAlignmentSchema,
  LayoutModeSchema,
  LengthSchema,
  OverflowSchema,
  VerticalAlignmentSchema,
} from "./primitives";

import { ElementLinkSchema } from "./links";

import {
  BackgroundPatternSchema,
  BorderSchema,
  GradientSchema,
  ShadowSchema,
  TextStrokeSchema,
} from "./visual";

import {
  LineHeightSchema,
  OverflowWrapSchema,
  TextAlignSchema,
  TextDecorationLineSchema,
  TextTransformSchema,
  TextWrapStyleSchema,
  WhiteSpaceSchema,
} from "./style";

import {
  FontFamilySchema,
  FontStyleSchema,
  FontWeightSchema,
} from "./resources";

import {
  PowerShowElementSchema,
  type ContainerElement,
  type PowerShowElement,
} from "./elements";

// ============================================================
// BACKGROUND (/CANONICAL V2)
//
// The Container visual surface groups color, gradient, and pattern
// without imposing XOR. Gradient and Pattern may coexist.
// ============================================================

export const V2ContainerBackgroundSchema = z
  .object({
    color: ColorSchema.optional(),
    gradient: GradientSchema.optional(),
    pattern: BackgroundPatternSchema.optional(),
  })
  .strict();

export type V2ContainerBackground = z.infer<
  typeof V2ContainerBackgroundSchema
>;

// ============================================================
// STYLE
//
// Container `style` means visual surface. Layout dimensions,
// spacing, overflow, and positioning live in `layout`. Typographic
// capability lives in `typography`. Effects live in `effect`.
// ============================================================

export const V2ContainerStyleSchema = z
  .object({
    color: ColorSchema.optional(),
    background: V2ContainerBackgroundSchema.optional(),
    border: BorderSchema.optional(),
    borderRadius: LengthSchema.optional(),
    // Advanced CSS escape hatch. Remains under semantic review.
    className: z.string().optional(),
  })
  .strict();

export type V2ContainerStyle = z.infer<typeof V2ContainerStyleSchema>;

// ============================================================
// TYPOGRAPHY
//
// Inherited Container typography is a real canonical namespace.
// Descendant effective inheritance is renderer/CSS behavior, not
// persisted schema structure. There is no inheritance object.
// ============================================================

export const V2ContainerTypographySchema = z
  .object({
    fontFamily: FontFamilySchema.optional(),
    fontSize: LengthSchema.optional(),
    fontWeight: FontWeightSchema.optional(),
    fontStyle: FontStyleSchema.optional(),
    textAlign: TextAlignSchema.optional(),
    lineHeight: LineHeightSchema.optional(),
    letterSpacing: LengthSchema.optional(),
    textTransform: TextTransformSchema.optional(),
    whiteSpace: WhiteSpaceSchema.optional(),
    textWrapStyle: TextWrapStyleSchema.optional(),
    overflowWrap: OverflowWrapSchema.optional(),
    textDecorationLine: TextDecorationLineSchema.optional(),
    textDecorationColor: ColorSchema.optional(),
    textStroke: TextStrokeSchema.optional(),
  })
  .strict();

export type V2ContainerTypography = z.infer<
  typeof V2ContainerTypographySchema
>;

// ============================================================
// EFFECT
// ============================================================

export const V2ContainerEffectSchema = z
  .object({
    opacity: z.number().min(0).max(1).optional(),
    shadow: ShadowSchema.optional(),
  })
  .strict();

export type V2ContainerEffect = z.infer<typeof V2ContainerEffectSchema>;

// ============================================================
// CHILD LAYOUT
//
// `layout.children` organizes THIS Container's children.
// Effective defaults when absent: mode = "flow", direction = "column".
// Those effective defaults are NOT serialized.
// ============================================================

export const V2ContainerChildrenLayoutSchema = z
  .object({
    mode: LayoutModeSchema.optional(),
    direction: DirectionSchema.optional(),
    gap: LengthSchema.optional(),
    distribution: DistributionSchema.optional(),
    horizontalAlign: HorizontalAlignmentSchema.optional(),
    verticalAlign: VerticalAlignmentSchema.optional(),
  })
  .strict();

export type V2ContainerChildrenLayout = z.infer<
  typeof V2ContainerChildrenLayoutSchema
>;

// ============================================================
// LAYOUT
//
// Canonical authored positioning uses direct CSS edge fields.
// Authored position supports ONLY "absolute". Absence means normal
// flow. Relative/static are never authored. Edge offsets are only
// meaningful while position is absolute.
// ============================================================

export const V2ContainerLayoutSchema = z
  .object({
    width: LengthSchema.optional(),
    height: LengthSchema.optional(),

    minWidth: LengthSchema.optional(),
    minHeight: LengthSchema.optional(),

    maxWidth: LengthSchema.optional(),
    maxHeight: LengthSchema.optional(),

    margin: LengthSchema.optional(),
    marginTop: LengthSchema.optional(),
    marginRight: LengthSchema.optional(),
    marginBottom: LengthSchema.optional(),
    marginLeft: LengthSchema.optional(),

    padding: LengthSchema.optional(),
    paddingTop: LengthSchema.optional(),
    paddingRight: LengthSchema.optional(),
    paddingBottom: LengthSchema.optional(),
    paddingLeft: LengthSchema.optional(),

    overflow: OverflowSchema.optional(),

    position: z.literal("absolute").optional(),
    top: LengthSchema.optional(),
    right: LengthSchema.optional(),
    bottom: LengthSchema.optional(),
    left: LengthSchema.optional(),

    children: V2ContainerChildrenLayoutSchema.optional(),
  })
  .strict()
  .superRefine((layout, context) => {
    const hasAuthoredEdge =
      layout.top !== undefined ||
      layout.right !== undefined ||
      layout.bottom !== undefined ||
      layout.left !== undefined;

    if (hasAuthoredEdge && layout.position !== "absolute") {
      context.addIssue({
        code: "custom",
        path: ["position"],
        message:
          "Authored edge offsets require layout.position to be absolute.",
      });
    }
  });

export type V2ContainerLayout = z.infer<typeof V2ContainerLayoutSchema>;

// ============================================================
// CONTAINER ELEMENT
//
// The candidate remains type:"container" but intentionally lives
// OUTSIDE the production PowerShowElement union until integrated
// cutover. Recursive candidate children may nest; legacy
// non-Container PowerShow elements remain usable as temporary
// parity children.
// ============================================================

export type V2ContainerElement = {
  id: string;
  type: "container";
  role?:
    | "main"
    | "header"
    | "footer"
    | "row"
    | "column"
    | "content"
    | undefined;
  hidden: boolean;
  layout?: V2ContainerLayout | undefined;
  style?: V2ContainerStyle | undefined;
  typography?: V2ContainerTypography | undefined;
  effect?: V2ContainerEffect | undefined;
  link?: z.infer<typeof ElementLinkSchema> | undefined;
  children: V2ContainerChild[];
};

export type LegacyNonContainerElement = Exclude<
  PowerShowElement,
  ContainerElement
>;

export type V2ContainerChild =
  | V2ContainerElement
  | LegacyNonContainerElement;

const LegacyNonContainerElementSchema: z.ZodType<LegacyNonContainerElement> =
  z.lazy(() =>
    PowerShowElementSchema.refine(
      (element): element is LegacyNonContainerElement =>
        element.type !== "container",
      {
        message:
          "Legacy Container elements are not valid V2 Container children.",
      },
    ),
  );

const V2ContainerChildSchema: z.ZodType<V2ContainerChild> = z.lazy(() =>
  z.union([V2ContainerSchema, LegacyNonContainerElementSchema]),
);

/**
 * Parallel candidate schema only. It is intentionally NOT part of
 * PowerShowElementSchema and therefore cannot become normal persisted
 * input during this semantic freeze checkpoint.
 */
export const V2ContainerSchema: z.ZodType<V2ContainerElement> = z.lazy(() =>
  z
    .object({
      id: ElementIdSchema,
      type: z.literal("container"),
      role: z
        .enum(["main", "header", "footer", "row", "column", "content"])
        .optional(),
      hidden: z.boolean().default(false),
      layout: V2ContainerLayoutSchema.optional(),
      style: V2ContainerStyleSchema.optional(),
      typography: V2ContainerTypographySchema.optional(),
      effect: V2ContainerEffectSchema.optional(),
      link: ElementLinkSchema.optional(),
      children: z.array(V2ContainerChildSchema),
    })
    .strict(),
);

export function isV2ContainerElement(
  element: V2ContainerChild,
): element is V2ContainerElement {
  return element.type === "container";
}