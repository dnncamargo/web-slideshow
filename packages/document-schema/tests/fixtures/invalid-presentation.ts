import type {
  SchemaFixture,
} from "./schema-fixtures";

const makePresentation = (
  elements: unknown[] = [],
) => ({
  schemaVersion: 1,
  id: "invalid-presentation-fixture",
  title: "Invalid fixture presentation",
  slides: [
    {
      id: "invalid-slide-fixture",
      elements,
    },
  ],
});

export const invalidPresentationFixtures = [
  {
    name: "schemaVersion different from 1",
    input: {
      ...makePresentation(),
      schemaVersion: 2,
    },
  },
  {
    name: "presentation without id",
    input: {
      schemaVersion: 1,
      title: "Missing id",
      slides: [],
    },
  },
  {
    name: "presentation without title",
    input: {
      schemaVersion: 1,
      id: "missing-title",
      slides: [],
    },
  },
  {
    name: "slide without id",
    input: {
      schemaVersion: 1,
      id: "missing-slide-id",
      title: "Missing slide id",
      slides: [
        {
          elements: [],
        },
      ],
    },
  },
  {
    name: "element without id",
    input: makePresentation([
      {
        type: "text",
        content: "Missing id",
      },
    ]),
  },
  {
    name: "unknown element type",
    input: makePresentation([
      {
        id: "unknown-element",
        type: "video",
        src: "/assets/video.webm",
      },
    ]),
  },
  {
    name: "container with invalid children",
    input: makePresentation([
      {
        id: "invalid-container",
        type: "container",
        children: "not-an-array",
      },
    ]),
  },
  {
    name: "opacity below 0",
    input: makePresentation([
      {
        id: "negative-opacity",
        type: "text",
        content: "Invisible",
        effect: { opacity: -0.01 },
      },
    ]),
  },
  {
    name: "opacity above 1",
    input: makePresentation([
      {
        id: "excessive-opacity",
        type: "text",
        content: "Too visible",
        effect: { opacity: 1.01 },
      },
    ]),
  },
  {
    name: "image without src",
    input: makePresentation([
      {
        id: "missing-image-src",
        type: "image",
      },
    ]),
  },
  {
    name: "code with invalid highlightedLines",
    input: makePresentation([
      {
        id: "invalid-highlighted-lines",
        type: "code",
        code: "const line = 0;",
        highlightedLines: [0, -1, 1.5],
      },
    ]),
  },
  {
    name: "legacy chart shape",
    input: makePresentation([
      {
        id: "legacy-chart",
        type: "chart",
        chartType: "pie",
        series: [],
      },
    ]),
  },
  {
    name: "invalid interactive widget",
    input: makePresentation([
      {
        id: "invalid-widget",
        type: "interactive",
        widget: "arbitrary-script",
        config: {},
      },
    ]),
  },
  {
    name: "table with disallowed cell types",
    input: makePresentation([
      {
        id: "invalid-table-cell",
        type: "table",
        columns: [
          {
            key: "value",
            label: "Value",
          },
        ],
        rows: [
          {
            value: {
              nested: "objects are not cells",
            },
          },
        ],
      },
    ]),
  },
] satisfies readonly SchemaFixture[];
