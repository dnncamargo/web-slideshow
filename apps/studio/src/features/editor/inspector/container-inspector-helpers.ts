import type {
  ContainerElement,
  Length,
} from "@powershow/document-schema";

export type UpdateContainer = (
  update: (container: ContainerElement) => ContainerElement,
) => void;

export function updateContainerLayoutMode(
  container: ContainerElement,
  layoutMode: "flow" | "stack",
): ContainerElement {
  return {
    ...container,
    layout: {
      ...container.layout,
      children: {
        ...container.layout?.children,
        mode: layoutMode === "flow" ? undefined : layoutMode,
      },
    },
  };
}

export type ContainerPositionMode = "flow" | "absolute";

export type ContainerPositionEdge = "top" | "right" | "bottom" | "left";

export function updateContainerPositionMode(
  container: ContainerElement,
  mode: ContainerPositionMode,
): ContainerElement {
  if (mode === "absolute") {
    const layout = container.layout ?? {};

    return {
      ...container,
      layout: {
        ...layout,
        position: "absolute",
        ...(layout.position === "absolute"
          ? {}
          : { top: 0, left: 0 }),
      },
    };
  }

  const { position: _position, top: _top, right: _right, bottom: _bottom, left: _left, ...layout } =
    container.layout ?? {};

  return {
    ...container,
    ...(Object.keys(layout).length > 0 ? { layout } : { layout: undefined }),
  };
}

export function updateContainerPositionEdge(
  container: ContainerElement,
  edge: ContainerPositionEdge,
  value: Length | undefined,
): ContainerElement {
  if (container.layout?.position !== "absolute") {
    return container;
  }

  return {
    ...container,
    layout: {
      ...container.layout,
      [edge]: value,
    },
  };
}

export function shouldShowContainerLayerControls(
  isAbsolute: boolean,
  parentLayoutMode: string | undefined,
): boolean {
  return isAbsolute || parentLayoutMode === "stack";
}
