import { z } from "zod";

import {
  ContainerLayoutSchema,
  CodeTypographySchema,
  CodeVisualStyleSchema,
  ElementEffectSchema,
  ElementTypographySchema,
  ElementVisualStyleSchema,
  DividerEffectSchema,
  DividerLayoutSchema,
  DividerVisualStyleSchema,
  ResizablePositionedLayoutSchema,
  SimpleTableTypographySchema,
  SimpleTableVisualStyleSchema,
  StructuredTableVisualStyleSchema,
  TerminalTitleTypographySchema,
  TerminalTypographySchema,
  TerminalVisualStyleSchema,
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

/** Linked visual styles exclude runtime CSS hooks, which remain local to elements. */
export const LinkedCodeStyleVisualSchema = CodeVisualStyleSchema.omit({
  className: true,
});

export const LinkedTerminalStyleVisualSchema = TerminalVisualStyleSchema.omit({
  className: true,
});

export const LinkedSimpleTableStyleVisualSchema = SimpleTableVisualStyleSchema.omit({
  className: true,
});

export const LinkedStructuredTableStyleVisualSchema = StructuredTableVisualStyleSchema.omit({
  className: true,
});

export const LinkedDividerStyleVisualSchema = DividerVisualStyleSchema.omit({
  className: true,
});

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

export type LinkedCodeStyle = {
  target: "code";
  id: string;
  name: string;
  layout?: z.infer<typeof ResizablePositionedLayoutSchema> | undefined;
  style?: z.infer<typeof LinkedCodeStyleVisualSchema> | undefined;
  typography?: z.infer<typeof CodeTypographySchema> | undefined;
  effect?: z.infer<typeof ElementEffectSchema> | undefined;
};

export const LinkedCodeStyleSchema: z.ZodType<LinkedCodeStyle> = z
  .object({
    target: z.literal("code"),
    id: NonEmptyTrimmedStringSchema,
    name: NonEmptyTrimmedStringSchema,
    layout: ResizablePositionedLayoutSchema.optional(),
    style: LinkedCodeStyleVisualSchema.optional(),
    typography: CodeTypographySchema.optional(),
    effect: ElementEffectSchema.optional(),
  })
  .strict()
  .refine(
    (style) => hasAuthoredLeaf(style.layout) || hasAuthoredLeaf(style.style) ||
      hasAuthoredLeaf(style.typography) || hasAuthoredLeaf(style.effect),
    { message: "Linked code style cannot be empty." },
  );

export type LinkedTerminalStyle = {
  target: "terminal";
  id: string;
  name: string;
  layout?: z.infer<typeof ResizablePositionedLayoutSchema> | undefined;
  style?: z.infer<typeof LinkedTerminalStyleVisualSchema> | undefined;
  typography?: z.infer<typeof TerminalTypographySchema> | undefined;
  titleTypography?: z.infer<typeof TerminalTitleTypographySchema> | undefined;
  effect?: z.infer<typeof ElementEffectSchema> | undefined;
};

export const LinkedTerminalStyleSchema: z.ZodType<LinkedTerminalStyle> = z
  .object({
    target: z.literal("terminal"),
    id: NonEmptyTrimmedStringSchema,
    name: NonEmptyTrimmedStringSchema,
    layout: ResizablePositionedLayoutSchema.optional(),
    style: LinkedTerminalStyleVisualSchema.optional(),
    typography: TerminalTypographySchema.optional(),
    titleTypography: TerminalTitleTypographySchema.optional(),
    effect: ElementEffectSchema.optional(),
  })
  .strict()
  .refine(
    (style) => hasAuthoredLeaf(style.layout) || hasAuthoredLeaf(style.style) ||
      hasAuthoredLeaf(style.typography) || hasAuthoredLeaf(style.titleTypography) ||
      hasAuthoredLeaf(style.effect),
    { message: "Linked terminal style cannot be empty." },
  );

export type LinkedSimpleTableStyle = {
  target: "table";
  mode: "simple";
  id: string;
  name: string;
  layout?: z.infer<typeof ResizablePositionedLayoutSchema> | undefined;
  style?: z.infer<typeof LinkedSimpleTableStyleVisualSchema> | undefined;
  typography?: z.infer<typeof SimpleTableTypographySchema> | undefined;
  effect?: z.infer<typeof ElementEffectSchema> | undefined;
};

export const LinkedSimpleTableStyleSchema: z.ZodType<LinkedSimpleTableStyle> = z
  .object({
    target: z.literal("table"),
    mode: z.literal("simple"),
    id: NonEmptyTrimmedStringSchema,
    name: NonEmptyTrimmedStringSchema,
    layout: ResizablePositionedLayoutSchema.optional(),
    style: LinkedSimpleTableStyleVisualSchema.optional(),
    typography: SimpleTableTypographySchema.optional(),
    effect: ElementEffectSchema.optional(),
  })
  .strict()
  .refine(
    (style) => hasAuthoredLeaf(style.layout) || hasAuthoredLeaf(style.style) ||
      hasAuthoredLeaf(style.typography) || hasAuthoredLeaf(style.effect),
    { message: "Linked simple table style cannot be empty." },
  );

export type LinkedStructuredTableStyle = {
  target: "table";
  mode: "structured";
  id: string;
  name: string;
  layout?: z.infer<typeof ResizablePositionedLayoutSchema> | undefined;
  style?: z.infer<typeof LinkedStructuredTableStyleVisualSchema> | undefined;
  effect?: z.infer<typeof ElementEffectSchema> | undefined;
};

export const LinkedStructuredTableStyleSchema: z.ZodType<LinkedStructuredTableStyle> = z
  .object({
    target: z.literal("table"),
    mode: z.literal("structured"),
    id: NonEmptyTrimmedStringSchema,
    name: NonEmptyTrimmedStringSchema,
    layout: ResizablePositionedLayoutSchema.optional(),
    style: LinkedStructuredTableStyleVisualSchema.optional(),
    effect: ElementEffectSchema.optional(),
  })
  .strict()
  .refine(
    (style) => hasAuthoredLeaf(style.layout) || hasAuthoredLeaf(style.style) ||
      hasAuthoredLeaf(style.effect),
    { message: "Linked structured table style cannot be empty." },
  );

export type LinkedTableStyle = LinkedSimpleTableStyle | LinkedStructuredTableStyle;

export type LinkedDividerStyle = {
  target: "divider";
  id: string;
  name: string;
  layout?: z.infer<typeof DividerLayoutSchema> | undefined;
  style?: z.infer<typeof LinkedDividerStyleVisualSchema> | undefined;
  effect?: z.infer<typeof DividerEffectSchema> | undefined;
};

export const LinkedDividerStyleSchema: z.ZodType<LinkedDividerStyle> = z
  .object({
    target: z.literal("divider"),
    id: NonEmptyTrimmedStringSchema,
    name: NonEmptyTrimmedStringSchema,
    layout: DividerLayoutSchema.optional(),
    style: LinkedDividerStyleVisualSchema.optional(),
    effect: DividerEffectSchema.optional(),
  })
  .strict()
  .refine(
    (style) => hasAuthoredLeaf(style.layout) || hasAuthoredLeaf(style.style) ||
      hasAuthoredLeaf(style.effect),
    { message: "Linked divider style cannot be empty." },
  );

export type LinkedStyle =
  | LinkedContainerStyle
  | LinkedTopicsStyle
  | LinkedCodeStyle
  | LinkedTerminalStyle
  | LinkedSimpleTableStyle
  | LinkedStructuredTableStyle
  | LinkedDividerStyle;

export function isLinkedContainerStyle(style: LinkedStyle): style is LinkedContainerStyle {
  return !("target" in style);
}

export const LinkedStyleSchema: z.ZodType<LinkedStyle> = z.union([
  LinkedContainerStyleSchema,
  LinkedTopicsStyleSchema,
  LinkedCodeStyleSchema,
  LinkedTerminalStyleSchema,
  LinkedSimpleTableStyleSchema,
  LinkedStructuredTableStyleSchema,
  LinkedDividerStyleSchema,
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
