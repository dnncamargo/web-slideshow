import { z } from "zod";

import {
  DirectionSchema,
  DistributionSchema,
  ElementIdSchema,
  HorizontalAlignmentSchema,
  LayoutModeSchema,
  LengthSchema,
  ColorSchema,
  VerticalAlignmentSchema,
} from "./primitives";

import {
  ElementStyleSchema,
} from "./style";

import {
  ElementLinkSchema,
  isAbsoluteHttpHref,
} from "./links";

const BaseElementSchema = z.object({
  id: ElementIdSchema,

  style: ElementStyleSchema.optional(),

  hidden: z.boolean().default(false),
});

export const TextRunMarksSchema = z.object({
  bold: z.boolean().optional(),
  italic: z.boolean().optional(),
  underline: z.boolean().optional(),
  code: z.boolean().optional(),
  color: ColorSchema.optional(),
});

export type TextRunMarks =
  z.infer<typeof TextRunMarksSchema>;

export const TextRunSchema = z.object({
  text: z.string(),
  marks: TextRunMarksSchema.optional(),
});

export type TextRun =
  z.infer<typeof TextRunSchema>;

export const RichTextContentSchema = z.object({
  type: z.literal("rich-text"),
  runs: z.array(TextRunSchema),
});

export type RichTextContent =
  z.infer<typeof RichTextContentSchema>;

export const TextContentSchema = z.union([
  z.string(),
  RichTextContentSchema,
]);

export type TextContent =
  z.infer<typeof TextContentSchema>;

export const TextElementSchema =
  BaseElementSchema.extend({
    type: z.literal("text"),

    content: TextContentSchema,

    variant: z.enum([
      "body",
      "title",
      "subtitle",
      "caption",
    ]).default("body"),

    link: ElementLinkSchema.optional(),
  });

export type TextElement =
  z.infer<typeof TextElementSchema>;

export const TextboxElementSchema =
  BaseElementSchema.extend({
    type: z.literal("textbox"),

    content: z.string(),

    preset: z.string().optional(),

    link: ElementLinkSchema.optional(),
  });

export type TextboxElement =
  z.infer<typeof TextboxElementSchema>;

export const ImageElementSchema =
  BaseElementSchema.extend({
    type: z.literal("image"),

    src: z.string().min(1),

    alt: z.string().default(""),

    fit: z.enum([
      "contain",
      "cover",
      "fill",
    ]).default("contain"),

    focalPoint: z
      .object({
        x: z.number().min(0).max(100),
        y: z.number().min(0).max(100),
      })
      .optional(),

    link: ElementLinkSchema.optional(),
  });

export type ImageElement =
  z.infer<typeof ImageElementSchema>;

export const GalleryItemSchema = z.object({
  src: z.string().min(1),
  alt: z.string().default(""),
});

export type GalleryItem =
  z.infer<typeof GalleryItemSchema>;

export const GalleryElementSchema =
  BaseElementSchema.extend({
    type: z.literal("gallery"),

    items: z.array(GalleryItemSchema),

    fit: z.enum([
      "contain",
      "cover",
      "fill",
    ]).default("contain"),
  });

export type GalleryElement =
  z.infer<typeof GalleryElementSchema>;

export const CodeElementSchema =
  BaseElementSchema.extend({
    type: z.literal("code"),

    code: z.string(),

    language: z.string().default("text"),

    showLineNumbers: z.boolean().default(true),

    highlightedLines: z
      .array(z.number().int().positive())
      .default([]),
  });

export type CodeElement =
  z.infer<typeof CodeElementSchema>;

export const TerminalElementSchema =
  BaseElementSchema.extend({
    type: z.literal("terminal"),

    title: z.string().optional(),

    lines: z.array(
      z.object({
        type: z.enum([
          "command",
          "output",
          "error",
          "comment",
        ]),

        content: z.string(),
      }),
    ),
  });

export type TerminalElement =
  z.infer<typeof TerminalElementSchema>;

export const ChartElementSchema =
  BaseElementSchema.extend({
    type: z.literal("chart"),

    chartType: z.enum([
      "line",
      "bar",
      "area",
      "scatter",
    ]),

    series: z.array(
      z.object({
        name: z.string(),

        values: z.array(
          z.object({
            x: z.number(),
            y: z.number(),
          }),
        ),
      }),
    ),
  });

export type ChartElement =
  z.infer<typeof ChartElementSchema>;

export const InteractiveElementSchema =
  BaseElementSchema.extend({
    type: z.literal("interactive"),

    widget: z.enum([
      "function-plot",
      "geometry-board",
      "pwm-demo",
      "electric-circuit",
    ]),

    config: z.record(
      z.string(),
      z.unknown(),
    ),
  });

export type InteractiveElement =
  z.infer<typeof InteractiveElementSchema>;

export const DividerElementSchema =
  BaseElementSchema.extend({
    type: z.literal("divider"),

    orientation: z.enum([
      "horizontal",
      "vertical",
    ]).default("horizontal"),
  });

export type DividerElement =
  z.infer<typeof DividerElementSchema>;

export const EmbedElementSchema =
  BaseElementSchema.extend({
    type: z.literal("embed"),

    src: z.string().refine(isAbsoluteHttpHref, {
      message:
        "src must be an absolute http:// or https:// URL.",
    }),

    title: z
      .string()
      .min(1)
      .default("Embedded content"),
  });

export type EmbedElement =
  z.infer<typeof EmbedElementSchema>;

export const ScriptedElementSchema =
  BaseElementSchema.extend({
    type: z.literal("scripted"),

    title: z
      .string()
      .min(1)
      .default("Scripted content"),

    html: z.string().default(""),

    css: z.string().default(""),

    script: z.string().default(""),
  });

export type ScriptedElement =
  z.infer<typeof ScriptedElementSchema>;

export type ContentSlot = {
  id: string;

  style?:
    | z.infer<typeof ElementStyleSchema>
    | undefined;

  children: PowerShowElement[];
};

export const ContentSlotSchema:
  z.ZodType<ContentSlot> =
  z.object({
    id: ElementIdSchema,

    style: ElementStyleSchema.optional(),

    children: z.array(
      z.lazy(() => PowerShowElementSchema),
    ),
  });

export const SimpleTableElementSchema =
  BaseElementSchema.extend({
    type: z.literal("table"),

    mode: z.literal("simple").optional(),

    columns: z.array(
      z.object({
        key: z.string().min(1),
        label: z.string(),
      }),
    ),

    rows: z.array(
      z.record(
        z.string(),
        z.union([
          z.string(),
          z.number(),
          z.boolean(),
          z.null(),
        ]),
      ),
    ),
  });

export type SimpleTableElement =
  z.infer<typeof SimpleTableElementSchema>;

export const StructuredTableColumnSchema =
  z.object({
    id: ElementIdSchema,
    header: ContentSlotSchema,
    width: LengthSchema.optional(),
  });

export type StructuredTableColumn =
  z.infer<typeof StructuredTableColumnSchema>;

export const StructuredTableRowSchema =
  z.object({
    id: ElementIdSchema,
    cells: z.array(ContentSlotSchema),
  });

export type StructuredTableRow =
  z.infer<typeof StructuredTableRowSchema>;

const StructuredTableElementBaseSchema =
  BaseElementSchema.extend({
    type: z.literal("table"),
    mode: z.literal("structured"),
    showHeader: z.boolean().default(true),
    columns: z.array(StructuredTableColumnSchema),
    rows: z.array(StructuredTableRowSchema),
  });

export const StructuredTableElementSchema =
  StructuredTableElementBaseSchema.superRefine(
    (table, context) => {
      table.rows.forEach((row, rowIndex) => {
        if (row.cells.length !== table.columns.length) {
          context.addIssue({
            code: "custom",
            path: ["rows", rowIndex, "cells"],
            message:
              "Structured table rows must contain exactly one cell per column.",
          });
        }
      });
    },
  );

export type StructuredTableElement =
  z.infer<typeof StructuredTableElementSchema>;

export const TableElementSchema = z.union([
  SimpleTableElementSchema,
  StructuredTableElementSchema,
]);

export type TableElement =
  | SimpleTableElement
  | StructuredTableElement;

export type TopicItem = {
  id: string;

  content: ContentSlot;

  children: TopicItem[];
};

export const TopicMarkerStyleSchema = z.enum([
  "disc",
  "circle",
  "square",
  "none",
  "decimal",
  "lower-alpha",
  "upper-alpha",
  "lower-roman",
  "upper-roman",
]);

export type TopicMarkerStyle = z.infer<typeof TopicMarkerStyleSchema>;

export const TopicItemSchema:
  z.ZodType<TopicItem> =
  z.lazy(() =>
    z.object({
      id: ElementIdSchema,

      content: ContentSlotSchema,

      children: z.array(
        z.lazy(() => TopicItemSchema),
      ),
    }),
  );

export type TopicsElement = {
  id: string;

  type: "topics";

  kind: "unordered" | "ordered";

  items: TopicItem[];

  rootMarkerStyle?:
    | TopicMarkerStyle
    | undefined;

  markerColor?:
    | z.infer<typeof ColorSchema>
    | undefined;

  itemGap?:
    | number
    | undefined;

  style?:
    | z.infer<typeof ElementStyleSchema>
    | undefined;

  hidden: boolean;
};

export const TopicsElementSchema:
  z.ZodType<TopicsElement> =
  BaseElementSchema.extend({
    type: z.literal("topics"),

    kind: z.enum([
      "unordered",
      "ordered",
    ]),

    items: z.array(TopicItemSchema),

    rootMarkerStyle: TopicMarkerStyleSchema.optional(),

    markerColor: ColorSchema.optional(),

    itemGap: z.number().min(0).optional(),
  });

export type ContainerElement = {
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

  direction:
    | "row"
    | "column";

  layoutMode?:
    | "flow"
    | "stack"
    | undefined;

distribution?:
  | "packed"
  | "space-between"
  | "space-around"
  | "space-evenly"
  | undefined;

  gap?:
    | number
    | string
    | undefined;

  horizontalAlign?:
    | "start"
    | "center"
    | "end"
    | "stretch"
    | undefined;

  verticalAlign?:
    | "start"
    | "center"
    | "end"
    | "stretch"
    | undefined;

  width?:
    | number
    | string
    | undefined;

  style?:
    | z.infer<typeof ElementStyleSchema>
    | undefined;

  hidden: boolean;

  link?:
    | z.infer<typeof ElementLinkSchema>
    | undefined;

  children: PowerShowElement[];
};

export type PowerShowElement =
  | TextElement
  | TextboxElement
  | ImageElement
  | GalleryElement
  | CodeElement
  | TerminalElement
  | TableElement
  | ChartElement
  | InteractiveElement
  | DividerElement
  | EmbedElement
  | ScriptedElement
  | TopicsElement
  | ContainerElement;

export const PowerShowElementSchema:
  z.ZodType<PowerShowElement> =
  z.lazy(() =>
    z.union([
      TextElementSchema,
      TextboxElementSchema,
      ImageElementSchema,
      GalleryElementSchema,
      CodeElementSchema,
      TerminalElementSchema,
      TableElementSchema,
      ChartElementSchema,
      InteractiveElementSchema,
      DividerElementSchema,
      EmbedElementSchema,
      ScriptedElementSchema,
      TopicsElementSchema,

      BaseElementSchema.extend({
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

        direction:
          DirectionSchema.default("column"),

        layoutMode:
          LayoutModeSchema.optional(),

        distribution:
          DistributionSchema.optional(),

        gap: LengthSchema.optional(),

        horizontalAlign:
          HorizontalAlignmentSchema.optional(),

        verticalAlign:
          VerticalAlignmentSchema.optional(),

        width: LengthSchema.optional(),

        link: ElementLinkSchema.optional(),

        children: z.array(
          PowerShowElementSchema,
        ),
      }),
    ]),
  );
