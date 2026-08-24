import type {
  CodeElement,
  ContainerElement,
  ImageElement,
  Presentation,
  Slide,
  SimpleTableElement,
  TerminalElement,
  TextElement,
  TextboxElement,
} from "@powershow/document-schema";

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

export function createTextboxElement(
  overrides: Partial<TextboxElement> = {},
): TextboxElement {
  return {
    type: "textbox",
    id: "textbox-fixture",
    hidden: false,
    content: "Fixture textbox",
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
