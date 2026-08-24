import { z } from "zod";

import {
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
