import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { PlotElement, PowerShowElement, Slide } from "@powershow/document-schema";

import { renderPlot, renderPlotFrame } from "../src/render-plot";
import {
  disposeRendererRuntime,
  hydrateRendererRuntime,
} from "../src/renderer-runtime";

type PlotNode = {
  className: string;
  dataset: { powershowId: string; powershowType: string };
  innerHTML: string;
  querySelector: () => null;
};

class FakeRoot {
  constructor(readonly nodes: PlotNode[]) {}

  querySelectorAll<T>(): T[] {
    return this.nodes as T[];
  }

  matches(): boolean {
    return false;
  }

  get innerHTML(): string {
    return this.nodes.map((node) => node.innerHTML).join("");
  }
}

function runtimeRoot(root: FakeRoot): ParentNode {
  return root as unknown as ParentNode;
}

function plot(id: string, animation: NonNullable<PlotElement["animation"]>, source = "y = x + t"): PlotElement {
  return { id, type: "plot", hidden: false, source, animation };
}

function node(element: PlotElement): PlotNode {
  const html = renderPlot(element);
  return {
    className: "powershow-element powershow-plot",
    dataset: { powershowId: element.id, powershowType: "plot" },
    innerHTML: html.slice(html.indexOf(">", html.indexOf("data-powershow-type")) + 1, -6),
    querySelector: () => null,
  };
}

function slide(elements: PowerShowElement[]): Slide {
  return { id: "slide-1", elements } as Slide;
}

let callbacks: Map<number, FrameRequestCallback>;
let nextFrameId: number;
let requestFrame: ReturnType<typeof vi.fn>;
let cancelFrame: ReturnType<typeof vi.fn>;

function runNextFrame(timestamp: number): void {
  const next = callbacks.entries().next().value as [number, FrameRequestCallback] | undefined;
  if (next === undefined) throw new Error("No scheduled frame");
  callbacks.delete(next[0]);
  next[1](timestamp);
}

beforeEach(() => {
  callbacks = new Map();
  nextFrameId = 1;
  requestFrame = vi.fn((callback: FrameRequestCallback) => {
    const id = nextFrameId++;
    callbacks.set(id, callback);
    return id;
  });
  cancelFrame = vi.fn((id: number) => {
    callbacks.delete(id);
  });
  vi.stubGlobal("requestAnimationFrame", requestFrame);
  vi.stubGlobal("cancelAnimationFrame", cancelFrame);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("Plot animation runtime", () => {
  it("does not start Plot RAF without an animation context", () => {
    const element = plot("plot-1", { parameter: "t", from: 0, to: 1, durationMs: 1000 });
    const root = new FakeRoot([node(element)]);

    hydrateRendererRuntime(runtimeRoot(root));

    expect(requestFrame).not.toHaveBeenCalled();
  });

  it("starts one root scheduler and preserves it across repeated hydration", () => {
    const element = plot("plot-1", { parameter: "t", from: 0, to: 1, durationMs: 1000 });
    const root = new FakeRoot([node(element)]);
    const context = { plotAnimations: { slide: slide([element]) } };

    hydrateRendererRuntime(runtimeRoot(root), context);
    runNextFrame(100);
    const firstFrame = root.innerHTML;
    hydrateRendererRuntime(runtimeRoot(root), context);
    runNextFrame(600);

    expect(requestFrame).toHaveBeenCalledTimes(3);
    expect(root.innerHTML).not.toBe(firstFrame);
  });

  it("renders elapsed time, endpoint, and reverse ranges", () => {
    const forward = plot("forward", { parameter: "t", from: 0, to: 10, durationMs: 1000, loop: false });
    const reverse = plot("reverse", { parameter: "t", from: 10, to: 0, durationMs: 1000, loop: false });
    const forwardNode = node(forward);
    const reverseNode = node(reverse);
    const root = new FakeRoot([forwardNode, reverseNode]);

    hydrateRendererRuntime(runtimeRoot(root), { plotAnimations: { slide: slide([forward, reverse]) } });
    runNextFrame(100);
    const initial = forwardNode.innerHTML;
    runNextFrame(600);
    const middle = forwardNode.innerHTML;
    runNextFrame(1100);
    const endpoint = forwardNode.innerHTML;

    expect(initial).not.toBe(middle);
    expect(middle).not.toBe(endpoint);
    expect(reverseNode.innerHTML).not.toBe(forwardNode.innerHTML);
    expect(callbacks.size).toBe(0);
    expect(cancelFrame).not.toHaveBeenCalled();
  });

  it("wraps looping plots and does not schedule flat or autoplay-disabled plots", () => {
    const looping = plot("loop", { parameter: "t", from: 0, to: 10, durationMs: 1000 });
    const flat = plot("flat", { parameter: "t", from: 2, to: 2, durationMs: 1000 });
    const paused = plot("paused", { parameter: "t", from: 0, to: 10, durationMs: 1000, autoplay: false });
    const loopNode = node(looping);
    const pausedNode = node(paused);
    const root = new FakeRoot([loopNode, node(flat), pausedNode]);

    hydrateRendererRuntime(runtimeRoot(root), { plotAnimations: { slide: slide([looping, flat, paused]) } });
    runNextFrame(100);
    const initial = loopNode.innerHTML;
    runNextFrame(1350);

    expect(loopNode.innerHTML).not.toBe(initial);
    expect(pausedNode.innerHTML).toBe(node(paused).innerHTML);
    expect(callbacks.size).toBe(1);
  });

  it("updates multiple Plots independently", () => {
    const first = plot("first", { parameter: "t", from: 0, to: 10, durationMs: 1000 });
    const second = plot("second", { parameter: "phase", from: 10, to: 20, durationMs: 2000 }, "y = x + phase");
    const firstNode = node(first);
    const secondNode = node(second);
    const root = new FakeRoot([firstNode, secondNode]);

    hydrateRendererRuntime(runtimeRoot(root), { plotAnimations: { slide: slide([first, second]) } });
    runNextFrame(100);
    const firstAtStart = firstNode.innerHTML;
    const secondAtStart = secondNode.innerHTML;
    runNextFrame(600);

    expect(firstNode.innerHTML).not.toBe(firstAtStart);
    expect(secondNode.innerHTML).not.toBe(secondAtStart);
    expect(requestFrame).toHaveBeenCalledTimes(3);
  });

  it("reconciles nested container, table, and topics Plots", () => {
    const containerPlot = plot("container-plot", { parameter: "t", from: 0, to: 1, durationMs: 1000 });
    const tablePlot = plot("table-plot", { parameter: "t", from: 0, to: 1, durationMs: 1000 });
    const topicsPlot = plot("topics-plot", { parameter: "t", from: 0, to: 1, durationMs: 1000 });
    const elements: PowerShowElement[] = [
      { id: "container", type: "container", hidden: false, children: [containerPlot] },
      {
        id: "table",
        type: "table",
        mode: "structured",
        hidden: false,
        showHeader: false,
        columns: [{ id: "column", header: { id: "header", children: [tablePlot] } }],
        rows: [],
      },
      {
        id: "topics",
        type: "topics",
        hidden: false,
        kind: "unordered",
        items: [{ id: "item", content: { id: "content", children: [topicsPlot] }, children: [] }],
      },
    ];
    const root = new FakeRoot([node(containerPlot), node(tablePlot), node(topicsPlot)]);

    hydrateRendererRuntime(runtimeRoot(root), { plotAnimations: { slide: slide(elements) } });

    expect(requestFrame).toHaveBeenCalledTimes(1);
  });

  it("removes missing or replaced DOM nodes and starts new content from its initial value", () => {
    const first = plot("plot-1", { parameter: "t", from: 0, to: 1, durationMs: 1000 });
    const firstNode = node(first);
    const root = new FakeRoot([firstNode]);
    hydrateRendererRuntime(runtimeRoot(root), { plotAnimations: { slide: slide([first]) } });
    expect(requestFrame).toHaveBeenCalledTimes(1);

    const replacement = plot("plot-1", { parameter: "t", from: 5, to: 6, durationMs: 1000 });
    const replacementNode = node(replacement);
    root.nodes.splice(0, 1, replacementNode);
    hydrateRendererRuntime(runtimeRoot(root), { plotAnimations: { slide: slide([replacement]) } });
    runNextFrame(100);

    expect(replacementNode.innerHTML).toBe(node(replacement).innerHTML);
  });

  it("disables and disposes Plot runtime work without changing authored DOM identity", () => {
    const element = plot("plot-1", { parameter: "t", from: 0, to: 1, durationMs: 1000 });
    const plotNode = node(element);
    const root = new FakeRoot([plotNode]);
    const context = { plotAnimations: { slide: slide([element]) } };

    hydrateRendererRuntime(runtimeRoot(root), context);
    hydrateRendererRuntime(runtimeRoot(root));
    expect(cancelFrame).toHaveBeenCalledTimes(1);
    expect(callbacks.size).toBe(0);

    hydrateRendererRuntime(runtimeRoot(root), context);
    disposeRendererRuntime(runtimeRoot(root));
    disposeRendererRuntime(runtimeRoot(root));
    expect(cancelFrame).toHaveBeenCalledTimes(2);
    expect(plotNode.dataset.powershowId).toBe("plot-1");
    expect(root.innerHTML).not.toContain("y = x + t");
  });

  it("shares valid and fallback frame ownership without leaking source", () => {
    const valid = renderPlotFrame(plot("valid", { parameter: "t", from: 0, to: 1, durationMs: 1000 }));
    const fallback = renderPlotFrame(plot("fallback", { parameter: "t", from: 0, to: 1, durationMs: 1000 }, ""));

    expect(valid?.className).toBe("powershow-plot");
    expect(fallback?.className).toBe("powershow-placeholder powershow-placeholder-plot");
    expect(valid?.content).not.toContain("y = x + t");
    expect(fallback?.content).toBe("[plot]");
  });
});
