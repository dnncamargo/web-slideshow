import type {
  BlocksElement,
  CodeElement,
  ContainerElement,
  ImageElement,
  Presentation,
  Slide,
  SimpleTableElement,
  TerminalElement,
  TextElement,
} from "@powershow/document-schema";

/**
 * A static, renderer-only educational source used to exercise the current
 * grammar-based Blocks source contract.
 */
export function createDidacticBlocksElement(): BlocksElement {
  return {
    type: "blocks",
    id: "didactic-blocks",
    hidden: false,
    source: String.raw`\start(When flag clicked)

\statement(Set \variable(score) to \value(0))

\scope(Repeat \value(10) times){
  \statement(Move \value(10) steps)
  \statement(Turn \value(15) degrees)
  \statement(Set x to \value(x position))
}

\scope(Repeat until \logic(Touching \value(Sprite2)?)){
  \statement(Move \value(10) steps)
}

\end(Stop all)`,
    style: {
      statementColor: "#3b82f6",
      scopeColor: "#ef4444",
      logicColor: "#f59e0b",
    },
  };
}

export function createCodeElement(
  overrides: Partial<CodeElement> = {},
): CodeElement {
  return {
    type: "code",
    id: "code-fixture",
    hidden: false,
    code: "const answer = 42;",
    language: "typescript",
    showLineNumbers: true,
    highlightedLines: [],
    ...overrides,
  };
}

export function createTerminalElement(
  overrides: Partial<TerminalElement> = {},
): TerminalElement {
  return {
    type: "terminal",
    id: "terminal-fixture",
    hidden: false,
    lines: [],
    ...overrides,
  };
}

export function createTableElement(
  overrides: Partial<SimpleTableElement> = {},
): SimpleTableElement {
  return {
    type: "table",
    id: "table-fixture",
    hidden: false,
    columns: [],
    rows: [],
    ...overrides,
  };
}

export function createTextElement(
  overrides: Partial<TextElement> = {},
): TextElement {
  return {
    type: "text",
    id: "text-fixture",
    hidden: false,
    variant: "body",
    content: "Fixture text",
    ...overrides,
  };
}

export function createImageElement(
  overrides: Partial<ImageElement> = {},
): ImageElement {
  return {
    type: "image",
    id: "image-fixture",
    hidden: false,
    src: "/assets/example.png",
    alt: "Fixture image",
    fit: "contain",
    ...overrides,
  };
}

export function createContainerElement(
  overrides: Partial<ContainerElement> = {},
): ContainerElement {
  return {
    type: "container",
    id: "container-fixture",
    hidden: false,
    children: [],
    ...overrides,
  };
}

export function createSlide(
  overrides: Partial<Slide> = {},
): Slide {
  return {
    id: "slide-fixture",
    title: "",
    summary: "",
    speakerNotes: "",
    elements: [],
    ...overrides,
  };
}

export function createPresentation(
  overrides: Partial<Presentation> = {},
): Presentation {
  return {
    schemaVersion: 1,
    id: "presentation-fixture",
    title: "Fixture presentation",
    description: "",
    aspectRatio: "16:9",
    slides: [],
    ...overrides,
  };
}
