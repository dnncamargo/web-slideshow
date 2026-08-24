export type ElementLayerControls = {
  index: number;
  count: number;
  onMoveTo: (index: number) => void;
};

export function shouldShowElementPositioning(
  layerControls: ElementLayerControls | null,
): layerControls is ElementLayerControls {
  return layerControls !== null;
}

export function shouldShowPositionLayerControls(
  isAbsolute: boolean,
  parentLayoutMode: string | undefined,
): boolean {
  return isAbsolute || parentLayoutMode === "stack";
}
