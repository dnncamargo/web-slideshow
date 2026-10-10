import type { ContainerElement, FontResource, PresentationElement, Presentation } from "@web-slideshow/document-schema";

import { ELEMENT_TYPE_MESSAGE_KEYS } from "@/features/i18n/studio-i18n";

import { useStudioI18n } from "@/features/i18n/studio-i18n-context";

import styles from "./editor-workspace.module.css";

import {
  BlocksInspector,
  PlotInspector,
  CodeInspector,
  ContainerInspector,
  DividerInspector,
  EmbedInspector,
  GalleryInspector,
  ImageInspector,
  ScriptedInspector,
  ShapeInspector,
  TableInspector,
  TerminalInspector,
  TextInspector,
  TopicsInspector,
} from "./inspector";

import type {
  ElementInspectorUpdate,
  CreateQrCodeFromLink,
  PlotPreviewControls,
  ShapePreviewControls,
  ShapePathSourceEditRequest,
  ShapeSvgImportCompositionHandler,
  ScriptedSourceEditRequest,
  ScriptedSourceKind,
  TableAuthoringControls,
  TopicsAuthoringControls,
} from "./inspector/inspector-types";
import { CanonicalElementPositionSection } from "./inspector/sections/canonical-text-position-section";
import { ElementInteractionSection } from "./inspector/sections/element-interaction-section";
import { shouldShowElementPositioning } from "./inspector/sections/element-positioning-helpers";
import type { TableStructuralSelection } from "./table-tree-helpers";
import { inspectTargetLinkedStyle } from "./inspector/linked-style-inspector";

interface ElementInspectorProps {
  element: PresentationElement;

  readOnly?: boolean;

  onUpdate: ElementInspectorUpdate;

  plotPreviewControls?: PlotPreviewControls;

  shapePreviewControls?: ShapePreviewControls;

  onImportSvgComposition?: ShapeSvgImportCompositionHandler;

  fontResources: readonly FontResource[];

  presentation?: Presentation;

  onAttachLinkedStyle?: (linkedStyleId: string) => void;

  onDetachLinkedStyle?: () => void;

  onAttachLinkedTopicsStyle?: (linkedStyleId: string) => void;

  onDetachLinkedTopicsStyle?: () => void;

  onAttachLinkedTargetStyle?: (linkedStyleId: string) => void;

  onDetachLinkedTargetStyle?: () => void;

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

  ancestorContainers?: readonly ContainerElement[];

  layerControls: {
    index: number;
    count: number;
    onMoveTo: (index: number) => void;
  } | null;

  topicsAuthoringControls: TopicsAuthoringControls;

  tableAuthoringControls: TableAuthoringControls;

  selectedTableStructuralNode?: TableStructuralSelection;

  onSelectTableStructuralNode?: (selection: TableStructuralSelection) => void;

  galleryItemIndex?: number | null;

  onGalleryItemIndexChange?: (index: number | null) => void;

  onCreateQrFromLink?: CreateQrCodeFromLink;

  rootLocalContentReceiver?: {
    allowed: boolean;
    onChange: (allowed: boolean) => void;
    feedback?: string | null;
  };

  onEditScriptedSource?: (request: ScriptedSourceEditRequest) => void;

  onEditShapePathSource?: (request: ShapePathSourceEditRequest) => void;

  activeScriptedSource?: ScriptedSourceKind | null;

  scriptedSourceEditorActive?: boolean;

  scriptedSourceEditorDirty?: boolean;

  shapeSourceEditorActive?: boolean;
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
  plotPreviewControls,
  shapePreviewControls,
  onImportSvgComposition,
  fontResources,
  presentation,
  onAttachLinkedStyle = () => {},
  onDetachLinkedStyle = () => {},
  onAttachLinkedTopicsStyle,
  onDetachLinkedTopicsStyle,
  onAttachLinkedTargetStyle = () => {},
  onDetachLinkedTargetStyle = () => {},
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
  ancestorContainers,
  layerControls,
  topicsAuthoringControls,
  tableAuthoringControls,
  selectedTableStructuralNode,
  onSelectTableStructuralNode,
  galleryItemIndex,
  onGalleryItemIndexChange,
  rootLocalContentReceiver,
  onEditScriptedSource,
  onEditShapePathSource,
  activeScriptedSource,
  scriptedSourceEditorActive,
  scriptedSourceEditorDirty,
  shapeSourceEditorActive,
}: ElementTypeInspectorProps) {
  switch (element.type) {
    case "container":
      return (
        <ContainerInspector
          element={element}
          onUpdate={onUpdate}
          presentation={presentation}
          onAttachLinkedStyle={onAttachLinkedStyle}
          onDetachLinkedStyle={onDetachLinkedStyle}
          parent={parent}
          layerControls={layerControls}
          rootLocalContentReceiver={rootLocalContentReceiver}
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
          ancestorContainers={ancestorContainers}
          layerControls={layerControls}
        />
      );

    case "code":
      return (
        <CodeInspector key={element.id} element={element} onUpdate={onUpdate} fontResources={fontResources} presentation={presentation} onAttachLinkedStyle={onAttachLinkedTargetStyle} onDetachLinkedStyle={onDetachLinkedTargetStyle} />
      );

    case "plot":
      return <PlotInspector element={element} onUpdate={onUpdate} previewControls={plotPreviewControls} />;

    case "shape":
      return <ShapeInspector element={element} onUpdate={onUpdate} previewControls={shapePreviewControls} onImportSvgComposition={onImportSvgComposition} onEditPathSource={onEditShapePathSource} largeSourceEditorActive={shapeSourceEditorActive} presentationFiles={presentation?.resources?.files ?? []} />;

    case "terminal":
      return <TerminalInspector element={element} onUpdate={onUpdate} fontResources={fontResources} presentation={presentation} onAttachLinkedStyle={onAttachLinkedTargetStyle} onDetachLinkedStyle={onDetachLinkedTargetStyle} />;

    case "image":
      return (
        <ImageInspector
          element={element}
          onUpdate={onUpdate}
          presentationFiles={presentation?.resources?.files ?? []}
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
          parent={parent}
          ancestorContainers={ancestorContainers}
          presentation={presentation}
          selectedTableStructuralNode={selectedTableStructuralNode}
          onSelectTableStructuralNode={onSelectTableStructuralNode}
          onAttachLinkedStyle={onAttachLinkedTargetStyle}
          onDetachLinkedStyle={onDetachLinkedTargetStyle}
        />
      );

    case "divider":
      return <DividerInspector element={element} onUpdate={onUpdate} presentation={presentation} onAttachLinkedStyle={onAttachLinkedTargetStyle} onDetachLinkedStyle={onDetachLinkedTargetStyle} />;

    case "embed":
      return <EmbedInspector element={element} onUpdate={onUpdate} />;

    case "scripted":
      return (
        <ScriptedInspector
          key={element.id}
          element={element}
          onUpdate={onUpdate}
          presentationFiles={presentation?.resources?.files ?? []}
          onEditSource={onEditScriptedSource}
          activeSource={activeScriptedSource}
          largeSourceEditorActive={scriptedSourceEditorActive}
          largeSourceEditorDirty={scriptedSourceEditorDirty}
        />
      );

    case "gallery":
      return <GalleryInspector element={element} onUpdate={onUpdate} presentationFiles={presentation?.resources?.files ?? []} selectedItemIndex={galleryItemIndex} onSelectedItemIndexChange={onGalleryItemIndexChange} focalEditing={focalEditing} onFocalEditingChange={onFocalEditingChange} cropEditing={cropEditing} onCropEditingChange={onCropEditingChange} />;

    case "topics":
      return (
        <TopicsInspector
          element={element}
          onUpdate={onUpdate}
          fontResources={fontResources}
          topicsAuthoringControls={topicsAuthoringControls}
          presentation={presentation}
          onAttachLinkedTopicsStyle={onAttachLinkedTopicsStyle}
          onDetachLinkedTopicsStyle={onDetachLinkedTopicsStyle}
          parent={parent}
          ancestorContainers={ancestorContainers}
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
  readOnly = false,
  onUpdate,
  plotPreviewControls,
  shapePreviewControls,
  onImportSvgComposition,
  fontResources,
  presentation,
  onAttachLinkedStyle,
  onDetachLinkedStyle,
  onAttachLinkedTopicsStyle,
  onDetachLinkedTopicsStyle,
  onAttachLinkedTargetStyle,
  onDetachLinkedTargetStyle,
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
  ancestorContainers,
  layerControls,
  topicsAuthoringControls,
  tableAuthoringControls,
  selectedTableStructuralNode,
  onSelectTableStructuralNode,
  galleryItemIndex,
  onGalleryItemIndexChange,
  onCreateQrFromLink,
  rootLocalContentReceiver,
  onEditScriptedSource,
  onEditShapePathSource,
  activeScriptedSource,
  scriptedSourceEditorActive,
  scriptedSourceEditorDirty,
  shapeSourceEditorActive,
}: ElementInspectorProps) {
  const { t } = useStudioI18n();
  const targetInspection = (element.type === "code" || element.type === "terminal" || element.type === "table" || element.type === "divider")
    ? inspectTargetLinkedStyle(presentation, element)
    : undefined;
  const targetPositionProperties = targetInspection === undefined ? [] : (["position", "top", "right", "bottom", "left"] as const).filter((field) => targetInspection.getProperty(`layout.${field}` as never).owned);

  if (readOnly) {
    return (
      <>
        <div className={styles.inspectorGroup}>
          <span className={styles.inspectorLabel}>{t("inspector.element")}</span>
          <strong>{t(ELEMENT_TYPE_MESSAGE_KEYS[element.type])}</strong>
        </div>
        <div className={styles.inspectorGroup}>
          <span className={styles.inspectorLabel}>{t("inspector.id")}</span>
          <code>{element.id}</code>
        </div>
        <div className={styles.nextStep}>
          <span>{t("editor.masterReadOnly")}</span>
        </div>
      </>
    );
  }

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
        onUpdate={(update) => {
          // Rich text and ColorControl explicitly mark their next element
          // update through the authoring boundary. Other inspector writes
          // retain the existing compatibility path.
          onUpdate(update);
        }}
        plotPreviewControls={plotPreviewControls}
        shapePreviewControls={shapePreviewControls}
        onImportSvgComposition={onImportSvgComposition}
        fontResources={fontResources}
        presentation={presentation}
        onAttachLinkedStyle={onAttachLinkedStyle}
        onDetachLinkedStyle={onDetachLinkedStyle}
        onAttachLinkedTopicsStyle={onAttachLinkedTopicsStyle}
        onDetachLinkedTopicsStyle={onDetachLinkedTopicsStyle}
        onAttachLinkedTargetStyle={onAttachLinkedTargetStyle}
        onDetachLinkedTargetStyle={onDetachLinkedTargetStyle}
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
        ancestorContainers={ancestorContainers}
        layerControls={layerControls}
        unsupportedElementHint={t("inspector.unsupportedElementHint")}
        topicsAuthoringControls={topicsAuthoringControls}
        tableAuthoringControls={tableAuthoringControls}
        selectedTableStructuralNode={selectedTableStructuralNode}
        onSelectTableStructuralNode={onSelectTableStructuralNode}
        galleryItemIndex={galleryItemIndex}
        onGalleryItemIndexChange={onGalleryItemIndexChange}
        rootLocalContentReceiver={rootLocalContentReceiver}
        onEditScriptedSource={onEditScriptedSource}
        onEditShapePathSource={onEditShapePathSource}
        activeScriptedSource={activeScriptedSource}
        scriptedSourceEditorActive={scriptedSourceEditorActive}
        scriptedSourceEditorDirty={scriptedSourceEditorDirty}
        shapeSourceEditorActive={shapeSourceEditorActive}
      />

      {element.type !== "container" && element.type !== "text" && shouldShowElementPositioning(layerControls) && (
        element.type === "image" || element.type === "gallery" || element.type === "embed" || element.type === "scripted" || element.type === "code" || element.type === "terminal" || element.type === "table" || element.type === "blocks" || element.type === "divider" || element.type === "topics" || element.type === "plot" || element.type === "interactive" || element.type === "shape" ? (
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
                if (current.type === "divider" || current.type === "topics" || current.type === "plot" || current.type === "interactive" || current.type === "shape") {
                  return { ...current, layout: update(current.layout) };
                }
                return current;
              });
            }}
            layerControls={layerControls}
            effectiveLayout={targetInspection?.resolved?.layout}
            disabledFields={targetPositionProperties}
          />
        ) : null
      )}

      {(element.type === "text" || element.type === "image" || element.type === "container" || element.type === "shape") && (
        <ElementInteractionSection
          element={element}
          onUpdate={onUpdate}
          controlPrefix={element.type}
          onCreateQrFromLink={element.type === "shape" ? undefined : onCreateQrFromLink}
        />
      )}
    </>
  );
}

// ============================================================
// END: ELEMENT INSPECTOR
// ============================================================
