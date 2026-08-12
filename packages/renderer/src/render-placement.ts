import type {
  ElementPlacement,
  PositionAnchor,
  SignedLength,
} from "@powershow/document-schema";

import { renderLength } from "./render-length";

interface AnchorPosition {
  left: string;
  top: string;
  translateX: string;
  translateY: string;
}

const ANCHOR_POSITIONS: Readonly<Record<PositionAnchor, AnchorPosition>> = {
  "top-left": { left: "0", top: "0", translateX: "0", translateY: "0" },
  top: { left: "50%", top: "0", translateX: "-50%", translateY: "0" },
  "top-right": { left: "100%", top: "0", translateX: "-100%", translateY: "0" },
  left: { left: "0", top: "50%", translateX: "0", translateY: "-50%" },
  center: { left: "50%", top: "50%", translateX: "-50%", translateY: "-50%" },
  right: { left: "100%", top: "50%", translateX: "-100%", translateY: "-50%" },
  "bottom-left": { left: "0", top: "100%", translateX: "0", translateY: "-100%" },
  bottom: { left: "50%", top: "100%", translateX: "-50%", translateY: "-100%" },
  "bottom-right": {
    left: "100%",
    top: "100%",
    translateX: "-100%",
    translateY: "-100%",
  },
};

function renderOffset(anchorValue: string, offset: SignedLength | undefined): string {
  return offset === undefined
    ? anchorValue
    : `calc(${anchorValue} + ${renderLength(offset)})`;
}

export function isAbsolutePlacement(
  placement: ElementPlacement | undefined,
): boolean {
  return placement?.mode === "absolute";
}

export function renderPlacement(
  placement: ElementPlacement | undefined,
): string {
  if (placement?.mode !== "absolute") {
    return "";
  }

  const anchor = ANCHOR_POSITIONS[placement.anchor ?? "center"];

  return [
    "position:absolute",
    `left:${renderOffset(anchor.left, placement.offsetX)}`,
    `top:${renderOffset(anchor.top, placement.offsetY)}`,
    `transform:translate(${anchor.translateX},${anchor.translateY})`,
  ].join(";");
}
