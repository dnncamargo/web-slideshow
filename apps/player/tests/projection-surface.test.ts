// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { PresentationSchema } from "@powershow/document-schema";
import { paletteColorCssVariableName } from "@powershow/renderer";

import { mountProjectionSurface } from "../src/projection-surface";

import { playerTestPresentation } from "./fixtures/player-presentation";

describe("Projection surface", () => {
  let root: HTMLElement;

  beforeEach(() => {
    document.body.innerHTML = `<div id="app"></div>`;
    const element = document.querySelector<HTMLElement>("#app");

    if (!element) {
      throw new Error("Test root was not created.");
    }

    root = element;
  });

  afterEach(() => {
    document.body.replaceChildren();
  });

  it("renders the first slide without Player controls", () => {
    const projection = mountProjectionSurface(root, playerTestPresentation, {
      transition: "none",
    });

    expect(root.querySelector(".powershow-player-slide-surface")).not.toBeNull();
    expect(root.querySelector(".powershow-player-controls")).toBeNull();
    expect(root.innerHTML).toContain("Slide One");
    expect(projection.getCurrentIndex()).toBe(0);

    projection.destroy();
  });

  it("renders the representative Blocks composition through the Player projection", () => {
    const presentation = PresentationSchema.parse({
      ...playerTestPresentation,
      id: "blocks-projection",
      slides: [{
        id: "blocks-slide",
        elements: [{
          type: "blocks",
          id: "projection-blocks",
          hidden: false,
          items: [
            { id: "projection-start", color: "#f97316", shape: "start", parts: [{ id: "projection-start-text", type: "text", text: "When flag clicked" }], children: [] },
            { id: "projection-statement", color: "#3b82f6", shape: "statement", parts: [{ id: "projection-move-text", type: "text", text: "move" }, { id: "projection-move-count", type: "socket", content: { type: "literal", value: "10" } }, { id: "projection-move-steps", type: "text", text: "steps" }], children: [] },
            { id: "projection-scope", color: "#ef4444", shape: "scope", parts: [{ id: "projection-repeat-text", type: "text", text: "repeat" }, { id: "projection-repeat-count", type: "socket", content: { type: "literal", value: "10" } }], children: [{ id: "projection-turn", color: "#3b82f6", shape: "statement", parts: [{ id: "projection-turn-text", type: "text", text: "turn" }, { id: "projection-turn-count", type: "socket", content: { type: "literal", value: "15" } }], children: [] }, { id: "projection-set-x", color: "#8b5cf6", shape: "statement", parts: [{ id: "projection-set-x-text", type: "text", text: "set x to" }, { id: "projection-value-socket", type: "socket", content: { type: "block", block: { id: "projection-value", color: "#22c55e", shape: "value", parts: [{ id: "projection-value-text", type: "text", text: "x position" }], children: [] } } }], children: [] }] },
            { id: "projection-until", color: "#ef4444", shape: "scope", parts: [{ id: "projection-until-text", type: "text", text: "repeat until" }, { id: "projection-logic-socket", type: "socket", content: { type: "block", block: { id: "projection-logic", color: "#f59e0b", shape: "logic", parts: [{ id: "projection-touching", type: "text", text: "touching" }, { id: "projection-target", type: "socket", content: { type: "literal", value: "Sprite2" } }], children: [] } } }], children: [{ id: "projection-loop-move", color: "#3b82f6", shape: "statement", parts: [{ id: "projection-loop-move-text", type: "text", text: "move" }, { id: "projection-loop-move-count", type: "socket", content: { type: "literal", value: "10" } }], children: [] }] },
            { id: "projection-end", color: "#64748b", shape: "end", parts: [{ id: "projection-end-text", type: "text", text: "stop all" }], children: [] },
          ],
        }],
      }],
    });
    const projection = mountProjectionSurface(root, presentation, { transition: "none" });
    const blocksRoot = root.querySelector<HTMLElement>('[data-powershow-type="blocks"]');
    const stack = blocksRoot?.querySelector<HTMLElement>(":scope > .powershow-blocks-stack");
    if (!blocksRoot || !stack) throw new Error("Player Blocks projection was not rendered");

    expect(Array.from(stack.children).map((child) => child.getAttribute("data-powershow-block-id"))).toEqual([
      "projection-start", "projection-statement", "projection-scope", "projection-until", "projection-end",
    ]);
    for (const shape of ["start", "statement", "scope", "value", "logic", "end"]) {
      expect(blocksRoot.querySelector(`.powershow-block--${shape}`)).not.toBeNull();
    }
    expect(blocksRoot.textContent).toContain("When flag clicked");
    expect(blocksRoot.textContent).toContain("Sprite2");
    expect(blocksRoot.querySelector('[data-powershow-part-id="projection-value-socket"] > [data-powershow-block-id="projection-value"]')).not.toBeNull();
    expect(blocksRoot.querySelector('[data-powershow-part-id="projection-logic-socket"] > [data-powershow-block-id="projection-logic"]')).not.toBeNull();
    expect(blocksRoot.querySelectorAll("[onclick]")).toHaveLength(0);

    projection.destroy();
  });

  it("navigates to valid indexes and fails closed for invalid indexes", () => {
    const projection = mountProjectionSurface(root, playerTestPresentation, {
      transition: "none",
    });

    projection.goTo(1);
    expect(projection.getCurrentIndex()).toBe(1);
    expect(root.innerHTML).toContain("Slide Two");

    projection.goTo(-1);
    projection.goTo(3);
    projection.goTo(1.5);
    projection.goTo(Number.NaN);

    expect(projection.getCurrentIndex()).toBe(1);
    expect(root.innerHTML).toContain("Slide Two");

    projection.destroy();
  });

  it("keeps fonts, palette, geometry, and runtime hydration on the seam", () => {
    const presentation = PresentationSchema.parse({
      ...playerTestPresentation,
      aspectRatio: "4:3",
      palette: {
        colors: [{ id: "accent", name: "Accent", value: "#f0c000" }],
      },
      resources: {
        fonts: [
          {
            id: "inter",
            family: "Inter",
            source: {
              type: "url",
              url: "https://cdn.example.com/inter.woff2",
              format: "woff2",
            },
          },
        ],
      },
      slides: [
        {
          id: "runtime-slide",
          elements: [
            {
              type: "container",
              id: "fit-container",
              layout: {
                children: {
                  fit: { mode: "contain", sourceWidth: 800, sourceHeight: 400 },
                },
              },
              children: [
                {
                  type: "text",
                  id: "runtime-text",
                  content: "Runtime hydration",
                  style: { color: { kind: "palette", colorId: "accent" } },
                },
              ],
            },
          ],
        },
      ],
    });

    Object.defineProperty(window, "innerWidth", { configurable: true, value: 1200 });
    Object.defineProperty(window, "innerHeight", { configurable: true, value: 900 });

    const projection = mountProjectionSurface(root, presentation, {
      transition: "none",
    });
    const surface = root.querySelector<HTMLElement>(
      ".powershow-player-slide-surface",
    );
    const fitSurface = root.querySelector<HTMLElement>(
      ".powershow-container-fit-surface",
    );
    const fitViewport = root.querySelector<HTMLElement>(
      "[data-powershow-container-fit]",
    );

    expect(root.querySelector("style[data-powershow-font-resources]")).not.toBeNull();
    expect(root.querySelector("style[data-powershow-font-resources]")?.textContent).toContain(
      "@font-face",
    );
    expect(surface?.style.getPropertyValue(paletteColorCssVariableName("accent"))).toBe(
      "#f0c000",
    );
    expect(surface?.style.width).toBe("960px");
    expect(surface?.style.height).toBe("720px");
    expect(surface?.style.transform).toBe("scale(1.25)");
    expect(fitSurface).not.toBeNull();
    expect(fitViewport).not.toBeNull();

    Object.defineProperty(fitViewport, "clientWidth", {
      configurable: true,
      value: 800,
    });
    Object.defineProperty(fitViewport, "clientHeight", {
      configurable: true,
      value: 400,
    });
    window.dispatchEvent(new Event("resize"));

    expect(fitSurface?.style.transform).toBe(
      "translate(0px,0px) scale(1,1)",
    );
    expect(root.innerHTML).toContain("Runtime hydration");

    projection.destroy();
  });

  it("cleans up safely and idempotently", () => {
    const projection = mountProjectionSurface(root, playerTestPresentation, {
      transition: "none",
    });

    projection.destroy();
    projection.destroy();

    expect(root.children).toHaveLength(0);
    expect(() => window.dispatchEvent(new Event("resize"))).not.toThrow();
  });
});
