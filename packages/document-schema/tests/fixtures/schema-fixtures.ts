export type SchemaFixture = {
  name: string;
  input: unknown;
};

const makePresentation = (
  slides: unknown[] = [],
) => ({
  schemaVersion: 1,
  id: "presentation-fixture",
  title: "Fixture presentation",
  slides,
});

const makeSlide = (
  elements: unknown[] = [],
) => ({
  id: "slide-fixture",
  elements,
});

const makeContainer = (
  id: string,
  children: unknown[] = [],
  properties: Record<string, unknown> = {},
) => ({
  id,
  type: "container",
  children,
  ...properties,
});

const textElement = {
  id: "text-element",
  type: "text",
  content: "PowerShow",
};

const textboxElement = {
  id: "textbox-element",
  type: "textbox",
  content: "A highlighted explanation",
  preset: "definition",
};

const imageElement = {
  id: "image-element",
  type: "image",
  src: "/assets/example.webp",
};

const codeElement = {
  id: "code-element",
  type: "code",
  code: "const power = true;",
  language: "typescript",
  highlightedLines: [1],
};

const terminalElement = {
  id: "terminal-element",
  type: "terminal",
  title: "Terminal",
  lines: [
    {
      type: "command",
      content: "pnpm test",
    },
    {
      type: "output",
      content: "Tests passed",
    },
    {
      type: "error",
      content: "Example error",
    },
    {
      type: "comment",
      content: "Example comment",
    },
  ],
};

const tableElement = {
  id: "table-element",
  type: "table",
  columns: [
    {
      key: "value",
      label: "Value",
    },
  ],
  rows: [
    { value: "text" },
    { value: 42 },
    { value: true },
    { value: null },
  ],
};

const chartElement = {
  id: "chart-element",
  type: "chart",
  chartType: "line",
  series: [
    {
      name: "Voltage",
      values: [
        { x: 0, y: 0 },
        { x: 1, y: 5 },
      ],
    },
  ],
};

const interactiveElement = {
  id: "interactive-element",
  type: "interactive",
  widget: "function-plot",
  config: {
    expression: "sin(x)",
  },
};

export const validStructureFixtures = [
  {
    name: "minimal presentation",
    input: makePresentation(),
  },
  {
    name: "empty slide",
    input: makePresentation([
      makeSlide(),
    ]),
  },
  {
    name: "empty container",
    input: makePresentation([
      makeSlide([
        makeContainer("empty-container"),
      ]),
    ]),
  },
  {
    name: "containers nested across multiple levels",
    input: makePresentation([
      makeSlide([
        makeContainer("level-1", [
          makeContainer("level-2", [
            makeContainer("level-3", [
              makeContainer("level-4", [
                textElement,
              ]),
            ]),
          ]),
        ]),
      ]),
    ]),
  },
  {
    name: "one-column layout",
    input: makePresentation([
      makeSlide([
        makeContainer(
          "main",
          [
            makeContainer(
              "column-1",
              [textElement],
              { role: "column" },
            ),
          ],
          { role: "main" },
        ),
      ]),
    ]),
  },
  {
    name: "two-column layout",
    input: makePresentation([
      makeSlide([
        makeContainer(
          "main",
          [
            makeContainer(
              "column-1",
              [textElement],
              { role: "column" },
            ),
            makeContainer(
              "column-2",
              [imageElement],
              { role: "column" },
            ),
          ],
          {
            role: "main",
            layout: { children: { direction: "row" } },
          },
        ),
      ]),
    ]),
  },
  {
    name: "three-column layout",
    input: makePresentation([
      makeSlide([
        makeContainer(
          "main",
          [
            makeContainer(
              "column-1",
              [textElement],
              { role: "column" },
            ),
            makeContainer(
              "column-2",
              [imageElement],
              { role: "column" },
            ),
            makeContainer(
              "column-3",
              [chartElement],
              { role: "column" },
            ),
          ],
          {
            role: "main",
            layout: { children: { direction: "row" } },
          },
        ),
      ]),
    ]),
  },
  {
    name: "main and footer as siblings",
    input: makePresentation([
      makeSlide([
        makeContainer(
          "main",
          [],
          { role: "main" },
        ),
        makeContainer(
          "footer",
          [],
          { role: "footer" },
        ),
      ]),
    ]),
  },
  {
    name: "header, main, and footer as siblings",
    input: makePresentation([
      makeSlide([
        makeContainer(
          "header",
          [],
          { role: "header" },
        ),
        makeContainer(
          "main",
          [],
          { role: "main" },
        ),
        makeContainer(
          "footer",
          [],
          { role: "footer" },
        ),
      ]),
    ]),
  },
  {
    name: "column with mixed content",
    input: makePresentation([
      makeSlide([
        makeContainer(
          "mixed-column",
          [
            textElement,
            imageElement,
            terminalElement,
            tableElement,
            chartElement,
          ],
          { role: "column" },
        ),
      ]),
    ]),
  },
] satisfies readonly SchemaFixture[];

export const validElementFixtures = [
  {
    name: "text element",
    input: makePresentation([
      makeSlide([textElement]),
    ]),
  },
  {
    name: "textbox element",
    input: makePresentation([
      makeSlide([textboxElement]),
    ]),
  },
  {
    name: "image element",
    input: makePresentation([
      makeSlide([imageElement]),
    ]),
  },
  {
    name: "code element",
    input: makePresentation([
      makeSlide([codeElement]),
    ]),
  },
  {
    name: "terminal element",
    input: makePresentation([
      makeSlide([terminalElement]),
    ]),
  },
  {
    name: "table element",
    input: makePresentation([
      makeSlide([tableElement]),
    ]),
  },
  {
    name: "chart element",
    input: makePresentation([
      makeSlide([chartElement]),
    ]),
  },
  {
    name: "interactive element",
    input: makePresentation([
      makeSlide([interactiveElement]),
    ]),
  },
] satisfies readonly SchemaFixture[];

export const validStyleFixtures = [
  {
    name: "numeric width and height styles",
    input: makePresentation([
      makeSlide([
        {
          ...textElement,
          style: {
            width: 640,
            height: 360,
          },
        },
      ]),
    ]),
  },
  {
    name: "CSS string width and height styles",
    input: makePresentation([
      makeSlide([
        {
          ...textElement,
          style: {
            width: "50%",
            height: "calc(100vh - 2rem)",
          },
        },
      ]),
    ]),
  },
  {
    name: "absolute positioning styles",
    input: makePresentation([
      makeSlide([
        {
          ...textboxElement,
          style: {
            position: "absolute",
            top: "2rem",
            right: 24,
            bottom: "10%",
            left: 0,
          },
        },
      ]),
    ]),
  },
  {
    name: "container and element alignment",
    input: makePresentation([
      makeSlide([
        makeContainer(
          "aligned-container",
          [
            {
              ...textElement,
              style: {
                horizontalAlign: "end",
                verticalAlign: "stretch",
              },
            },
          ],
          { layout: { children: { horizontalAlign: "center", verticalAlign: "start" } } },
        ),
      ]),
    ]),
  },
  {
    name: "slide and element backgrounds",
    input: makePresentation([
      {
        ...makeSlide([
          {
            ...textElement,
            style: {
              background: "rgba(10, 20, 30, 1)",
            },
          },
        ]),
        background: {
          color: "#ffffff",
          image: "/assets/background.webp",
        },
      },
    ]),
  },
  {
    name: "text capability typography styles",
    input: makePresentation([
      makeSlide([
        {
          ...textElement,
          style: {
            textTransform: "uppercase",
            whiteSpace: "pre-line",
            textWrapStyle: "balance",
            overflowWrap: "break-word",
            textDecorationLine: "underline",
          },
        },
      ]),
    ]),
  },
] satisfies readonly SchemaFixture[];

export const defaultsInput = makePresentation([
  makeSlide([
    {
      id: "defaults-container",
      type: "container",
      children: [
        {
          id: "defaults-text",
          type: "text",
          content: "Default text",
        },
        {
          id: "defaults-image",
          type: "image",
          src: "/assets/default.webp",
        },
        {
          id: "defaults-code",
          type: "code",
          code: "return true;",
        },
      ],
    },
  ]),
]);

export const expectedDefaultsOutput = {
  schemaVersion: 1,
  id: "presentation-fixture",
  title: "Fixture presentation",
  description: "",
  aspectRatio: "16:9",
  slides: [
    {
      id: "slide-fixture",
      title: "",
      summary: "",
      speakerNotes: "",
      elements: [
        {
          id: "defaults-container",
          type: "container",
          hidden: false,
          children: [
            {
              id: "defaults-text",
              type: "text",
              content: "Default text",
              hidden: false,
              variant: "body",
            },
            {
              id: "defaults-image",
              type: "image",
              src: "/assets/default.webp",
              hidden: false,
              alt: "",
              fit: "contain",
            },
            {
              id: "defaults-code",
              type: "code",
              code: "return true;",
              hidden: false,
              language: "text",
              showLineNumbers: true,
              highlightedLines: [],
            },
          ],
        },
      ],
    },
  ],
};
