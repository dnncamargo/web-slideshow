import type { DividerElement } from "@web-slideshow/document-schema";
import type { AuthoringLengthUnit } from "@web-slideshow/theme/element-style-defaults";

export interface DividerGeometryDefault {
  value: number;
  unit: AuthoringLengthUnit;
  length: number | string;
}

export interface DividerGeometry {
  width: DividerGeometryDefault;
  height: DividerGeometryDefault;
}

/** Deterministic geometry used by both the Divider Inspector and rendering. */
export const DIVIDER_GEOMETRY_DEFAULTS: Readonly<
  Record<DividerElement["orientation"], Readonly<DividerGeometry>>
> = {
  horizontal: {
    width: { value: 100, unit: "%", length: "100%" },
    height: { value: 2, unit: "px", length: 2 },
  },
  vertical: {
    width: { value: 2, unit: "px", length: 2 },
    height: { value: 100, unit: "%", length: "100%" },
  },
};
