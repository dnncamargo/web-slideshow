import type {
  ContentSlot,
  PresentationElement,
  ShapeElement,
  Slide,
  TopicItem,
} from "@web-slideshow/document-schema";

type ShapeNode = HTMLElement & {
  dataset: DOMStringMap;
};

type ShapeAnimationConfig = NonNullable<ShapeElement["animation"]>;
type ShapePlaybackStatus = "idle" | "playing" | "paused" | "completed";

type ShapeInstance = {
  readonly node: ShapeNode;
  readonly elementId: string;
  element: ShapeElement;
  config: ShapeAnimationConfig;
  status: ShapePlaybackStatus;
  elapsedMs: number;
  startTimestamp: number | null;
};

type ShapeAnimationRuntimeState = {
  readonly shapes: Map<ShapeNode, ShapeInstance>;
  frameId: number | null;
};

const runtimeStates = new WeakMap<ParentNode, ShapeAnimationRuntimeState>();

function animationConfigKey(config: ShapeAnimationConfig): string {
  return JSON.stringify(config);
}

function visitContentSlot(
  slot: ContentSlot,
  visit: (element: PresentationElement) => void,
): void {
  slot.children.forEach((element) => visitElement(element, visit));
}

function visitTopicItem(
  item: TopicItem,
  visit: (element: PresentationElement) => void,
): void {
  visitContentSlot(item.content, visit);
  item.children.forEach((child) => visitTopicItem(child, visit));
}

function visitElement(
  element: PresentationElement,
  visit: (element: PresentationElement) => void,
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

function collectAnimatedShapes(slide: Slide): Map<string, ShapeElement> {
  const shapes = new Map<string, ShapeElement>();
  slide.elements.forEach((element) => {
    visitElement(element, (candidate) => {
      if (candidate.type === "shape" && candidate.animation !== undefined && !shapes.has(candidate.id)) {
        shapes.set(candidate.id, candidate);
      }
    });
  });
  return shapes;
}

function collectShapeNodes(root: ParentNode): ShapeNode[] {
  const selector = '[data-presentation-type="shape"][data-presentation-id]';
  const rootElement = root as ParentNode & {
    matches?: (value: string) => boolean;
  };
  const nodes: ShapeNode[] = [];
  if (rootElement.matches?.(selector)) {
    nodes.push(rootElement as ShapeNode);
  }
  nodes.push(...Array.from(root.querySelectorAll<ShapeNode>(selector)));
  return nodes;
}

function formatNumber(value: number): string {
  if (Math.abs(value) < 1e-12) return "0";
  return String(value);
}

function interpolate(from: number, to: number, progress: number): number {
  return from + (to - from) * progress;
}

function hasMotion(config: ShapeAnimationConfig): boolean {
  return config.rotate !== undefined && config.rotate.fromDeg !== config.rotate.toDeg
    || config.translate !== undefined && (
      config.translate.fromXPercent !== config.translate.toXPercent
      || config.translate.fromYPercent !== config.translate.toYPercent
    )
    || config.skew !== undefined && (
      config.skew.fromXDeg !== config.skew.toXDeg
      || config.skew.fromYDeg !== config.skew.toYDeg
    );
}

function transformForProgress(config: ShapeAnimationConfig, progress: number): string {
  const transforms: string[] = [];

  if (config.translate !== undefined) {
    transforms.push(
      `translate(${formatNumber(interpolate(config.translate.fromXPercent, config.translate.toXPercent, progress))}%, ${formatNumber(interpolate(config.translate.fromYPercent, config.translate.toYPercent, progress))}%)`,
    );
  }

  if (config.rotate !== undefined) {
    transforms.push(`rotate(${formatNumber(interpolate(config.rotate.fromDeg, config.rotate.toDeg, progress))}deg)`);
  }

  if (config.skew !== undefined) {
    transforms.push(
      `skew(${formatNumber(interpolate(config.skew.fromXDeg, config.skew.toXDeg, progress))}deg, ${formatNumber(interpolate(config.skew.fromYDeg, config.skew.toYDeg, progress))}deg)`,
    );
  }

  return transforms.join(" ");
}

function applyFrame(instance: ShapeInstance, progress: number): void {
  instance.node.style.transformOrigin = "50% 50%";
  const authoredTransform = instance.node.dataset.presentationAuthoredTransform;
  const animationTransform = transformForProgress(instance.config, progress);
  instance.node.style.transform = authoredTransform !== undefined && authoredTransform !== "none"
    ? `${authoredTransform} ${animationTransform}`.trim()
    : animationTransform;
}

function clearFrame(instance: ShapeInstance): void {
  const authoredTransform = instance.node.dataset.presentationAuthoredTransform;
  instance.node.style.transform = authoredTransform !== undefined && authoredTransform !== "none"
    ? authoredTransform
    : "";
  instance.node.style.transformOrigin = authoredTransform !== undefined && authoredTransform !== "none"
    ? "50% 50%"
    : "";
}

function hasPlayingShapes(state: ShapeAnimationRuntimeState): boolean {
  for (const instance of state.shapes.values()) {
    if (instance.status === "playing") return true;
  }
  return false;
}

function cancelScheduledFrame(state: ShapeAnimationRuntimeState): void {
  if (state.frameId === null) return;
  if (typeof globalThis.cancelAnimationFrame === "function") {
    globalThis.cancelAnimationFrame(state.frameId);
  }
  state.frameId = null;
}

function scheduleFrame(root: ParentNode, state: ShapeAnimationRuntimeState): void {
  if (state.frameId !== null || !hasPlayingShapes(state)) return;
  if (typeof globalThis.requestAnimationFrame !== "function") return;
  state.frameId = globalThis.requestAnimationFrame((timestamp) => {
    if (runtimeStates.get(root) !== state) return;
    state.frameId = null;

    for (const instance of state.shapes.values()) {
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
      applyFrame(instance, elapsed / instance.config.durationMs);

      if (completed) {
        instance.status = "completed";
        instance.startTimestamp = null;
      }
    }

    scheduleFrame(root, state);
  });
}

function createState(): ShapeAnimationRuntimeState {
  return { shapes: new Map(), frameId: null };
}

export function hydrateShapeAnimations(root: ParentNode, slide: Slide, runtimeAutoplay = true): void {
  const canonicalShapes = collectAnimatedShapes(slide);
  const domNodes = collectShapeNodes(root);
  const state = runtimeStates.get(root) ?? createState();
  runtimeStates.set(root, state);
  const currentNodes = new Set(domNodes);

  for (const [node, instance] of state.shapes) {
    const canonical = canonicalShapes.get(instance.elementId);
    if (
      !currentNodes.has(node)
      || canonical === undefined
      || canonical.animation === undefined
      || animationConfigKey(canonical.animation) !== animationConfigKey(instance.config)
    ) {
      clearFrame(instance);
      state.shapes.delete(node);
    }
  }

  const claimedIds = new Set<string>();
  for (const node of domNodes) {
    const elementId = node.dataset.presentationId;
    if (elementId === undefined || claimedIds.has(elementId)) continue;
    const canonical = canonicalShapes.get(elementId);
    if (canonical?.animation === undefined) continue;
    claimedIds.add(elementId);

    const existing = state.shapes.get(node);
    if (existing !== undefined) {
      existing.element = canonical;
      existing.config = canonical.animation;
      continue;
    }

    const instance: ShapeInstance = {
      node,
      elementId,
      element: canonical,
      config: canonical.animation,
      status: runtimeAutoplay && canonical.animation.autoplay !== false && hasMotion(canonical.animation)
        ? "playing"
        : "idle",
      elapsedMs: 0,
      startTimestamp: null,
    };
    state.shapes.set(node, instance);
    applyFrame(instance, 0);
  }

  if (hasPlayingShapes(state)) scheduleFrame(root, state);
  else cancelScheduledFrame(state);
}

export function disposeShapeAnimations(root: ParentNode): void {
  const state = runtimeStates.get(root);
  if (state === undefined) return;
  cancelScheduledFrame(state);
  for (const instance of state.shapes.values()) clearFrame(instance);
  state.shapes.clear();
  runtimeStates.delete(root);
}

export interface ShapeAnimationController {
  play(): void;
  pause(): void;
  reset(): void;
}

function findShapeInstance(
  root: ParentNode,
  elementId: string,
): { state: ShapeAnimationRuntimeState; instance: ShapeInstance } | null {
  const state = runtimeStates.get(root);
  if (state === undefined) return null;
  for (const instance of state.shapes.values()) {
    if (instance.elementId === elementId) return { state, instance };
  }
  return null;
}

export function getShapeAnimationController(
  root: ParentNode,
  elementId: string,
): ShapeAnimationController | null {
  if (findShapeInstance(root, elementId) === null) return null;

  return {
    play(): void {
      const found = findShapeInstance(root, elementId);
      if (found === null) return;
      const { state, instance } = found;
      if (!hasMotion(instance.config)) return;
      if (instance.status === "playing") return;
      if (instance.status === "completed") {
        instance.elapsedMs = 0;
        applyFrame(instance, 0);
      }
      instance.status = "playing";
      instance.startTimestamp = null;
      scheduleFrame(root, state);
    },
    pause(): void {
      const found = findShapeInstance(root, elementId);
      if (found === null) return;
      const { state, instance } = found;
      if (instance.status !== "playing") return;
      instance.status = "paused";
      instance.startTimestamp = null;
      if (!hasPlayingShapes(state)) cancelScheduledFrame(state);
    },
    reset(): void {
      const found = findShapeInstance(root, elementId);
      if (found === null) return;
      const { state, instance } = found;
      instance.status = "idle";
      instance.elapsedMs = 0;
      instance.startTimestamp = null;
      applyFrame(instance, 0);
      if (!hasPlayingShapes(state)) cancelScheduledFrame(state);
    },
  };
}
