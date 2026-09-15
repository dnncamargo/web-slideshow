import { z } from "zod";

import {
  ContainerLayoutSchema,
  ElementEffectSchema,
  ElementTypographySchema,
  ElementVisualStyleSchema,
  TopicsLayoutSchema,
} from "./element-properties";
import { ColorValueSchema } from "./palette";
import { TopicMarkerStyleSchema } from "./elements";

const NonEmptyTrimmedStringSchema = z.string().trim().min(1);

/**
 * The visual vocabulary shared by Containers, excluding runtime CSS hooks.
 */
export const LinkedContainerStyleVisualSchema = ElementVisualStyleSchema.omit({
  className: true,
});

export type LinkedContainerStyleVisual = z.infer<
  typeof LinkedContainerStyleVisualSchema
>;

export type LinkedContainerStyle = {
  id: string;
  name: string;
  layout?: z.infer<typeof ContainerLayoutSchema> | undefined;
  style?: LinkedContainerStyleVisual | undefined;
  typography?: z.infer<typeof ElementTypographySchema> | undefined;
  effect?: z.infer<typeof ElementEffectSchema> | undefined;
};

export type LinkedTopicsStyle = {
  target: "topics";
  id: string;
  name: string;
  kind?: "unordered" | "ordered" | undefined;
  layout?: (z.infer<typeof TopicsLayoutSchema> & { children?: never; flexShrink?: never; overflow?: never }) | undefined;
  rootMarkerStyle?: z.infer<typeof TopicMarkerStyleSchema> | undefined;
  markerColor?: z.infer<typeof ColorValueSchema> | undefined;
  itemGap?: number | undefined;
  style?: never | undefined;
  typography?: never | undefined;
  effect?: never | undefined;
};

export type LinkedStyle = LinkedContainerStyle | LinkedTopicsStyle;

function hasAuthoredLeaf(value: unknown): boolean {
  if (value === undefined) {
    return false;
  }

  if (value === null || typeof value !== "object") {
    return true;
  }

  if (Array.isArray(value)) {
    return value.some(hasAuthoredLeaf);
  }

  return Object.values(value).some(hasAuthoredLeaf);
}

export const LinkedContainerStyleSchema: z.ZodType<LinkedContainerStyle> = z
  .object({
    id: NonEmptyTrimmedStringSchema,
    name: NonEmptyTrimmedStringSchema,
    layout: ContainerLayoutSchema.optional(),
    style: LinkedContainerStyleVisualSchema.optional(),
    typography: ElementTypographySchema.optional(),
    effect: ElementEffectSchema.optional(),
  })
  .strict()
  .refine(
    (style) =>
      hasAuthoredLeaf(style.layout) ||
      hasAuthoredLeaf(style.style) ||
      hasAuthoredLeaf(style.typography) ||
      hasAuthoredLeaf(style.effect),
    { message: "Linked container style cannot be empty." },
  );

export const LinkedTopicsStyleSchema: z.ZodType<LinkedTopicsStyle> = z
  .object({
    target: z.literal("topics"),
    id: NonEmptyTrimmedStringSchema,
    name: NonEmptyTrimmedStringSchema,
    kind: z.enum(["unordered", "ordered"]).optional(),
    layout: TopicsLayoutSchema.optional(),
    rootMarkerStyle: TopicMarkerStyleSchema.optional(),
    markerColor: ColorValueSchema.optional(),
    itemGap: z.number().min(0).optional(),
  })
  .strict()
  .refine(
    (style) =>
      hasAuthoredLeaf(style.layout) ||
      hasAuthoredLeaf(style.kind) ||
      hasAuthoredLeaf(style.rootMarkerStyle) ||
      hasAuthoredLeaf(style.markerColor) ||
      hasAuthoredLeaf(style.itemGap),
    { message: "Linked topics style cannot be empty." },
  );

export const LinkedStyleSchema: z.ZodType<LinkedStyle> = z.union([
  LinkedContainerStyleSchema,
  LinkedTopicsStyleSchema,
]);

export const LinkedContainerStylesSchema: z.ZodType<LinkedStyle[]> = z
  .array(LinkedStyleSchema)
  .superRefine((styles, context) => {
    const ids = new Set<string>();

    styles.forEach((style, index) => {
      if (ids.has(style.id)) {
        context.addIssue({
          code: "custom",
          path: [index, "id"],
          message: "Linked container style IDs must be unique.",
        });
      }
      ids.add(style.id);
    });
  });

export type LinkedContainerStyles = z.infer<typeof LinkedContainerStylesSchema>;
