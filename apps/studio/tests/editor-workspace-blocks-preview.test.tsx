// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { PresentationSchema, type Presentation } from "@powershow/document-schema";

import { EditorWorkspace } from "../src/features/editor/editor-workspace";
import { StudioI18nProvider } from "../src/features/i18n/studio-i18n-context";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

class ResizeObserverMock {
  observe(): void {}
  disconnect(): void {}
}

function presentation(): Presentation {
  return PresentationSchema.parse({
    schemaVersion: 1,
    id: "studio-blocks-preview",
    title: "Blocks preview",
    aspectRatio: "16:9",
    slides: [{
      id: "blocks-slide",
      title: "Blocks",
      elements: [{
        type: "blocks",
        id: "studio-blocks",
        hidden: false,
        source: String.raw`\start(When flag clicked)
\statement(Move \value(10) steps)
\scope(Repeat \value(10) times){
  \statement(Turn \value(15) degrees)
  \statement(Set x to \value(x position))
}
\scope(Repeat until \logic(Touching \value(Sprite2)?)){
  \statement(Move \value(10) steps)
}
\end(Stop all)`,
      }],
    }],
  });
}

describe("EditorWorkspace Blocks preview", () => {
  let container: HTMLDivElement;
  let root: Root;
  const originalResizeObserver = globalThis.ResizeObserver;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    globalThis.ResizeObserver = ResizeObserverMock as unknown as typeof ResizeObserver;
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    globalThis.ResizeObserver = originalResizeObserver;
    document.body.innerHTML = "";
  });

  it("renders the canonical Blocks composition through the Editor preview seam", async () => {
    await act(async () => {
      root.render(
        <StudioI18nProvider>
          <EditorWorkspace initialPresentation={presentation()} />
        </StudioI18nProvider>,
      );
    });

    const blocksRoot = container.querySelector<HTMLElement>('[data-powershow-type="blocks"]');
    if (!blocksRoot) throw new Error("Studio Blocks preview was not rendered");

    const blocks = Array.from(blocksRoot.querySelectorAll<HTMLElement>(".powershow-block"));
    expect(blocksRoot.querySelectorAll(".powershow-block--start")).toHaveLength(1);
    expect(blocksRoot.querySelectorAll(".powershow-block--statement").length).toBeGreaterThan(0);
    expect(blocksRoot.querySelectorAll(".powershow-block--scope")).toHaveLength(2);
    expect(blocksRoot.querySelectorAll(".powershow-block--value")).toHaveLength(6);
    expect(blocksRoot.querySelectorAll(".powershow-block--logic")).toHaveLength(1);
    expect(blocksRoot.querySelectorAll(".powershow-block--end")).toHaveLength(1);
    expect(blocksRoot.textContent).toContain("When flag clicked");
    expect(blocksRoot.textContent).toContain("Move 10 steps");
    expect(blocksRoot.textContent).toContain("Touching Sprite2?");
    expect(blocksRoot.textContent).toContain("Stop all");

    const rootBlocks = Array.from(blocksRoot.querySelectorAll<HTMLElement>(":scope > .powershow-blocks-stack > .powershow-block"));
    expect(rootBlocks.map((block) => [...block.classList].find((name) => name.startsWith("powershow-block--")))).toEqual([
      "powershow-block--start",
      "powershow-block--statement",
      "powershow-block--scope",
      "powershow-block--scope",
      "powershow-block--end",
    ]);
    expect(blocks[0]?.classList).toContain("powershow-block--start");
    expect(blocks[blocks.length - 1]?.classList).toContain("powershow-block--end");
  });
});
