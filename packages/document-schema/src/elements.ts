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

export type BlockShape = "statement" | "value" | "scope";

export type BlockCategory = {
  id: string;
  name: string;
  color: z.infer<typeof ColorSchema>;
};

export type BlockTextPart = {
  id: string;
  type: "text";
  text: string;
};

export type BlockSocketContent =
  | { type: "empty" }
  | { type: "literal"; value: string }
  | { type: "block"; block: BlockItem };

export type BlockSocketPart = {
  id: string;
  type: "socket";
  content: BlockSocketContent;
};

export type BlockPart = BlockTextPart | BlockSocketPart;

export type BlockItem = {
  id: string;
  categoryId: string;
  shape: BlockShape;
  parts: BlockPart[];
  children: BlockItem[];
};

export const BlockShapeSchema = z.enum(["statement", "value", "scope"]);

export const BlockCategorySchema = z.object({
  id: z.string(),
  name: z.string(),
  color: ColorSchema,
});

const BlockTextPartSchema = z.object({
  id: ElementIdSchema,
  type: z.literal("text"),
  text: z.string(),
});

const BlockSocketContentSchema: z.ZodType<BlockSocketContent> = z.lazy(() =>
  z.union([
    z.object({ type: z.literal("empty") }),
    z.object({ type: z.literal("literal"), value: z.string() }),
    z.object({ type: z.literal("block"), block: BlockItemSchema }),
  ]),
);

const BlockSocketPartSchema = z.object({
  id: ElementIdSchema,
  type: z.literal("socket"),
  content: BlockSocketContentSchema,
});

export const BlockPartSchema: z.ZodType<BlockPart> = z.union([
  BlockTextPartSchema,
  BlockSocketPartSchema,
]);

export const BlockItemSchema: z.ZodType<BlockItem> = z.lazy(() =>
  z.object({
    id: ElementIdSchema,
    categoryId: z.string(),
    shape: BlockShapeSchema,
    parts: z.array(BlockPartSchema),
    children: z.array(BlockItemSchema),
  }),
);

export const BlocksElementSchema = BaseElementSchema.extend({
  type: z.literal("blocks"),
  categories: z.array(BlockCategorySchema),
  items: z.array(BlockItemSchema),
}).superRefine((element, context) => {
  const categoryIds = new Set<string>();
  element.categories.forEach((category, index) => {
    if (categoryIds.has(category.id)) {
      context.addIssue({
        code: "custom",
        path: ["categories", index, "id"],
        message: "Block category ids must be unique within a BlocksElement.",
      });
    }
    categoryIds.add(category.id);
  });

  const visit = (item: BlockItem, path: (string | number)[], root: boolean, scopeChild: boolean) => {
    if (!categoryIds.has(item.categoryId)) {
      context.addIssue({ code: "custom", path: [...path, "categoryId"], message: "Block category reference does not resolve." });
    }
    if (root && item.shape === "value") {
      context.addIssue({ code: "custom", path: [...path, "shape"], message: "A root block cannot have value shape." });
    }
    if (scopeChild && item.shape === "value") {
      context.addIssue({ code: "custom", path: [...path, "shape"], message: "A scope child cannot have value shape." });
    }
    if ((item.shape === "statement" || item.shape === "value") && item.children.length > 0) {
      context.addIssue({ code: "custom", path: [...path, "children"], message: `${item.shape} blocks cannot have children.` });
    }
    item.parts.forEach((part, partIndex) => {
      if (part.type === "socket" && part.content.type === "block") {
        visit(part.content.block, [...path, "parts", partIndex, "content", "block"], false, false);
        if (part.content.block.shape !== "value") {
          context.addIssue({ code: "custom", path: [...path, "parts", partIndex, "content", "block", "shape"], message: "Socket blocks must have value shape." });
        }
      }
    });
    item.children.forEach((child, childIndex) => visit(child, [...path, "children", childIndex], false, true));
  };

  element.items.forEach((item, index) => visit(item, ["items", index], true, false));
});

export type BlocksElement =
  z.infer<typeof BlocksElementSchema>;

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
  | BlocksElement
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
      BlocksElementSchema,
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
