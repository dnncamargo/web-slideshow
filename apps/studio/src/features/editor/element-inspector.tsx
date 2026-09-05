import type { ContainerElement, FontResource, PowerShowElement, Presentation } from "@powershow/document-schema";

import { ELEMENT_TYPE_MESSAGE_KEYS } from "@/features/i18n/studio-i18n";

import { useStudioI18n } from "@/features/i18n/studio-i18n-context";

import styles from "./editor-workspace.module.css";

import {
  BlocksInspector,
  ChartInspector,
  CodeInspector,
  ContainerInspector,
  DividerInspector,
  EmbedInspector,
  GalleryInspector,
  ImageInspector,
  ScriptedInspector,
  TableInspector,
  TerminalInspector,
  TextInspector,
  TopicsInspector,
} from "./inspector";

import type {
  ElementInspectorUpdate,
  TableAuthoringControls,
  TopicsAuthoringControls,
} from "./inspector/inspector-types";
import type { ContainerFitMode } from "./container-fit-authoring";
import { CanonicalElementPositionSection } from "./inspector/sections/canonical-text-position-section";
import { shouldShowElementPositioning } from "./inspector/sections/element-positioning-helpers";

interface ElementInspectorProps {
  element: PowerShowElement;

  onUpdate: ElementInspectorUpdate;

  onContainerFitModeChange: (mode: ContainerFitMode | null) => boolean;

  fontResources: readonly FontResource[];

  presentation?: Presentation;

  onAttachLinkedStyle?: (linkedStyleId: string) => void;

  onDetachLinkedStyle?: () => void;

  preserveImageProportion: boolean;

  onPreserveImageProportionChange: (value: boolean) => void;

  focalEditing?: boolean;

  onFocalEditingChange?: (editing: boolean) => void;

  cropEditing?: boolean;

  onCropEditingChange?: (editing: boolean) => void;

  /** Compatibility props for standalone inspector tests and callers. */
  focalEditingImageId?: string | null;
  onFocalEditingImageIdChange?: (id: string | null) => void;
  cropEditingImageId?: string | null;
  onCropEditingImageIdChange?: (id: string | null) => void;

  parent: ContainerElement | null;

  layerControls: {
    index: number;
    count: number;
    onMoveTo: (index: number) => void;
  } | null;

  topicsAuthoringControls: TopicsAuthoringControls;

  tableAuthoringControls: TableAuthoringControls;

  galleryItemIndex?: number | null;

  onGalleryItemIndexChange?: (index: number | null) => void;
}

interface ElementTypeInspectorProps extends ElementInspectorProps {
  unsupportedElementHint: string;
}

// ============================================================
// BEGIN: INSPECTOR DISPATCHER
// ============================================================

function ElementTypeInspector({
  element,
  onUpdate,
  onContainerFitModeChange,
  fontResources,
  presentation,
  onAttachLinkedStyle = () => {},
  onDetachLinkedStyle = () => {},
  preserveImageProportion,
  onPreserveImageProportionChange,
  focalEditing,
  onFocalEditingChange,
  cropEditing,
  onCropEditingChange,
  focalEditingImageId,
  onFocalEditingImageIdChange,
  cropEditingImageId,
  onCropEditingImageIdChange,
  unsupportedElementHint,
  parent,
  layerControls,
  topicsAuthoringControls,
  tableAuthoringControls,
  galleryItemIndex,
  onGalleryItemIndexChange,
}: ElementTypeInspectorProps) {
  switch (element.type) {
    case "container":
      return (
        <ContainerInspector
          element={element}
          onUpdate={onUpdate}
          onContainerFitModeChange={onContainerFitModeChange}
          presentation={presentation}
          onAttachLinkedStyle={onAttachLinkedStyle}
          onDetachLinkedStyle={onDetachLinkedStyle}
          parent={parent}
          layerControls={layerControls}
        />
      );

    case "text":
      return (
        <TextInspector
          element={element}
          onUpdate={onUpdate}
          fontResources={fontResources}
          presentation={presentation}
          parent={parent}
          layerControls={layerControls}
        />
      );

    case "code":
      return (
        <CodeInspector key={element.id} element={element} onUpdate={onUpdate} fontResources={fontResources} />
      );

    case "chart":
      return <ChartInspector element={element} onUpdate={onUpdate} />;

    case "terminal":
      return <TerminalInspector element={element} onUpdate={onUpdate} fontResources={fontResources} />;

    case "image":
      return (
        <ImageInspector
          element={element}
          onUpdate={onUpdate}
          preserveImageProportion={preserveImageProportion}
          onPreserveImageProportionChange={onPreserveImageProportionChange}
          focalEditing={focalEditing ?? focalEditingImageId === element.id}
          onFocalEditingChange={(editing) => {
            if (editing) onCropEditingChange?.(false);
            if (onFocalEditingChange) onFocalEditingChange(editing);
            else onFocalEditingImageIdChange?.(editing ? element.id : null);
          }}
          cropEditing={cropEditing ?? cropEditingImageId === element.id}
          onCropEditingChange={(editing) => {
            if (editing) onFocalEditingChange?.(false);
            if (onCropEditingChange) onCropEditingChange(editing);
            else onCropEditingImageIdChange?.(editing ? element.id : null);
          }}
        />
      );

    case "table":
      return (
        <TableInspector
          element={element}
          onUpdate={onUpdate}
          fontResources={fontResources}
          tableAuthoringControls={tableAuthoringControls}
        />
      );

    case "divider":
      return <DividerInspector element={element} onUpdate={onUpdate} />;

    case "embed":
      return <EmbedInspector element={element} onUpdate={onUpdate} />;

    case "scripted":
      return (
        <ScriptedInspector
          key={element.id}
          element={element}
          onUpdate={onUpdate}
        />
      );

    case "gallery":
      return <GalleryInspector element={element} onUpdate={onUpdate} selectedItemIndex={galleryItemIndex} onSelectedItemIndexChange={onGalleryItemIndexChange} focalEditing={focalEditing} onFocalEditingChange={onFocalEditingChange} cropEditing={cropEditing} onCropEditingChange={onCropEditingChange} />;

    case "topics":
      return (
        <TopicsInspector
          element={element}
          onUpdate={onUpdate}
          fontResources={fontResources}
          topicsAuthoringControls={topicsAuthoringControls}
        />
      );

    case "blocks":
      return (
        <BlocksInspector
          element={element}
          onUpdate={onUpdate}
        />
      );

    default:
      return (
        <div className={styles.nextStep}>
          <span>{unsupportedElementHint}</span>
        </div>
      );
  }
}

// ============================================================
// END: INSPECTOR DISPATCHER
// ============================================================

// ============================================================
// BEGIN: ELEMENT INSPECTOR
//
// Este componente identifica o elemento selecionado e entrega
// sua edição ao Inspector específico daquele tipo.
// ============================================================

export function ElementInspector({
  element,
  onUpdate,
  onContainerFitModeChange,
  fontResources,
  presentation,
  onAttachLinkedStyle,
  onDetachLinkedStyle,
  preserveImageProportion,
  onPreserveImageProportionChange,
  focalEditing,
  onFocalEditingChange,
  cropEditing,
  onCropEditingChange,
  focalEditingImageId,
  onFocalEditingImageIdChange,
  cropEditingImageId = null,
  onCropEditingImageIdChange = () => {},
  parent,
  layerControls,
  topicsAuthoringControls,
  tableAuthoringControls,
  galleryItemIndex,
  onGalleryItemIndexChange,
}: ElementInspectorProps) {
  const { t } = useStudioI18n();

  return (
    <>
      {/* =====================================================
          BEGIN: IDENTIFICAÇÃO
          ===================================================== */}

      <div className={styles.inspectorGroup}>
        <span className={styles.inspectorLabel}>{t("inspector.element")}</span>

        <strong>
          <span>{t(ELEMENT_TYPE_MESSAGE_KEYS[element.type])}</span>
        </strong>
      </div>

      <div className={styles.inspectorGroup}>
        <span className={styles.inspectorLabel}>{t("inspector.id")}</span>

        <code>{element.id}</code>
      </div>

      {/* =====================================================
          END: IDENTIFICAÇÃO
          ===================================================== */}

      <ElementTypeInspector
        element={element}
        onUpdate={onUpdate}
        onContainerFitModeChange={onContainerFitModeChange}
        fontResources={fontResources}
        presentation={presentation}
        onAttachLinkedStyle={onAttachLinkedStyle}
        onDetachLinkedStyle={onDetachLinkedStyle}
        preserveImageProportion={preserveImageProportion}
        onPreserveImageProportionChange={onPreserveImageProportionChange}
        focalEditing={focalEditing}
        onFocalEditingChange={onFocalEditingChange}
        cropEditing={cropEditing}
        onCropEditingChange={onCropEditingChange}
        focalEditingImageId={focalEditingImageId}
        onFocalEditingImageIdChange={onFocalEditingImageIdChange}
        cropEditingImageId={cropEditingImageId}
        onCropEditingImageIdChange={onCropEditingImageIdChange}
        parent={parent}
        layerControls={layerControls}
        unsupportedElementHint={t("inspector.unsupportedElementHint")}
        topicsAuthoringControls={topicsAuthoringControls}
        tableAuthoringControls={tableAuthoringControls}
        galleryItemIndex={galleryItemIndex}
        onGalleryItemIndexChange={onGalleryItemIndexChange}
      />

      {element.type !== "container" && element.type !== "text" && shouldShowElementPositioning(layerControls) && (
        element.type === "image" || element.type === "gallery" || element.type === "embed" || element.type === "scripted" || element.type === "code" || element.type === "terminal" || element.type === "table" || element.type === "blocks" || element.type === "divider" || element.type === "topics" || element.type === "chart" || element.type === "interactive" ? (
          <CanonicalElementPositionSection
            element={element}
            parent={parent}
            onUpdateLayout={(update) => {
              onUpdate((current) => {
                if (current.type === "text") {
                  const next = update(current.layout);
                  const textLayout = next && "width" in next
                    ? Object.fromEntries(Object.entries(next).filter(([key]) => key !== "width" && key !== "height"))
                    : next;
                  return { ...current, layout: textLayout };
                }
                if (current.type === "image") {
                  return { ...current, layout: update(current.layout) };
                }
                if (current.type === "gallery" || current.type === "embed" || current.type === "scripted") {
                  return { ...current, layout: update(current.layout) };
                }
                if (current.type === "code" || current.type === "terminal" || current.type === "table" || current.type === "blocks") {
                  return { ...current, layout: update(current.layout) };
                }
                if (current.type === "divider" || current.type === "topics" || current.type === "chart" || current.type === "interactive") {
                  return { ...current, layout: update(current.layout) };
                }
                return current;
              });
            }}
            layerControls={layerControls}
          />
        ) : null
      )}
    </>
  );
}

// ============================================================
// END: ELEMENT INSPECTOR
// ============================================================
