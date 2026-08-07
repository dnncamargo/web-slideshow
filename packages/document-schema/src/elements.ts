import { z } from "zod";

import {
  DirectionSchema,
  ElementIdSchema,
  HorizontalAlignmentSchema,
  LengthSchema,
  VerticalAlignmentSchema,
} from "./primitives";

import {
  ElementStyleSchema,
} from "./style";

const BaseElementSchema = z.object({
  id: ElementIdSchema,

  style: ElementStyleSchema.optional(),

  hidden: z.boolean().default(false),
});

export const TextElementSchema =
  BaseElementSchema.extend({
    type: z.literal("text"),

    content: z.string(),

    variant: z.enum([
      "body",
      "title",
      "subtitle",
      "caption",
    ]).default("body"),
  });

export type TextElement =
  z.infer<typeof TextElementSchema>;

export const TextboxElementSchema =
  BaseElementSchema.extend({
    type: z.literal("textbox"),

    content: z.string(),

    preset: z.string().optional(),
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
  });

export type ImageElement =
  z.infer<typeof ImageElementSchema>;

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

export const TableElementSchema =
  BaseElementSchema.extend({
    type: z.literal("table"),

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

export type TableElement =
  z.infer<typeof TableElementSchema>;

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

  children: PowerShowElement[];
};

export type PowerShowElement =
  | TextElement
  | TextboxElement
  | ImageElement
  | CodeElement
  | TerminalElement
  | TableElement
  | ChartElement
  | InteractiveElement
  | ContainerElement;

export const PowerShowElementSchema:
  z.ZodType<PowerShowElement> =
  z.lazy(() =>
    z.union([
      TextElementSchema,
      TextboxElementSchema,
      ImageElementSchema,
      CodeElementSchema,
      TerminalElementSchema,
      TableElementSchema,
      ChartElementSchema,
      InteractiveElementSchema,

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

        gap: LengthSchema.optional(),

        horizontalAlign:
          HorizontalAlignmentSchema.optional(),

        verticalAlign:
          VerticalAlignmentSchema.optional(),

        width: LengthSchema.optional(),

        children: z.array(
          PowerShowElementSchema,
        ),
      }),
    ]),
  );
