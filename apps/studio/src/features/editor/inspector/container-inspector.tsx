import type {
  ContainerElement,
  PresentationElement,
  Presentation,
} from "@web-slideshow/document-schema";
import { resolveLinkedContainerStyle } from "@web-slideshow/document-schema";
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
import type { CreateQrCodeFromLink } from "./inspector-types";
import { useStudioI18n } from "@/features/i18n/studio-i18n-context";

interface ContainerInspectorProps {
  element: ContainerElement;

  onUpdate: (update: (element: PresentationElement) => PresentationElement) => void;

  onContainerFitModeChange: (mode: ContainerFitMode | null) => boolean;

  presentation?: Presentation | Pick<Presentation, "linkedStyles">;

  onAttachLinkedStyle?: (linkedStyleId: string) => void;

  onDetachLinkedStyle?: () => void;

  parent?: ContainerElement | null;

  layerControls?: {
    index: number;
    count: number;
    onMoveTo: (index: number) => void;
  } | null;

  onCreateQrFromLink?: CreateQrCodeFromLink;

  rootLocalContentReceiver?: {
    allowed: boolean;
    onChange: (allowed: boolean) => void;
    feedback?: string | null;
  };
}

// ============================================================
// BEGIN: CONTAINER INSPECTOR
// ============================================================

export function ContainerInspector({
  element,
  onUpdate,
  onContainerFitModeChange,
  presentation,
  onAttachLinkedStyle = () => {},
  onDetachLinkedStyle = () => {},
  parent = null,
  layerControls = null,
  onCreateQrFromLink,
  rootLocalContentReceiver,
}: ContainerInspectorProps) {
  const { t } = useStudioI18n();
  const effective = presentation === undefined || !("slides" in presentation)
    ? element
    : { ...element, ...resolveLinkedContainerStyle(presentation, element) };
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
      />

      {rootLocalContentReceiver ? (
        <div className={styles.inspectorGroup}>
          <span className={styles.inspectorLabel}>{t("inspector.rootLocalContent")}</span>
          <label className={styles.checkboxRow}>
            <input
              type="checkbox"
              data-root-local-content-receiver
              checked={rootLocalContentReceiver.allowed}
              onChange={(event) => rootLocalContentReceiver.onChange(event.target.checked)}
            />
            <span>{t("inspector.allowLocalSlideContent")}</span>
          </label>
          <div className={styles.nextStep}>
            {t("inspector.rootLocalContentDescription")}
          </div>
          {rootLocalContentReceiver.feedback ? (
            <span className={styles.status} role="alert">
              {rootLocalContentReceiver.feedback}
            </span>
          ) : null}
        </div>
      ) : null}

      <ContainerLayoutSection
        element={effective}
        localElement={element}
        presentation={presentation}
        onUpdate={updateContainer}
        onContainerFitModeChange={onContainerFitModeChange}
      />

      <ContainerPositionSection
        element={effective}
        localElement={element}
        presentation={presentation}
        onUpdate={updateContainer}
        parent={parent}
        layerControls={layerControls}
      />

      <ContainerSizeSection element={effective} localElement={element} presentation={presentation} onUpdate={updateContainer} />

      <ContainerSpacingSection element={effective} localElement={element} presentation={presentation} onUpdate={updateContainer} />

      <ContainerAppearanceSection element={effective} localElement={element} presentation={presentation} onUpdate={updateContainer} />

      <ContainerEffectsSection element={effective} localElement={element} presentation={presentation} onUpdate={updateContainer} />

      <ElementInteractionSection
        element={element}
        onUpdate={onUpdate}
        controlPrefix="container"
        onCreateQrFromLink={onCreateQrFromLink}
      />

    </>
  );
}

// ============================================================
// END: CONTAINER INSPECTOR
// ============================================================
