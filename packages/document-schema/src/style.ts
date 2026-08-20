import { z } from "zod";

import {
  ColorSchema,
  HorizontalAlignmentSchema,
  LengthSchema,
  OverflowSchema,
  PositionAnchorSchema,
  PositionSchema,
  SignedLengthSchema,
  VerticalAlignmentSchema,
} from "./primitives";

import {
  BorderSchema,
  GradientSchema,
  ShadowSchema,
  TextStrokeSchema,
} from "./visual";
import {
  FontFamilySchema,
  FontStyleSchema,
  FontWeightSchema,
} from "./resources";

export {
  FontStyleSchema,
  FontWeightSchema,
};

export const TextAlignSchema = z.enum([
  "left",
  "center",
  "right",
  "justify",
]);

export const LineHeightSchema = z.number().positive();

export const TextTransformSchema = z.enum([
  "none",
  "uppercase",
  "lowercase",
  "capitalize",
]);

export const WhiteSpaceSchema = z.enum([
  "normal",
  "nowrap",
  "pre-line",
  "pre-wrap",
]);

export const TextWrapStyleSchema = z.enum([
  "auto",
  "balance",
  "pretty",
]);

export const OverflowWrapSchema = z.enum([
  "normal",
  "break-word",
  "anywhere",
]);

export const TextDecorationLineSchema = z.enum([
  "none",
  "underline",
  "overline",
  "line-through",
]);

export const ElementPlacementSchema = z.object({
  mode: z.enum(["flow", "absolute"]),
  anchor: PositionAnchorSchema.optional(),
  offsetX: SignedLengthSchema.optional(),
  offsetY: SignedLengthSchema.optional(),
});

export type ElementPlacement = z.infer<typeof ElementPlacementSchema>;

export const ElementStyleSchema = z.object({
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

  position: PositionSchema.optional(),

  placement: ElementPlacementSchema.optional(),

  top: LengthSchema.optional(),
  right: LengthSchema.optional(),
  bottom: LengthSchema.optional(),
  left: LengthSchema.optional(),

  background: ColorSchema.optional(),
  color: ColorSchema.optional(),
  textDecorationColor: ColorSchema.optional(),

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

  borderRadius: LengthSchema.optional(),

  opacity: z.number().min(0).max(1).optional(),

  overflow: OverflowSchema.optional(),

  horizontalAlign: HorizontalAlignmentSchema.optional(),
  verticalAlign: VerticalAlignmentSchema.optional(),

  className: z.string().optional(),

  backgroundGradient: GradientSchema.optional(),

  border: BorderSchema.optional(),

  shadow: ShadowSchema.optional(),

  textStroke: TextStrokeSchema.optional(),
});

export type ElementStyle = z.infer<typeof ElementStyleSchema>;
