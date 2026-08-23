import { z } from "zod";

import {
  ContainerLayoutSchema,
  ElementEffectSchema,
  ElementTypographySchema,
  ElementVisualStyleSchema,
} from "./element-properties";
import { ElementLinkSchema } from "./links";
import {
  PowerShowElementSchema,
  type ContainerElement,
  type PowerShowElement,
} from "./elements";

export type ProductionNonContainerElement = Exclude<
  PowerShowElement,
  ContainerElement
>;

export type CandidateContainerElement = {
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
  layout?: z.infer<typeof ContainerLayoutSchema> | undefined;
  style?: z.infer<typeof ElementVisualStyleSchema> | undefined;
  typography?: z.infer<typeof ElementTypographySchema> | undefined;
  effect?: z.infer<typeof ElementEffectSchema> | undefined;
  link?: z.infer<typeof ElementLinkSchema> | undefined;
  children: CandidateContainerChild[];
};

export type CandidateContainerChild =
  | CandidateContainerElement
  | ProductionNonContainerElement;

const ProductionNonContainerElementSchema: z.ZodType<ProductionNonContainerElement> =
  z.lazy(() =>
    PowerShowElementSchema.refine(
      (element): element is ProductionNonContainerElement =>
        element.type !== "container",
      {
        message:
          "Production Container elements are not valid candidate children.",
      },
    ),
  );

const CandidateContainerChildSchema: z.ZodType<CandidateContainerChild> =
  z.lazy(() =>
    z.union([
      CandidateContainerSchema,
      ProductionNonContainerElementSchema,
    ]),
  );

export const CandidateContainerSchema: z.ZodType<CandidateContainerElement> =
  z.lazy(() =>
    z
      .object({
        id: z.string().min(1),
        type: z.literal("container"),
        role: z
          .enum([
            "main",
            "header",
            "footer",
            "row",
            "column",
            "content",
          ])
          .optional(),
        hidden: z.boolean().default(false),
        layout: ContainerLayoutSchema.optional(),
        style: ElementVisualStyleSchema.optional(),
        typography: ElementTypographySchema.optional(),
        effect: ElementEffectSchema.optional(),
        link: ElementLinkSchema.optional(),
        children: z.array(CandidateContainerChildSchema),
      })
      .strict(),
  );

export function isCandidateContainerElement(
  element: CandidateContainerChild,
): element is CandidateContainerElement {
  return element.type === "container";
}
