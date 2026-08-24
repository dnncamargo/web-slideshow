import type {
  ContainerElement,
  PowerShowElement,
} from "@powershow/document-schema";

import styles from "../editor-workspace.module.css";

import { ContainerLayoutSection } from "./sections/container-layout-section";

import { ContainerAppearanceSection } from "./sections/container-appearance-section";

import { ContainerEffectsSection } from "./sections/container-effects-section";

import { ContainerSizeSection } from "./sections/container-size-section";

import { ContainerSpacingSection } from "./sections/container-spacing-section";

import { ElementInteractionSection } from "./sections/element-interaction-section";

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

  return (
    <>
      <div className={styles.inspectorDivider} />

      <ContainerLayoutSection element={element} onUpdate={updateContainer} />

      <ContainerSizeSection element={element} onUpdate={updateContainer} />

      <ContainerSpacingSection element={element} onUpdate={updateContainer} />

      <ContainerAppearanceSection element={element} onUpdate={updateContainer} />

      <ContainerEffectsSection element={element} onUpdate={updateContainer} />

      <ElementInteractionSection
        element={element}
        onUpdate={onUpdate}
        controlPrefix="container"
      />

    </>
  );
}

// ============================================================
// END: CONTAINER INSPECTOR
// ============================================================
