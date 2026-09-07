import type {
  ContentSlot,
  PlotElement,
  PowerShowElement,
  Slide,
  TopicItem,
} from "@powershow/document-schema";

import { renderPlotFrame } from "./render-plot";

type PlotNode = HTMLElement & {
  dataset: DOMStringMap;
};

type PlotAnimationConfig = NonNullable<PlotElement["animation"]>;

type PlotPlaybackStatus = "idle" | "playing" | "paused" | "completed";

type PlotInstance = {
  readonly node: PlotNode;
  readonly elementId: string;
  element: PlotElement;
  config: PlotAnimationConfig;
  status: PlotPlaybackStatus;
  elapsedMs: number;
  startTimestamp: number | null;
};

type PlotAnimationRuntimeState = {
  readonly plots: Map<PlotNode, PlotInstance>;
  frameId: number | null;
};

const runtimeStates = new WeakMap<ParentNode, PlotAnimationRuntimeState>();

function animationConfigKey(config: PlotAnimationConfig): string {
  return [
    config.parameter,
    config.from,
    config.to,
    config.durationMs,
    config.loop,
    config.autoplay,
  ].join("\u0000");
}

function visitContentSlot(
  slot: ContentSlot,
  visit: (element: PowerShowElement) => void,
): void {
  slot.children.forEach((element) => visitElement(element, visit));
}

function visitTopicItem(
  item: TopicItem,
  visit: (element: PowerShowElement) => void,
): void {
  visitContentSlot(item.content, visit);
  item.children.forEach((child) => visitTopicItem(child, visit));
}

function visitElement(
  element: PowerShowElement,
  visit: (element: PowerShowElement) => void,
): void {
  visit(element);

  switch (element.type) {
    case "container":
      element.children.forEach((child) => visitElement(child, visit));
      break;
    case "table":
      if (element.mode === "structured") {
        element.columns.forEach((column) => visitContentSlot(column.header, visit));
        element.rows.forEach((row) => row.cells.forEach((cell) => visitContentSlot(cell, visit)));
      }
      break;
    case "topics":
      element.items.forEach((item) => visitTopicItem(item, visit));
      break;
    default:
      break;
  }
}

function collectAnimatedPlots(slide: Slide): Map<string, PlotElement> {
  const plots = new Map<string, PlotElement>();
  slide.elements.forEach((element) => {
    visitElement(element, (candidate) => {
      if (candidate.type === "plot" && candidate.animation !== undefined && !plots.has(candidate.id)) {
        plots.set(candidate.id, candidate);
      }
    });
  });
  return plots;
}

function collectPlotNodes(root: ParentNode): PlotNode[] {
  const selector = '[data-powershow-type="plot"][data-powershow-id]';
  const rootElement = root as ParentNode & {
    matches?: (value: string) => boolean;
  };
  const nodes: PlotNode[] = [];
  if (rootElement.matches?.(selector)) {
    nodes.push(rootElement as PlotNode);
  }
  nodes.push(...Array.from(root.querySelectorAll<PlotNode>(selector)));
  return nodes;
}

function applyFrame(instance: PlotInstance, value: number): void {
  const frame = renderPlotFrame(instance.element, {
    bindings: { [instance.config.parameter]: value },
  });
  if (frame === null) return;
  instance.node.className = `powershow-element ${frame.className}`;
  instance.node.innerHTML = frame.content;
}

function hasPlayingPlots(state: PlotAnimationRuntimeState): boolean {
  for (const instance of state.plots.values()) {
    if (instance.status === "playing") return true;
  }
  return false;
}

function cancelScheduledFrame(state: PlotAnimationRuntimeState): void {
  if (state.frameId === null) return;
  if (typeof globalThis.cancelAnimationFrame === "function") {
    globalThis.cancelAnimationFrame(state.frameId);
  }
  state.frameId = null;
}

function scheduleFrame(root: ParentNode, state: PlotAnimationRuntimeState): void {
  if (state.frameId !== null || !hasPlayingPlots(state)) return;
  if (typeof globalThis.requestAnimationFrame !== "function") return;
  state.frameId = globalThis.requestAnimationFrame((timestamp) => {
    if (runtimeStates.get(root) !== state) return;
    state.frameId = null;

    for (const instance of state.plots.values()) {
      if (instance.status !== "playing") continue;

      if (instance.startTimestamp === null) {
        instance.startTimestamp = timestamp - instance.elapsedMs;
      }

      const rawElapsed = Math.max(0, timestamp - instance.startTimestamp);
      const completed = instance.config.loop === false && rawElapsed >= instance.config.durationMs;
      const elapsed = completed
        ? instance.config.durationMs
        : instance.config.loop === false
          ? Math.min(rawElapsed, instance.config.durationMs)
          : rawElapsed % instance.config.durationMs;
      instance.elapsedMs = elapsed;
      const progress = elapsed / instance.config.durationMs;
      const value = instance.config.from + (instance.config.to - instance.config.from) * progress;
      applyFrame(instance, value);

      if (completed) {
        instance.status = "completed";
        instance.startTimestamp = null;
      }
    }

    scheduleFrame(root, state);
  });
}

function createState(): PlotAnimationRuntimeState {
  return { plots: new Map(), frameId: null };
}

export function hydratePlotAnimations(root: ParentNode, slide: Slide, runtimeAutoplay = true): void {
  const canonicalPlots = collectAnimatedPlots(slide);
  const domNodes = collectPlotNodes(root);
  const state = runtimeStates.get(root) ?? createState();
  runtimeStates.set(root, state);
  const currentNodes = new Set(domNodes);

  for (const [node, instance] of state.plots) {
    const canonical = canonicalPlots.get(instance.elementId);
    if (
      !currentNodes.has(node) ||
      canonical === undefined ||
      canonical.animation === undefined ||
      animationConfigKey(canonical.animation) !== animationConfigKey(instance.config)
    ) {
      state.plots.delete(node);
    }
  }

  const claimedIds = new Set<string>();
  for (const node of domNodes) {
    const elementId = node.dataset.powershowId;
    if (elementId === undefined || claimedIds.has(elementId)) continue;
    const canonical = canonicalPlots.get(elementId);
    if (canonical?.animation === undefined) continue;
    claimedIds.add(elementId);

    const existing = state.plots.get(node);
    if (existing !== undefined) {
      existing.element = canonical;
      existing.config = canonical.animation;
      continue;
    }

    state.plots.set(node, {
      node,
      elementId,
      element: canonical,
      config: canonical.animation,
      status: runtimeAutoplay && canonical.animation.autoplay !== false && canonical.animation.from !== canonical.animation.to
        ? "playing"
        : "idle",
      elapsedMs: 0,
      startTimestamp: null,
    });
  }

  if (hasPlayingPlots(state)) {
    scheduleFrame(root, state);
  } else {
    cancelScheduledFrame(state);
  }
}

export function disposePlotAnimations(root: ParentNode): void {
  const state = runtimeStates.get(root);
  if (state === undefined) return;
  cancelScheduledFrame(state);
  state.plots.clear();
  runtimeStates.delete(root);
}

export interface PlotAnimationController {
  play(): void;
  pause(): void;
  reset(): void;
}

function findPlotInstance(
  root: ParentNode,
  elementId: string,
): { state: PlotAnimationRuntimeState; instance: PlotInstance } | null {
  const state = runtimeStates.get(root);
  if (state === undefined) return null;
  for (const instance of state.plots.values()) {
    if (instance.elementId === elementId) return { state, instance };
  }
  return null;
}

export function getPlotAnimationController(
  root: ParentNode,
  elementId: string,
): PlotAnimationController | null {
  if (findPlotInstance(root, elementId) === null) return null;

  return {
    play(): void {
      const found = findPlotInstance(root, elementId);
      if (found === null) return;
      const { state, instance } = found;
      if (instance.config.from === instance.config.to) return;
      if (instance.status === "playing") return;
      if (instance.status === "completed") {
        instance.elapsedMs = 0;
      }
      instance.status = "playing";
      instance.startTimestamp = null;
      scheduleFrame(root, state);
    },
    pause(): void {
      const found = findPlotInstance(root, elementId);
      if (found === null) return;
      const { state, instance } = found;
      if (instance.status !== "playing") return;
      instance.status = "paused";
      instance.startTimestamp = null;
      if (!hasPlayingPlots(state)) cancelScheduledFrame(state);
    },
    reset(): void {
      const found = findPlotInstance(root, elementId);
      if (found === null) return;
      const { state, instance } = found;
      instance.status = "idle";
      instance.elapsedMs = 0;
      instance.startTimestamp = null;
      applyFrame(instance, instance.config.from);
      if (!hasPlayingPlots(state)) cancelScheduledFrame(state);
    },
  };
}
