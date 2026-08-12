import type {
  ElementPlacement,
  ElementStyle,
  PositionAnchor,
  SignedLength,
} from "@powershow/document-schema";

export type PositionOffsetUnit = "px" | "%";

export function getPositionOffsetUnit(
  value: SignedLength | undefined,
): PositionOffsetUnit {
  return typeof value === "string" && value.endsWith("%") ? "%" : "px";
}

export function serializePositionOffset(
  value: number,
  unit: PositionOffsetUnit,
): SignedLength {
  return unit === "px" ? value : `${value}%`;
}

function updatePlacement(
  style: ElementStyle | undefined,
  update: (placement: ElementPlacement) => ElementPlacement,
): ElementStyle {
  return {
    ...style,
    placement: update(style?.placement ?? { mode: "flow" }),
  };
}

export function updatePlacementMode(
  style: ElementStyle | undefined,
  mode: ElementPlacement["mode"],
): ElementStyle {
  return updatePlacement(style, (placement) => ({ ...placement, mode }));
}

export function updatePlacementAnchor(
  style: ElementStyle | undefined,
  anchor: PositionAnchor,
): ElementStyle {
  return updatePlacement(style, (placement) => ({ ...placement, anchor }));
}

export function updatePlacementOffset(
  style: ElementStyle | undefined,
  axis: "x" | "y",
  offset: SignedLength | undefined,
): ElementStyle {
  return updatePlacement(style, (placement) =>
    axis === "x"
      ? { ...placement, offsetX: offset }
      : { ...placement, offsetY: offset },
  );
}
