import type {
  ContainerElement,
  PowerShowElement,
} from "@powershow/document-schema";

import styles from "../editor-workspace.module.css";

import { ContainerLayoutSection } from "./sections/container-layout-section";

import { ContainerSizeSection } from "./sections/container-size-section";

import { ContainerSpacingSection } from "./sections/container-spacing-section";

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
    </>
  );
}

// ============================================================
// END: CONTAINER INSPECTOR
// ============================================================
