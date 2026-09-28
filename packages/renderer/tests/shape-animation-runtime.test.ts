import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { ShapeElement, PresentationElement, Slide } from "@web-slideshow/document-schema";

import {
  disposeRendererRuntime,
  getShapeAnimationController,
  hydrateRendererRuntime,
} from "../src/renderer-runtime";

type ShapeNode = {
  dataset: { presentationId: string; presentationType: string; presentationAuthoredTransform?: string };
  style: { transform: string; transformOrigin: string };
  querySelector: () => null;
};

class FakeRoot {
  constructor(readonly nodes: ShapeNode[]) {}

  querySelectorAll<T>(): T[] {
    return this.nodes as T[];
  }

  matches(): boolean {
    return false;
  }
}

function runtimeRoot(root: FakeRoot): ParentNode {
  return root as unknown as ParentNode;
}

const geometry: ShapeElement["geometry"] = {
  mode: "path",
  viewBox: { x: 0, y: 0, width: 100, height: 100 },
  commands: [
    { type: "move", x: 0, y: 0 },
    { type: "line", x: 100, y: 0 },
    { type: "line", x: 100, y: 100 },
    { type: "close" },
  ],
};

function shape(id: string, animation: NonNullable<ShapeElement["animation"]>): ShapeElement {
  return { id, type: "shape", hidden: false, geometry, animation };
}

function node(element: ShapeElement): ShapeNode {
  return {
    dataset: {
      presentationId: element.id,
      presentationType: "shape",
      ...(element.transform === undefined ? {} : {
        presentationAuthoredTransform: `translate(${element.transform.translateXPercent ?? 0}%, ${element.transform.translateYPercent ?? 0}%)${element.transform.rotationDeg === undefined ? "" : ` rotate(${element.transform.rotationDeg}deg)`}`,
      }),
    },
    style: { transform: "", transformOrigin: "" },
    querySelector: () => null,
  };
}

function slide(elements: PresentationElement[]): Slide {
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
  cancelFrame = vi.fn((id: number) => callbacks.delete(id));
  vi.stubGlobal("requestAnimationFrame", requestFrame);
  vi.stubGlobal("cancelAnimationFrame", cancelFrame);
});

afterEach(() => vi.unstubAllGlobals());

describe("Shape animation runtime", () => {
  it("discovers nested Shapes and starts autoplay on one scheduler", () => {
    const first = shape("container-shape", { durationMs: 1000, translate: { fromXPercent: 0, fromYPercent: 0, toXPercent: 10, toYPercent: 0 } });
    const tableShape = shape("table-shape", { durationMs: 1000, rotate: { fromDeg: 0, toDeg: 90 } });
    const topicShape = shape("topic-shape", { durationMs: 1000, skew: { fromXDeg: 0, fromYDeg: 0, toXDeg: 20, toYDeg: 0 } });
    const root = new FakeRoot([node(first), node(tableShape), node(topicShape)]);
    const elements: PresentationElement[] = [
      { id: "container", type: "container", hidden: false, children: [first] },
      {
        id: "table", type: "table", mode: "structured", hidden: false, showHeader: false,
        columns: [{ id: "column", header: { id: "header", children: [tableShape] } }], rows: [],
      },
      {
        id: "topics", type: "topics", hidden: false, kind: "unordered",
        items: [{ id: "item", content: { id: "content", children: [topicShape] }, children: [] }],
      },
    ];

    hydrateRendererRuntime(runtimeRoot(root), { shapeAnimations: { slide: slide(elements) } });

    expect(requestFrame).toHaveBeenCalledTimes(1);
    expect(getShapeAnimationController(runtimeRoot(root), "container-shape")).not.toBeNull();
    expect(getShapeAnimationController(runtimeRoot(root), "table-shape")).not.toBeNull();
    expect(getShapeAnimationController(runtimeRoot(root), "topic-shape")).not.toBeNull();
  });

  it("keeps autoplay-disabled and no-op animations idle", () => {
    const paused = shape("paused", { durationMs: 1000, autoplay: false, rotate: { fromDeg: 0, toDeg: 90 } });
    const flat = shape("flat", { durationMs: 1000, rotate: { fromDeg: 30, toDeg: 30 } });
    const pausedNode = node(paused);
    const flatNode = node(flat);
    const root = new FakeRoot([pausedNode, flatNode]);

    hydrateRendererRuntime(runtimeRoot(root), { shapeAnimations: { slide: slide([paused, flat]) } });

    expect(requestFrame).not.toHaveBeenCalled();
    expect(pausedNode.style.transform).toBe("rotate(0deg)");
    expect(flatNode.style.transform).toBe("rotate(30deg)");
  });

  it("interpolates in deterministic translate, rotate, skew order", () => {
    const element = shape("shape-1", {
      durationMs: 1000,
      translate: { fromXPercent: 0, fromYPercent: 10, toXPercent: 20, toYPercent: 30 },
      rotate: { fromDeg: 0, toDeg: 90 },
      skew: { fromXDeg: 0, fromYDeg: 10, toXDeg: 20, toYDeg: 30 },
    });
    const shapeNode = node(element);
    const root = new FakeRoot([shapeNode]);
    hydrateRendererRuntime(runtimeRoot(root), { shapeAnimations: { slide: slide([element]) } });
    runNextFrame(0);
    runNextFrame(500);

    expect(shapeNode.style.transformOrigin).toBe("50% 50%");
    expect(shapeNode.style.transform).toBe("translate(10%, 20%) rotate(45deg) skew(10deg, 20deg)");
  });

  it("composes animation after authored transform and restores authored state on reset", () => {
    const element = {
      ...shape("shape-static", { durationMs: 1000, rotate: { fromDeg: 0, toDeg: 90 } }),
      transform: { translateXPercent: 12, rotationDeg: 15 },
    } satisfies ShapeElement;
    const shapeNode = node(element);
    const root = new FakeRoot([shapeNode]);
    hydrateRendererRuntime(runtimeRoot(root), { shapeAnimations: { slide: slide([element]) } });
    runNextFrame(0);
    runNextFrame(500);

    expect(shapeNode.style.transform).toBe("translate(12%, 0%) rotate(15deg) rotate(45deg)");
    getShapeAnimationController(runtimeRoot(root), element.id)?.reset();
    expect(shapeNode.style.transform).toBe("translate(12%, 0%) rotate(15deg) rotate(0deg)");
  });

  it("wraps loops and completes non-looping animations at the exact endpoint", () => {
    const loop = shape("loop", { durationMs: 1000, rotate: { fromDeg: 0, toDeg: 360 } });
    const once = shape("once", { durationMs: 1000, loop: false, rotate: { fromDeg: 10, toDeg: 70 } });
    const loopNode = node(loop);
    const onceNode = node(once);
    const root = new FakeRoot([loopNode, onceNode]);
    hydrateRendererRuntime(runtimeRoot(root), { shapeAnimations: { slide: slide([loop, once]) } });
    runNextFrame(100);
    runNextFrame(1350);

    expect(loopNode.style.transform).toBe("rotate(90deg)");
    expect(onceNode.style.transform).toBe("rotate(70deg)");
    expect(callbacks.size).toBe(1);
  });

  it("pauses, resumes, resets to authored from, and restarts after completion", () => {
    const element = shape("shape-1", { durationMs: 1000, loop: false, translate: { fromXPercent: 7, fromYPercent: -3, toXPercent: 17, toYPercent: 3 } });
    const shapeNode = node(element);
    const root = new FakeRoot([shapeNode]);
    hydrateRendererRuntime(runtimeRoot(root), { shapeAnimations: { slide: slide([element]), autoplay: false } });
    const controller = getShapeAnimationController(runtimeRoot(root), element.id);
    controller?.play();
    runNextFrame(100);
    runNextFrame(600);
    const paused = shapeNode.style.transform;
    controller?.pause();
    expect(callbacks.size).toBe(0);
    controller?.play();
    runNextFrame(2000);
    expect(shapeNode.style.transform).toBe(paused);
    runNextFrame(2500);
    controller?.reset();
    expect(shapeNode.style.transform).toBe("translate(7%, -3%)");
    controller?.play();
    runNextFrame(3000);
    runNextFrame(4000);
    expect(shapeNode.style.transform).toBe("translate(17%, 3%)");
    controller?.play();
    runNextFrame(5000);
    expect(shapeNode.style.transform).toBe("translate(7%, -3%)");
  });

  it("replaces changed configuration, removes missing nodes, and disposes frames", () => {
    const initial = shape("shape-1", { durationMs: 1000, rotate: { fromDeg: 0, toDeg: 90 } });
    const shapeNode = node(initial);
    const root = new FakeRoot([shapeNode]);
    hydrateRendererRuntime(runtimeRoot(root), { shapeAnimations: { slide: slide([initial]) } });
    const updated = shape("shape-1", { durationMs: 1000, rotate: { fromDeg: 30, toDeg: 60 } });
    hydrateRendererRuntime(runtimeRoot(root), { shapeAnimations: { slide: slide([updated]) } });
    runNextFrame(100);
    expect(shapeNode.style.transform).toBe("rotate(30deg)");

    root.nodes.splice(0, 1);
    hydrateRendererRuntime(runtimeRoot(root), { shapeAnimations: { slide: slide([updated]) } });
    expect(getShapeAnimationController(runtimeRoot(root), "shape-1")).toBeNull();
    disposeRendererRuntime(runtimeRoot(root));
    expect(cancelFrame).toHaveBeenCalled();
    expect(callbacks.size).toBe(0);
  });
});
