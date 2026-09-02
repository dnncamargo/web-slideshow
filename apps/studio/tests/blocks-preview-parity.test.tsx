// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  PresentationSchema,
  type BlockItem,
  type BlockPart,
  type Presentation,
} from "@powershow/document-schema";

import { EditorWorkspace } from "../src/features/editor/editor-workspace";
import { StudioI18nProvider } from "../src/features/i18n/studio-i18n-context";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

const text = (id: string, value: string): BlockPart => ({ id, type: "text", text: value });
const literal = (id: string, value: string): BlockPart => ({ id, type: "socket", content: { type: "literal", value } });
const reporterSocket = (id: string, block: BlockItem): BlockPart => ({ id, type: "socket", content: { type: "block", block } });
const block = (id: string, color: string, shape: BlockItem["shape"], parts: BlockPart[], children: BlockItem[] = []): BlockItem => ({ id, color, shape, parts, children });

function didacticPresentation(): Presentation {
  const valueReporter = block("preview-value", "#22c55e", "value", [text("preview-value-text", "x position")]);
  const logicReporter = block("preview-logic", "#f59e0b", "logic", [
    text("preview-logic-text", "touching"),
    literal("preview-logic-target", "Sprite2"),
    text("preview-logic-question", "?"),
  ]);
  const setX = block("preview-set-x", "#8b5cf6", "statement", [
    text("preview-set-x-text", "set x to"),
    reporterSocket("preview-set-x-argument", valueReporter),
  ]);
  const repeat = block("preview-repeat", "#ef4444", "scope", [
    text("preview-repeat-text", "repeat"),
    literal("preview-repeat-count", "10"),
    text("preview-repeat-times", "times"),
  ], [
    block("preview-turn", "#3b82f6", "statement", [
      text("preview-turn-text", "turn"),
      literal("preview-turn-count", "15"),
      text("preview-turn-degrees", "degrees"),
    ]),
    setX,
  ]);
  const repeatUntil = block("preview-repeat-until", "#ef4444", "scope", [
    text("preview-repeat-until-text", "repeat until"),
    reporterSocket("preview-repeat-until-argument", logicReporter),
  ], [
    block("preview-move", "#3b82f6", "statement", [
      text("preview-move-text", "move"),
      literal("preview-move-count", "10"),
      text("preview-move-steps", "steps"),
    ]),
  ]);

  return PresentationSchema.parse({
    schemaVersion: 1,
    id: "blocks-preview-parity",
    title: "Blocks preview parity",
    description: "",
    aspectRatio: "16:9",
    slides: [{
      id: "blocks-preview-slide",
      title: "Blocks",
      elements: [{
        type: "blocks",
        id: "preview-blocks",
        hidden: false,
        items: [
          block("preview-start", "#f97316", "start", [text("preview-start-text", "When flag clicked")]),
          block("preview-statement", "#8b5cf6", "statement", [text("preview-statement-text", "move"), literal("preview-statement-count", "10"), text("preview-statement-steps", "steps")]),
          repeat,
          repeatUntil,
          block("preview-end", "#64748b", "end", [text("preview-end-text", "stop all")]),
        ],
      }],
    }],
  });
}

describe("Studio EditorWorkspace Blocks preview parity", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    document.body.replaceChildren();
  });

  it("renders the canonical Blocks composition through the Studio preview canvas", async () => {
    await act(async () => {
      root.render(
        <StudioI18nProvider>
          <EditorWorkspace initialPresentation={didacticPresentation()} />
        </StudioI18nProvider>,
      );
    });

    const canvas = container.querySelector<HTMLElement>("[class*='slideCanvas']");
    const blocksRoot = canvas?.querySelector<HTMLElement>('[data-powershow-type="blocks"]');
    const stack = blocksRoot?.querySelector<HTMLElement>(":scope > .powershow-blocks-stack");
    if (!canvas || !blocksRoot || !stack) throw new Error("Studio Blocks preview was not rendered");

    expect(Array.from(stack.children).map((child) => child.getAttribute("data-powershow-block-id"))).toEqual([
      "preview-start",
      "preview-statement",
      "preview-repeat",
      "preview-repeat-until",
      "preview-end",
    ]);

    for (const shape of ["start", "statement", "scope", "value", "logic", "end"]) {
      expect(canvas.querySelector(`.powershow-block--${shape}`)).not.toBeNull();
    }
    expect(canvas.textContent).toContain("When flag clicked");
    expect(canvas.textContent).toContain("10");
    expect(canvas.textContent).toContain("Sprite2");
    expect(canvas.textContent).toContain("stop all");
    expect(canvas.querySelector('[data-powershow-part-id="preview-set-x-argument"] > [data-powershow-block-id="preview-value"]')).not.toBeNull();
    expect(canvas.querySelector('[data-powershow-part-id="preview-repeat-until-argument"] > [data-powershow-block-id="preview-logic"]')).not.toBeNull();
    expect(canvas.querySelector('[data-powershow-block-id="preview-repeat"] [data-powershow-block-id="preview-turn"]')).not.toBeNull();
    expect(canvas.querySelector('[data-powershow-block-id="preview-repeat"] [data-powershow-block-id="preview-set-x"]')).not.toBeNull();
    expect(canvas.querySelector('[data-powershow-block-id="preview-turn"]')?.compareDocumentPosition(canvas.querySelector('[data-powershow-block-id="preview-set-x"]') ?? canvas) ?? 0).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
    expect(canvas.querySelector('[data-powershow-block-id="preview-start"] .powershow-block-header')?.getAttribute("style")).toContain("background-color:#f97316");
    expect(canvas.querySelectorAll("[onclick]")).toHaveLength(0);
  });
});
