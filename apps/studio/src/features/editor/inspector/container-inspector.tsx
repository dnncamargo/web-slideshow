import type {
  ContainerElement,
  PowerShowElement,
  Presentation,
} from "@powershow/document-schema";
import type { ContainerFitMode } from "../container-fit-authoring";

import styles from "../editor-workspace.module.css";

import { ContainerLayoutSection } from "./sections/container-layout-section";

import { ContainerAppearanceSection } from "./sections/container-appearance-section";

import { ContainerEffectsSection } from "./sections/container-effects-section";

import { ContainerSizeSection } from "./sections/container-size-section";

import { ContainerSpacingSection } from "./sections/container-spacing-section";

import { ContainerPositionSection } from "./sections/container-position-section";

import { ElementInteractionSection } from "./sections/element-interaction-section";
import { ContainerLinkedStyleSection } from "./sections/container-linked-style-section";

interface ContainerInspectorProps {
  element: ContainerElement;

  onUpdate: (update: (element: PowerShowElement) => PowerShowElement) => void;

  onContainerFitModeChange: (mode: ContainerFitMode | null) => boolean;

  presentation?: Pick<Presentation, "linkedStyles">;

  onAttachLinkedStyle?: (linkedStyleId: string) => void;

  onDetachLinkedStyle?: () => void;

  onCreateLinkedStyle?: (name: string) => void;

  parent?: ContainerElement | null;

  layerControls?: {
    index: number;
    count: number;
    onMoveTo: (index: number) => void;
  } | null;
}

// ============================================================
// BEGIN: CONTAINER INSPECTOR
// ============================================================

export function ContainerInspector({
  element,
  onUpdate,
  onContainerFitModeChange,
  presentation = {},
  onAttachLinkedStyle = () => {},
  onDetachLinkedStyle = () => {},
  onCreateLinkedStyle = () => {},
  parent = null,
  layerControls = null,
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

      <ContainerLinkedStyleSection
        element={element}
        presentation={presentation}
        onAttach={onAttachLinkedStyle}
        onDetach={onDetachLinkedStyle}
        onCreate={onCreateLinkedStyle}
      />

      <ContainerLayoutSection
        element={element}
        onUpdate={updateContainer}
        onContainerFitModeChange={onContainerFitModeChange}
      />

      <ContainerPositionSection
        element={element}
        onUpdate={updateContainer}
        parent={parent}
        layerControls={layerControls}
      />

      <ContainerSizeSection element={element} onUpdate={updateContainer} />

      <ContainerSpacingSection element={element} presentation={presentation} onUpdate={updateContainer} />

      <ContainerAppearanceSection element={element} presentation={presentation} onUpdate={updateContainer} />

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
