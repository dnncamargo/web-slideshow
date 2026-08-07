import { z } from "zod";

import {
  ColorSchema,
  HorizontalAlignmentSchema,
  LengthSchema,
  OverflowSchema,
  PositionSchema,
  VerticalAlignmentSchema,
} from "./primitives";

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

  top: LengthSchema.optional(),
  right: LengthSchema.optional(),
  bottom: LengthSchema.optional(),
  left: LengthSchema.optional(),

  background: ColorSchema.optional(),
  color: ColorSchema.optional(),

  borderRadius: LengthSchema.optional(),

  opacity: z.number().min(0).max(1).optional(),

  overflow: OverflowSchema.optional(),

  horizontalAlign: HorizontalAlignmentSchema.optional(),
  verticalAlign: VerticalAlignmentSchema.optional(),

  className: z.string().optional(),
});

export type ElementStyle =
  z.infer<typeof ElementStyleSchema>;
