import { z } from "zod";

import type { PowerShowElement } from "@powershow/document-schema";

import type { CustomLibraryElementRecipe } from "./custom-library-recipe";
import type { CustomLibraryItemDraft } from "./custom-library-item";

const ELEMENT_TYPE_NAMES = {
  text: true,
  image: true,
  gallery: true,
  code: true,
  terminal: true,
  table: true,
  chart: true,
  interactive: true,
  divider: true,
  embed: true,
  blocks: true,
  scripted: true,
  topics: true,
  container: true,
} satisfies Record<PowerShowElement["type"], true>;

const elementTypeNames = Object.keys(ELEMENT_TYPE_NAMES) as [
  PowerShowElement["type"],
  ...PowerShowElement["type"][],
];

export const ElementRecipePropertySchema = z
  .object({
    path: z
      .string()
      .min(1)
      .refine((path) => path === path.trim(), "Path must be trimmed")
      .refine((path) => path !== "id", "Path must not be id")
      .refine((path) => path !== "type", "Path must not be type"),
    value: z.json(),
  })
  .strict();

export const CustomLibraryElementRecipeSchema: z.ZodType<CustomLibraryElementRecipe> = z
  .lazy(() => z
    .object({
      type: z.enum(elementTypeNames),
      properties: z.array(ElementRecipePropertySchema),
      children: z.array(CustomLibraryElementRecipeSchema).min(1).optional(),
    })
    .strict()
    .superRefine((recipe, context) => {
      const paths = new Set<string>();

      recipe.properties.forEach((property, index) => {
        if (paths.has(property.path)) {
          context.addIssue({
            code: "custom",
            message: "Property paths must be unique within a recipe node",
            path: ["properties", index, "path"],
          });
        }
        paths.add(property.path);

        if (recipe.type === "container" && property.path === "children") {
          context.addIssue({
            code: "custom",
            message: "Container children are structural and cannot be a property",
            path: ["properties", index, "path"],
          });
        }
      });

      if (recipe.children !== undefined && recipe.type !== "container") {
        context.addIssue({
          code: "custom",
          message: "Only container recipes may have children",
          path: ["children"],
        });
      }
    })) as z.ZodType<CustomLibraryElementRecipe>;

export const CustomLibraryItemDraftSchema: z.ZodType<CustomLibraryItemDraft> = z
  .object({
    name: z
      .string()
      .min(1)
      .refine((name) => name === name.trim(), "Name must be trimmed"),
    description: z
      .string()
      .min(1)
      .refine((description) => description === description.trim(), "Description must be trimmed")
      .optional(),
    root: CustomLibraryElementRecipeSchema,
  })
  .strict();

export function parseCustomLibraryItemDraft(
  value: unknown,
): CustomLibraryItemDraft {
  return CustomLibraryItemDraftSchema.parse(value);
}
