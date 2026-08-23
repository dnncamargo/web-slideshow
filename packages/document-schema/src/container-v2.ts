import { z } from "zod";

import {
  DirectionSchema,
  DistributionSchema,
  ElementIdSchema,
  HorizontalAlignmentSchema,
  LayoutModeSchema,
  LengthSchema,
  VerticalAlignmentSchema,
  ColorSchema,
} from "./primitives";
import {
  ElementPlacementSchema,
  ElementStyleSchema,
} from "./style";
import { ElementLinkSchema } from "./links";
import {
  BackgroundPatternSchema,
  BorderSchema,
  GradientSchema,
  ShadowSchema,
} from "./visual";
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

/**
 * Candidate-only background shape for the Container parity harness.
 *
 * This intentionally groups the existing background capabilities without
 * imposing XOR: a base color, gradient, and pattern may coexist.
 */
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

/**
 * Candidate visual surface. Layout, child layout, and effects deliberately
 * live in their own sibling objects below.
 *
 * The inherited text properties remain flat as parity scaffolding because the
 * current generic ElementStyle already makes them observable on Container
 * descendants. Their final V2 semantic responsibility remains unresolved.
 */
export const V2ContainerStyleSchema = z
  .object({
    color: ColorSchema.optional(),
    textDecorationColor: ColorSchema.optional(),

    fontFamily: FontFamilySchema.optional(),
    fontSize: LengthSchema.optional(),
    fontWeight: FontWeightSchema.optional(),
    fontStyle: FontStyleSchema.optional(),
    textAlign: z
      .enum(["left", "center", "right", "justify"])
      .optional(),
    lineHeight: z.number().positive().optional(),
    letterSpacing: LengthSchema.optional(),
    textTransform: z
      .enum(["none", "uppercase", "lowercase", "capitalize"])
      .optional(),
    whiteSpace: z
      .enum(["normal", "nowrap", "pre-line", "pre-wrap"])
      .optional(),
    textWrapStyle: z.enum(["auto", "balance", "pretty"]).optional(),
    overflowWrap: z.enum(["normal", "break-word", "anywhere"]).optional(),
    textDecorationLine: z
      .enum(["none", "underline", "overline", "line-through"])
      .optional(),

    background: V2ContainerBackgroundSchema.optional(),
    border: BorderSchema.optional(),
    borderRadius: LengthSchema.optional(),
    overflow: z.enum(["visible", "hidden", "auto"]).optional(),
    // Preserved for parity only; final className responsibility is unresolved.
    className: z.string().optional(),
    textStroke: ElementStyleSchema.shape.textStroke,
  })
  .strict();

export type V2ContainerStyle = z.infer<typeof V2ContainerStyleSchema>;

export const V2ContainerEffectSchema = z
  .object({
    opacity: z.number().min(0).max(1).optional(),
    shadow: ShadowSchema.optional(),
  })
  .strict();

export type V2ContainerEffect = z.infer<typeof V2ContainerEffectSchema>;

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

    placement: ElementPlacementSchema.optional(),
    children: V2ContainerChildrenLayoutSchema.optional(),
  })
  .strict();

export type V2ContainerLayout = z.infer<typeof V2ContainerLayoutSchema>;

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
 * Parallel candidate schema only. It is intentionally not part of
 * PowerShowElementSchema and therefore cannot become normal persisted input
 * during this parity checkpoint.
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
