import type {
  BlockItem,
  BlockPart,
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

const didacticText = (id: string, text: string): BlockPart => ({
  id,
  type: "text",
  text,
});

const didacticLiteral = (id: string, value: string): BlockPart => ({
  id,
  type: "socket",
  content: { type: "literal", value },
});

const didacticReporterSocket = (id: string, block: BlockItem): BlockPart => ({
  id,
  type: "socket",
  content: { type: "block", block },
});

const didacticBlock = (
  id: string,
  color: string,
  shape: BlockItem["shape"],
  parts: BlockPart[],
  children: BlockItem[] = [],
): BlockItem => ({ id, color, shape, parts, children });

/**
 * A static, renderer-only educational composition used to exercise the
 * canonical Blocks vocabulary with realistic mixed parts and nesting.
 */
export function createDidacticBlocksElement(): BlocksElement {
  const touchingLogic = didacticBlock(
    "touching-logic",
    "#f59e0b",
    "logic",
    [
      didacticText("touching-text", "touching"),
      didacticLiteral("touching-target", "Sprite2"),
      didacticText("touching-question", "?"),
    ],
  );

  const xPositionValue = didacticBlock(
    "x-position-value",
    "#22c55e",
    "value",
    [didacticText("x-position-text", "x position")],
  );

  const moveSteps = didacticBlock(
    "move-steps",
    "#3b82f6",
    "statement",
    [
      didacticText("move-text", "move"),
      didacticLiteral("move-count", "10"),
      didacticText("steps-text", "steps"),
    ],
  );

  const turnDegrees = didacticBlock(
    "turn-degrees",
    "#3b82f6",
    "statement",
    [
      didacticText("turn-text", "turn"),
      didacticLiteral("turn-count", "15"),
      didacticText("degrees-text", "degrees"),
    ],
  );

  const setXPosition = didacticBlock(
    "set-x-position",
    "#8b5cf6",
    "statement",
    [
      didacticText("set-x-text", "set x to"),
      didacticReporterSocket("x-position-argument", xPositionValue),
    ],
  );

  const repeatLoop = didacticBlock(
    "repeat-loop",
    "#ef4444",
    "scope",
    [
      didacticText("repeat-text", "repeat"),
      didacticLiteral("repeat-count", "10"),
      didacticText("repeat-times", "times"),
    ],
    [moveSteps, turnDegrees, setXPosition],
  );

  const repeatUntilLoop = didacticBlock(
    "repeat-until-loop",
    "#ef4444",
    "scope",
    [
      didacticText("repeat-until-text", "repeat until"),
      didacticReporterSocket("touching-argument", touchingLogic),
    ],
    [
      didacticBlock(
        "loop-move-steps",
        "#3b82f6",
        "statement",
        [
          didacticText("loop-move-text", "move"),
          didacticLiteral("loop-move-count", "10"),
          didacticText("loop-steps-text", "steps"),
        ],
      ),
    ],
  );

  return {
    type: "blocks",
    id: "didactic-blocks",
    hidden: false,
    items: [
      didacticBlock(
        "event-start",
        "#f97316",
        "start",
        [didacticText("event-start-text", "When flag clicked")],
      ),
      didacticBlock(
        "set-score",
        "#8b5cf6",
        "statement",
        [
          didacticText("set-score-text", "set score to"),
          didacticLiteral("set-score-value", "0"),
        ],
      ),
      repeatLoop,
      repeatUntilLoop,
      didacticBlock("stop-all", "#64748b", "end", [didacticText("stop-all-text", "stop all")]),
    ],
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
