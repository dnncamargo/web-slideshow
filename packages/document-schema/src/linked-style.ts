import { z } from "zod";

import {
  ContainerLayoutSchema,
  ElementEffectSchema,
  ElementTypographySchema,
  ElementVisualStyleSchema,
} from "./element-properties";

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

export const LinkedContainerStyleSchema = z
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

export type LinkedContainerStyle = z.infer<typeof LinkedContainerStyleSchema>;

export const LinkedContainerStylesSchema = z
  .array(LinkedContainerStyleSchema)
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
