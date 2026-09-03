import { z } from "zod";

import {
  DirectionSchema,
  DistributionSchema,
  HorizontalAlignmentSchema,
  LayoutModeSchema,
  LengthSchema,
  OverflowSchema,
  VerticalAlignmentSchema,
} from "./primitives";
import { ColorValueSchema } from "./palette";
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

const PositionedLayoutFieldsSchema = z.object({
  position: z.literal("absolute").optional(),
  top: LengthSchema.optional(),
  right: LengthSchema.optional(),
  bottom: LengthSchema.optional(),
  left: LengthSchema.optional(),
}).strict();

function requireAbsoluteEdges(
  layout: z.infer<typeof PositionedLayoutFieldsSchema>,
  context: z.RefinementCtx,
): void {
  const hasAuthoredEdge =
    layout.top !== undefined ||
    layout.right !== undefined ||
    layout.bottom !== undefined ||
    layout.left !== undefined;

  if (hasAuthoredEdge && layout.position !== "absolute") {
    context.addIssue({
      code: "custom",
      path: ["position"],
      message: "Authored edge offsets require layout.position to be absolute.",
    });
  }
}

export const PositionedElementLayoutSchema = PositionedLayoutFieldsSchema.superRefine(
  requireAbsoluteEdges,
);

export type PositionedElementLayout = z.infer<
  typeof PositionedElementLayoutSchema
>;

export const TextLayoutSchema = PositionedLayoutFieldsSchema.superRefine(
  requireAbsoluteEdges,
);

export type TextLayout = z.infer<typeof TextLayoutSchema>;

export const ImageLayoutSchema = PositionedLayoutFieldsSchema.extend({
  width: LengthSchema.optional(),
  height: LengthSchema.optional(),
}).strict().superRefine(requireAbsoluteEdges);

export type ImageLayout = z.infer<typeof ImageLayoutSchema>;

export const ImageVisualStyleSchema = z.object({
  border: BorderSchema.optional(),
  borderRadius: LengthSchema.optional(),
  className: z.string().optional(),
}).strict();

export type ImageVisualStyle = z.infer<typeof ImageVisualStyleSchema>;

export const ResizablePositionedLayoutSchema = z.object({
  width: LengthSchema.optional(),
  height: LengthSchema.optional(),
  position: z.literal("absolute").optional(),
  top: LengthSchema.optional(),
  right: LengthSchema.optional(),
  bottom: LengthSchema.optional(),
  left: LengthSchema.optional(),
}).strict().superRefine(requireAbsoluteEdges);

export type ResizablePositionedLayout = z.infer<typeof ResizablePositionedLayoutSchema>;

const SurfaceBackgroundSchema = z.object({
  color: ColorValueSchema.optional(),
}).strict();

export const SurfaceVisualStyleSchema = z.object({
  background: SurfaceBackgroundSchema.optional(),
  border: BorderSchema.optional(),
  borderRadius: LengthSchema.optional(),
  className: z.string().optional(),
}).strict();

export type SurfaceVisualStyle = z.infer<typeof SurfaceVisualStyleSchema>;

export const GradientSurfaceBackgroundSchema = z.object({
  color: ColorValueSchema.optional(),
  gradient: GradientSchema.optional(),
}).strict();

export type GradientSurfaceBackground = z.infer<
  typeof GradientSurfaceBackgroundSchema
>;

export const GradientSurfaceVisualStyleSchema = z.object({
  background: GradientSurfaceBackgroundSchema.optional(),
  border: BorderSchema.optional(),
  borderRadius: LengthSchema.optional(),
  className: z.string().optional(),
}).strict();

export type GradientSurfaceVisualStyle = z.infer<
  typeof GradientSurfaceVisualStyleSchema
>;

export const BlocksVisualStyleSchema = z.object({
  background: GradientSurfaceBackgroundSchema.optional(),
  border: BorderSchema.optional(),
  borderRadius: LengthSchema.optional(),
  className: z.string().optional(),
  statementColor: ColorValueSchema.optional(),
  scopeColor: ColorValueSchema.optional(),
  logicColor: ColorValueSchema.optional(),
}).strict();

export type BlocksVisualStyle = z.infer<typeof BlocksVisualStyleSchema>;

export const ElementBackgroundSchema = z
  .object({
    color: ColorValueSchema.optional(),
    gradient: GradientSchema.optional(),
    pattern: BackgroundPatternSchema.optional(),
  })
  .strict();

export type ElementBackground = z.infer<typeof ElementBackgroundSchema>;

export const ElementVisualStyleSchema = z
  .object({
    color: ColorValueSchema.optional(),
    background: ElementBackgroundSchema.optional(),
    border: BorderSchema.optional(),
    borderRadius: LengthSchema.optional(),
    className: z.string().optional(),
  })
  .strict();

export type ElementVisualStyle = z.infer<typeof ElementVisualStyleSchema>;

export const TextVisualBackgroundSchema = z.object({
  color: ColorValueSchema.optional(),
  gradient: GradientSchema.optional(),
}).strict();

export type TextVisualBackground = z.infer<typeof TextVisualBackgroundSchema>;

export const TextVisualStyleSchema = z.object({
  color: ColorValueSchema.optional(),
  background: TextVisualBackgroundSchema.optional(),
  border: BorderSchema.optional(),
  borderRadius: LengthSchema.optional(),
  className: z.string().optional(),
}).strict();

export type TextVisualStyle = z.infer<typeof TextVisualStyleSchema>;

const TypographyStyleFields = {
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
};

export const TypographyStylePropertiesSchema = z
  .object(TypographyStyleFields)
  .strict();

export type TypographyStyleProperties = z.infer<
  typeof TypographyStylePropertiesSchema
>;

export const TextStyleTypographyPropertiesSchema = z
  .object({
    ...TypographyStyleFields,
    textDecorationColor: ColorValueSchema.optional(),
    textStroke: TextStrokeSchema.optional(),
  })
  .strict();

export type TextStyleTypographyProperties = z.infer<
  typeof TextStyleTypographyPropertiesSchema
>;

export const TextStyleVisualPropertiesSchema = z.object({
  color: ColorValueSchema.optional(),
}).strict();

export type TextStyleVisualProperties = z.infer<
  typeof TextStyleVisualPropertiesSchema
>;

export const ElementTypographySchema = z
  .object({
    ...TypographyStyleFields,
    textDecorationColor: ColorValueSchema.optional(),
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

export const ContainerChildrenFitSchema = z
  .object({
    mode: z.enum(["contain", "cover", "fill"]),
    sourceWidth: z.number().finite().gt(0),
    sourceHeight: z.number().finite().gt(0),
  })
  .strict();

export type ContainerChildrenFit = z.infer<
  typeof ContainerChildrenFitSchema
>;

export const ContainerChildrenLayoutSchema = z
  .object({
    mode: LayoutModeSchema.optional(),
    direction: DirectionSchema.optional(),
    gap: LengthSchema.optional(),
    distribution: DistributionSchema.optional(),
    horizontalAlign: HorizontalAlignmentSchema.optional(),
    verticalAlign: VerticalAlignmentSchema.optional(),
    fit: ContainerChildrenFitSchema.optional(),
  })
  .strict();

export type ContainerChildrenLayout = z.infer<
  typeof ContainerChildrenLayoutSchema
>;

export const ContainerLayoutSchema = ElementLayoutSchema.extend({
  flexShrink: z.literal(0).optional(),
  children: ContainerChildrenLayoutSchema.optional(),
});

export const DividerLayoutSchema = z.object({
  width: LengthSchema.optional(),
  height: LengthSchema.optional(),
  ...PositionedLayoutFieldsSchema.shape,
}).strict().superRefine(requireAbsoluteEdges);

export const DividerVisualStyleSchema = z.object({
  background: z.object({ color: ColorValueSchema.optional() }).strict().optional(),
  borderRadius: LengthSchema.optional(),
  className: z.string().optional(),
}).strict();

export const DividerEffectSchema = z.object({
  opacity: z.number().min(0).max(1).optional(),
}).strict();

export const TopicsLayoutSchema = PositionedLayoutFieldsSchema.superRefine(
  requireAbsoluteEdges,
);

export const TopicsVisualStyleSchema = z.object({
  color: ColorValueSchema.optional(),
  className: z.string().optional(),
}).strict();

export const TopicsTypographySchema = z
  .object(TypographyStyleFields)
  .strict();

export type DividerLayout = z.infer<typeof DividerLayoutSchema>;
export type DividerVisualStyle = z.infer<typeof DividerVisualStyleSchema>;
export type DividerEffect = z.infer<typeof DividerEffectSchema>;
export type TopicsLayout = z.infer<typeof TopicsLayoutSchema>;
export type TopicsVisualStyle = z.infer<typeof TopicsVisualStyleSchema>;
export type TopicsTypography = z.infer<typeof TopicsTypographySchema>;

export type ContainerLayout = z.infer<typeof ContainerLayoutSchema>;
