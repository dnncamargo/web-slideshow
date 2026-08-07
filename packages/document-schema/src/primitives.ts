import { z } from "zod";

export const ElementIdSchema = z.string().min(1);

export type ElementId = z.infer<typeof ElementIdSchema>;

export const LengthSchema = z.union([
  z.number(),
  z.string().min(1),
]);

export type Length = z.infer<typeof LengthSchema>;

export const ColorSchema = z.string().min(1);

export type Color = z.infer<typeof ColorSchema>;

export const HorizontalAlignmentSchema = z.enum([
  "start",
  "center",
  "end",
  "stretch",
]);

export const VerticalAlignmentSchema = z.enum([
  "start",
  "center",
  "end",
  "stretch",
]);

export const DirectionSchema = z.enum([
  "row",
  "column",
]);

export const OverflowSchema = z.enum([
  "visible",
  "hidden",
  "auto",
]);

export const PositionSchema = z.enum([
  "static",
  "relative",
  "absolute",
]);
