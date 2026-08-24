import type { ContainerElement, PowerShowElement } from "@powershow/document-schema";

import { ELEMENT_TYPE_MESSAGE_KEYS } from "@/features/i18n/studio-i18n";

import { useStudioI18n } from "@/features/i18n/studio-i18n-context";

import styles from "./editor-workspace.module.css";

import {
  BlocksInspector,
  CodeInspector,
  ContainerInspector,
  DividerInspector,
  EmbedInspector,
  GalleryInspector,
  ImageInspector,
  ScriptedInspector,
  TableInspector,
  TerminalInspector,
  TextboxInspector,
  TextInspector,
  TopicsInspector,
} from "./inspector";

import type {
  BlocksAuthoringControls,
  ElementInspectorUpdate,
  FontResourceControls,
  TableAuthoringControls,
  TopicsAuthoringControls,
} from "./inspector/inspector-types";
import { ElementPlacementSection } from "./inspector/sections/element-placement-section";
import { CanonicalElementPositionSection } from "./inspector/sections/canonical-text-position-section";
import { shouldShowElementPlacement } from "./inspector/sections/element-placement-helpers";

interface ElementInspectorProps {
  element: PowerShowElement;

  onUpdate: ElementInspectorUpdate;

  fontResourceControls: FontResourceControls;

  preserveImageProportion: boolean;

  onPreserveImageProportionChange: (value: boolean) => void;

  focalEditingImageId: string | null;

  onFocalEditingImageIdChange: (id: string | null) => void;

  parent: ContainerElement | null;

  layerControls: {
    index: number;
    count: number;
    onMoveTo: (index: number) => void;
  } | null;

  topicsAuthoringControls: TopicsAuthoringControls;

  blocksAuthoringControls: BlocksAuthoringControls;

  tableAuthoringControls: TableAuthoringControls;
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
  fontResourceControls,
  preserveImageProportion,
  onPreserveImageProportionChange,
  focalEditingImageId,
  onFocalEditingImageIdChange,
  unsupportedElementHint,
  parent,
  layerControls,
  topicsAuthoringControls,
  blocksAuthoringControls: _blocksAuthoringControls,
  tableAuthoringControls,
}: ElementTypeInspectorProps) {
  switch (element.type) {
    case "container":
      return (
        <ContainerInspector
          element={element}
          onUpdate={onUpdate}
          parent={parent}
          layerControls={layerControls}
        />
      );

    case "text":
      return (
        <TextInspector
          element={element}
          onUpdate={onUpdate}
          fontResourceControls={fontResourceControls}
        />
      );

    case "textbox":
      return (
        <TextboxInspector
          element={element}
          onUpdate={onUpdate}
          fontResourceControls={fontResourceControls}
        />
      );

    case "code":
      return (
        <CodeInspector key={element.id} element={element} onUpdate={onUpdate} />
      );

    case "terminal":
      return <TerminalInspector element={element} onUpdate={onUpdate} />;

    case "image":
      return (
        <ImageInspector
          element={element}
          onUpdate={onUpdate}
          preserveImageProportion={preserveImageProportion}
          onPreserveImageProportionChange={onPreserveImageProportionChange}
          focalEditing={focalEditingImageId === element.id}
          onFocalEditingChange={(editing) => {
            onFocalEditingImageIdChange(editing ? element.id : null);
          }}
        />
      );

    case "table":
      return (
        <TableInspector
          element={element}
          onUpdate={onUpdate}
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
      return <GalleryInspector element={element} onUpdate={onUpdate} />;

    case "topics":
      return (
        <TopicsInspector
          element={element}
          onUpdate={onUpdate}
          fontResourceControls={fontResourceControls}
          topicsAuthoringControls={topicsAuthoringControls}
        />
      );

    case "blocks":
      return (
        <BlocksInspector
          element={element}
          onUpdate={onUpdate}
          blocksAuthoringControls={_blocksAuthoringControls}
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
  fontResourceControls,
  preserveImageProportion,
  onPreserveImageProportionChange,
  focalEditingImageId,
  onFocalEditingImageIdChange,
  parent,
  layerControls,
  topicsAuthoringControls,
  blocksAuthoringControls,
  tableAuthoringControls,
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
        fontResourceControls={fontResourceControls}
        preserveImageProportion={preserveImageProportion}
        onPreserveImageProportionChange={onPreserveImageProportionChange}
        focalEditingImageId={focalEditingImageId}
        onFocalEditingImageIdChange={onFocalEditingImageIdChange}
        parent={parent}
        layerControls={layerControls}
        unsupportedElementHint={t("inspector.unsupportedElementHint")}
        topicsAuthoringControls={topicsAuthoringControls}
        blocksAuthoringControls={blocksAuthoringControls}
        tableAuthoringControls={tableAuthoringControls}
      />

      {element.type !== "container" && shouldShowElementPlacement(layerControls) && (
        element.type === "text" || element.type === "textbox" || element.type === "image" || element.type === "gallery" || element.type === "embed" || element.type === "scripted" ? (
          <CanonicalElementPositionSection
            element={element}
            parent={parent}
            onUpdateLayout={(update) => {
              onUpdate((current) => {
                if (current.type === "textbox") {
                  return { ...current, layout: update(current.layout) };
                }
                if (current.type === "text") {
                  const next = update(current.layout);
                  const { width: _width, height: _height, ...textLayout } = next ?? {};
                  return { ...current, layout: textLayout };
                }
                if (current.type === "image") {
                  return { ...current, layout: update(current.layout) };
                }
                if (current.type === "gallery" || current.type === "embed" || current.type === "scripted") {
                  return { ...current, layout: update(current.layout) };
                }
                return current;
              });
            }}
            layerControls={layerControls}
          />
        ) : (
          <ElementPlacementSection
            element={element}
            parent={parent}
            onUpdateStyle={(update) => {
              onUpdate((current) => {
                if (current.type === "container" || current.type === "text" || current.type === "textbox" || current.type === "image" || current.type === "gallery" || current.type === "embed" || current.type === "scripted") return current;
                return { ...current, style: update(current.style) };
              });
            }}
            layerControls={layerControls}
          />
        )
      )}
    </>
  );
}

// ============================================================
// END: ELEMENT INSPECTOR
// ============================================================
