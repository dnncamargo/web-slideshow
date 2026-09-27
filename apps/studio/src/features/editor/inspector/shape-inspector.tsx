import type { ShapeElement } from "@web-slideshow/document-schema";

import { CanonicalElementSizeSection } from "./sections/canonical-element-size-section";
import { ElementInteractionSection } from "./sections/element-interaction-section";
import { ShapeAppearanceSection } from "./sections/shape-appearance-section";
import { ShapeEffectsSection } from "./sections/shape-effects-section";
import { ShapeGeometrySection } from "./sections/shape-geometry-section";
import type { TypedInspectorProps } from "./inspector-types";
import type { ElementEffect } from "@web-slideshow/document-schema";

function normalizeEffect(effect: ElementEffect): ElementEffect | undefined {
  return effect.opacity === undefined && effect.shadow === undefined
    ? undefined
    : effect;
}

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

      <ShapeAppearanceSection
        elementId={element.id}
        style={element.style}
        onUpdateStyle={(update) => onUpdate((current) => current.type === "shape" ? { ...current, style: update(current.style) } : current)}
      />

      <ShapeEffectsSection
        effect={element.effect}
        onUpdateEffect={(update) => onUpdate((current) => {
          if (current.type !== "shape") return current;
          return { ...current, effect: normalizeEffect(update(current.effect)) };
        })}
      />

      <ElementInteractionSection
        element={element}
        onUpdate={onUpdate}
        controlPrefix="shape"
      />
    </>
  );
}
