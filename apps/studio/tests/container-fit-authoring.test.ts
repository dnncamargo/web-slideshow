// @vitest-environment jsdom

import { describe, expect, it } from "vitest";

import type { ContainerElement } from "@powershow/document-schema";

import {
  isInsideContainerFitSurface,
  measureContainerFitSourceSize,
  updateContainerFit,
} from "../src/features/editor/container-fit-authoring";

function measuredElement(
  width: number,
  height: number,
  padding: Partial<Record<"paddingLeft" | "paddingRight" | "paddingTop" | "paddingBottom", string>> = {},
): HTMLElement {
  const element = document.createElement("div");
  Object.defineProperties(element, {
    clientWidth: { configurable: true, value: width },
    clientHeight: { configurable: true, value: height },
  });
  Object.assign(element.style, padding);
  document.body.appendChild(element);
  return element;
}

function container(overrides: Partial<ContainerElement> = {}): ContainerElement {
  return {
    id: "container",
    type: "container",
    hidden: false,
    children: [],
    ...overrides,
  };
}

describe("Container Fit authoring", () => {
  it("measures the logical content box from client dimensions and padding", () => {
    const element = measuredElement(840, 440, {
      paddingLeft: "20px",
      paddingRight: "20px",
      paddingTop: "20px",
      paddingBottom: "20px",
    });

    expect(measureContainerFitSourceSize(element)).toEqual({
      sourceWidth: 800,
      sourceHeight: 400,
    });
  });

  it("handles asymmetric padding without using the border box", () => {
    const element = measuredElement(900, 500, {
      paddingLeft: "10px",
      paddingRight: "30px",
      paddingTop: "5px",
      paddingBottom: "15px",
    });

    expect(measureContainerFitSourceSize(element)).toEqual({
      sourceWidth: 860,
      sourceHeight: 480,
    });
  });

  it("rejects zero or negative content dimensions", () => {
    expect(measureContainerFitSourceSize(measuredElement(40, 100, { paddingLeft: "40px" }))).toBeNull();
    expect(measureContainerFitSourceSize(measuredElement(100, 20, { paddingTop: "30px" }))).toBeNull();
  });

  it("authors first activation atomically and preserves source dimensions on mode changes", () => {
    const first = updateContainerFit(
      container({ layout: { children: { direction: "row" } } }),
      "contain",
      { sourceWidth: 800, sourceHeight: 400 },
    );
    expect(first?.layout?.children?.fit).toEqual({
      mode: "contain",
      sourceWidth: 800,
      sourceHeight: 400,
    });

    const switched = first && updateContainerFit(first, "fill");
    expect(switched?.layout?.children?.fit).toEqual({
      mode: "fill",
      sourceWidth: 800,
      sourceHeight: 400,
    });
  });

  it("removes fit while preserving sibling child layout fields", () => {
    const source = container({
      layout: {
        children: {
          mode: "flow",
          direction: "row",
          gap: 16,
          fit: { mode: "cover", sourceWidth: 800, sourceHeight: 400 },
        },
      },
    });
    const result = updateContainerFit(source, null);

    expect(result?.layout?.children).toEqual({ mode: "flow", direction: "row", gap: 16 });
  });

  it("guards descendants inside a fit surface but not the fitted outer Container", () => {
    const outer = document.createElement("div");
    const surface = document.createElement("div");
    const child = document.createElement("div");
    surface.className = "powershow-container-fit-surface";
    outer.append(surface);
    surface.append(child);

    expect(isInsideContainerFitSurface(child)).toBe(true);
    expect(isInsideContainerFitSurface(outer)).toBe(false);
  });

  it("guards a nested Container outer element inside an ancestor fit surface", () => {
    const surface = document.createElement("div");
    const nestedContainer = document.createElement("div");
    surface.className = "powershow-container-fit-surface";
    surface.append(nestedContainer);

    expect(isInsideContainerFitSurface(nestedContainer)).toBe(true);
  });
});
