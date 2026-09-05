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

const highlightBoxElement = {
  id: "highlight-box",
  type: "container",
  role: "content",
  children: [
    {
      id: "highlight-box-text",
      type: "text",
      content: "A highlighted explanation",
    },
  ],
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

const plotElement = {
  id: "plot-element",
  type: "chart",
  source: "y = x^2",
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
              [plotElement],
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
            plotElement,
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
    name: "highlight box element",
    input: makePresentation([
      makeSlide([highlightBoxElement]),
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
    name: "plot element",
    input: makePresentation([
      makeSlide([plotElement]),
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
          ...highlightBoxElement,
          layout: {
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
          ...highlightBoxElement,
          layout: {
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
          ...highlightBoxElement,
          layout: {
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
            style: { background: { color: "rgba(10, 20, 30, 1)" } },
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
          typography: {
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
