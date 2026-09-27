import type { ShapeElement } from "@web-slideshow/document-schema";

import { CanonicalElementSizeSection } from "./sections/canonical-element-size-section";
import { ShapeGeometrySection } from "./sections/shape-geometry-section";
import type { TypedInspectorProps } from "./inspector-types";

export function ShapeInspector({ element, onUpdate }: TypedInspectorProps<ShapeElement>) {
  return (
    <>
      <ShapeGeometrySection
        element={element}
        onUpdate={(update) => onUpdate((current) => current.type === "shape" ? update(current) : current)}
      />

      <CanonicalElementSizeSection
        layout={element.layout}
        onUpdateLayout={(update) => {
          onUpdate((current) => current.type === "shape"
            ? { ...current, layout: update(current.layout) }
            : current);
        }}
      />
    </>
  );
}
