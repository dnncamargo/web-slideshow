import type {
  ElementPlacement,
  ElementStyle,
  PositionAnchor,
  SignedLength,
} from "@powershow/document-schema";
import {
  normalizeAuthoringLengthValue,
  parseAuthoringLength,
} from "@powershow/theme/element-style-defaults";

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

export function isCanvasDraggable(style: ElementStyle | undefined): boolean {
  return style?.placement?.mode === "absolute";
}

function getDraggedOffset(
  currentOffset: SignedLength | undefined,
  deltaPx: number,
  parentDimensionPx: number,
): SignedLength | undefined {
  if (deltaPx === 0) {
    return currentOffset;
  }

  const unit = getPositionOffsetUnit(currentOffset);
  const parsed =
    currentOffset === undefined ? { value: 0, unit } : parseAuthoringLength(currentOffset);
  const currentValue = parsed?.value ?? 0;
  const delta =
    unit === "%" && parentDimensionPx > 0
      ? (deltaPx / parentDimensionPx) * 100
      : deltaPx;

  return serializePositionOffset(
    normalizeAuthoringLengthValue(currentValue + delta),
    unit,
  );
}

export function updatePlacementForCanvasDrag(
  style: ElementStyle | undefined,
  deltaX: number,
  deltaY: number,
  parentWidthPx: number,
  parentHeightPx: number,
): ElementStyle | undefined {
  const placement = style?.placement;

  if (placement?.mode !== "absolute") {
    return style;
  }

  const offsetX = getDraggedOffset(
    placement.offsetX,
    deltaX,
    parentWidthPx,
  );
  const offsetY = getDraggedOffset(
    placement.offsetY,
    deltaY,
    parentHeightPx,
  );

  return offsetX === placement.offsetX && offsetY === placement.offsetY
    ? style
    : {
        ...style,
        placement: {
          ...placement,
          ...(offsetX === placement.offsetX ? {} : { offsetX }),
          ...(offsetY === placement.offsetY ? {} : { offsetY }),
        },
      };
}
