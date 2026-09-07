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

type PlotInstance = {
  readonly node: PlotNode;
  readonly elementId: string;
  readonly element: PlotElement;
  readonly config: PlotAnimationConfig;
  startTimestamp: number | null;
  active: boolean;
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

function hasActivePlots(state: PlotAnimationRuntimeState): boolean {
  for (const instance of state.plots.values()) {
    if (instance.active) return true;
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
  if (state.frameId !== null || !hasActivePlots(state)) return;
  if (typeof globalThis.requestAnimationFrame !== "function") return;
  state.frameId = globalThis.requestAnimationFrame((timestamp) => {
    if (runtimeStates.get(root) !== state) return;
    state.frameId = null;

    for (const instance of state.plots.values()) {
      if (!instance.active) continue;

      if (instance.startTimestamp === null) {
        instance.startTimestamp = timestamp;
        applyFrame(instance, instance.config.from);
        continue;
      }

      const elapsed = Math.max(0, timestamp - instance.startTimestamp);
      const completed = instance.config.loop === false && elapsed >= instance.config.durationMs;
      const progress = completed
        ? 1
        : instance.config.loop === false
          ? Math.min(elapsed / instance.config.durationMs, 1)
          : (elapsed % instance.config.durationMs) / instance.config.durationMs;
      const value = instance.config.from + (instance.config.to - instance.config.from) * progress;
      applyFrame(instance, value);

      if (completed) instance.active = false;
    }

    scheduleFrame(root, state);
  });
}

function createState(): PlotAnimationRuntimeState {
  return { plots: new Map(), frameId: null };
}

export function hydratePlotAnimations(root: ParentNode, slide: Slide): void {
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
    if (existing !== undefined) continue;

    state.plots.set(node, {
      node,
      elementId,
      element: canonical,
      config: canonical.animation,
      startTimestamp: null,
      active: canonical.animation.autoplay !== false && canonical.animation.from !== canonical.animation.to,
    });
  }

  if (hasActivePlots(state)) {
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
