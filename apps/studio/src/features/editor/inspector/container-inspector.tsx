import type {
  ContainerElement,
  PowerShowElement,
} from "@powershow/document-schema";

import styles from "../editor-workspace.module.css";

import { ContainerLayoutSection } from "./sections/container-layout-section";

import { ContainerSizeSection } from "./sections/container-size-section";

import { ContainerSpacingSection } from "./sections/container-spacing-section";

import { ElementAppearanceSection } from "./sections/element-appearance-section";

import { ElementEffectsSection } from "./sections/element-effects-section";

import type { UpdateElementStyle } from "./inspector-types";

interface ContainerInspectorProps {
  element: ContainerElement;

  onUpdate: (update: (element: PowerShowElement) => PowerShowElement) => void;
}

// ============================================================
// BEGIN: CONTAINER INSPECTOR
// ============================================================

export function ContainerInspector({
  element,
  onUpdate,
}: ContainerInspectorProps) {
  function updateContainer(
    update: (container: ContainerElement) => ContainerElement,
  ) {
    onUpdate((current) => {
      if (current.type !== "container") {
        return current;
      }

      return update(current);
    });
  }

  const updateStyle: UpdateElementStyle = (update) => {
    updateContainer((container) => ({
      ...container,

      style: update(container.style),
    }));
  };

  return (
    <>
      <div className={styles.inspectorDivider} />

      <ContainerLayoutSection element={element} onUpdate={updateContainer} />

      <ContainerSizeSection element={element} onUpdate={updateContainer} />

      <ContainerSpacingSection element={element} onUpdate={updateContainer} />

      <ElementAppearanceSection
        style={element.style}
        onUpdateStyle={updateStyle}
        controlPrefix="container"
        showBackground
        showBackgroundGradient
        showRoundedCorners
        showOpacity
        showBorder
      />

      <ElementEffectsSection
        style={element.style}
        onUpdateStyle={updateStyle}
        controlPrefix="container"
      />
    </>
  );
}

// ============================================================
// END: CONTAINER INSPECTOR
// ============================================================
