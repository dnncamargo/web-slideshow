import { z } from "zod";

import {
  ColorSchema,
  DirectionSchema,
  DistributionSchema,
  HorizontalAlignmentSchema,
  LayoutModeSchema,
  LengthSchema,
  OverflowSchema,
  VerticalAlignmentSchema,
} from "./primitives";
import {
  FontFamilySchema,
  FontStyleSchema,
  FontWeightSchema,
} from "./resources";
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
  BackgroundPatternSchema,
  BorderSchema,
  GradientSchema,
  ShadowSchema,
  TextStrokeSchema,
} from "./visual";

export const ElementLayoutSchema = z
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

export type ElementLayout = z.infer<typeof ElementLayoutSchema>;

export const ElementBackgroundSchema = z
  .object({
    color: ColorSchema.optional(),
    gradient: GradientSchema.optional(),
    pattern: BackgroundPatternSchema.optional(),
  })
  .strict();

export type ElementBackground = z.infer<typeof ElementBackgroundSchema>;

export const ElementVisualStyleSchema = z
  .object({
    color: ColorSchema.optional(),
    background: ElementBackgroundSchema.optional(),
    border: BorderSchema.optional(),
    borderRadius: LengthSchema.optional(),
    className: z.string().optional(),
  })
  .strict();

export type ElementVisualStyle = z.infer<typeof ElementVisualStyleSchema>;

export const ElementTypographySchema = z
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

export type ElementTypography = z.infer<typeof ElementTypographySchema>;

export const ElementEffectSchema = z
  .object({
    opacity: z.number().min(0).max(1).optional(),
    shadow: ShadowSchema.optional(),
  })
  .strict();

export type ElementEffect = z.infer<typeof ElementEffectSchema>;

export const ContainerChildrenLayoutSchema = z
  .object({
    mode: LayoutModeSchema.optional(),
    direction: DirectionSchema.optional(),
    gap: LengthSchema.optional(),
    distribution: DistributionSchema.optional(),
    horizontalAlign: HorizontalAlignmentSchema.optional(),
    verticalAlign: VerticalAlignmentSchema.optional(),
  })
  .strict();

export type ContainerChildrenLayout = z.infer<
  typeof ContainerChildrenLayoutSchema
>;

export const ContainerLayoutSchema = ElementLayoutSchema.extend({
  children: ContainerChildrenLayoutSchema.optional(),
});

export type ContainerLayout = z.infer<typeof ContainerLayoutSchema>;
