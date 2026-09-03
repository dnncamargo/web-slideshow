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
          source: "When flag clicked\\nmove [10] steps\\nrepeat [10] times\\nstop all",
        }],
      }],
    });
    const projection = mountProjectionSurface(root, presentation, { transition: "none" });
    const blocksRoot = root.querySelector<HTMLElement>('[data-powershow-type="blocks"]');
    if (!blocksRoot) throw new Error("Player Blocks projection was not rendered");
    expect(blocksRoot.textContent).toContain("When flag clicked");
    expect(blocksRoot.textContent).toContain("move [10] steps");
    expect(blocksRoot.textContent).toContain("stop all");
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
