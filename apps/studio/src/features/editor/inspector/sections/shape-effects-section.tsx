import type { ElementEffect } from "@web-slideshow/document-schema";

import { CanonicalElementEffectsSection } from "./canonical-element-effects-section";

interface ShapeEffectsSectionProps {
  effect: ElementEffect | undefined;
  onUpdateEffect: (
    update: (effect: ElementEffect | undefined) => ElementEffect,
  ) => void;
}

export function ShapeEffectsSection({ effect, onUpdateEffect }: ShapeEffectsSectionProps) {
  return (
    <CanonicalElementEffectsSection
      effect={effect}
      onUpdateEffect={onUpdateEffect}
      controlPrefix="shape"
      showOpacity
    />
  );
}
