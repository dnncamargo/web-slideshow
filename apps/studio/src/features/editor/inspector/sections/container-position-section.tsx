import type {
  ContainerElement,
  Length,
} from "@powershow/document-schema";

import { useStudioI18n } from "@/features/i18n/studio-i18n-context";

import styles from "../../editor-workspace.module.css";

import {
  shouldShowContainerLayerControls,
  shouldShowContainerPreserveSize,
  type ContainerPositionEdge,
  type UpdateContainer,
  updateContainerPositionEdge,
  updateContainerPositionMode,
  updateContainerPreserveSize,
} from "../container-inspector-helpers";

import { readAbsoluteNumber, parseOptionalNumber } from "../inspector-helpers";
import { InspectorSection } from "../inspector-section";

interface ContainerPositionSectionProps {
  element: ContainerElement;

  onUpdate: UpdateContainer;

  parent: ContainerElement | null;

  layerControls: {
    index: number;
    count: number;
    onMoveTo: (index: number) => void;
  } | null;
}

const EDGES: readonly ContainerPositionEdge[] = [
  "top",
  "right",
  "bottom",
  "left",
];

export function ContainerPositionSection({
  element,
  onUpdate,
  parent,
  layerControls,
}: ContainerPositionSectionProps) {
  const { t } = useStudioI18n();
  const isAbsolute = element.layout?.position === "absolute";
  const showLayerControls =
    layerControls !== null &&
    shouldShowContainerLayerControls(
      isAbsolute,
      parent?.layout?.children?.mode,
    );
  const showPreserveSize = shouldShowContainerPreserveSize(element, parent);

  function updateEdge(edge: ContainerPositionEdge, value: Length | undefined) {
    onUpdate((container) => updateContainerPositionEdge(container, edge, value));
  }

  return (
    <InspectorSection title={t("inspector.position")} defaultOpen>
      <label className={styles.field}>
        <span>{t("inspector.position")}</span>

        <select
          id="container-position-mode"
          name="containerPositionMode"
          value={isAbsolute ? "absolute" : "flow"}
          onChange={(event) => {
            onUpdate((container) =>
              updateContainerPositionMode(
                container,
                event.target.value as "flow" | "absolute",
              ),
            );
          }}
        >
          <option value="flow">{t("inspector.flow")}</option>
          <option value="absolute">{t("inspector.absolute")}</option>
        </select>
      </label>

      {isAbsolute && (
        <div className={styles.fieldGrid}>
          {EDGES.map((edge) => (
            <label className={styles.field} key={edge}>
              <span>{t(`inspector.${edge}`)}</span>

              <div className={styles.unitInput}>
                <input
                  id={`container-position-${edge}`}
                  name={`containerPosition${edge[0].toUpperCase()}${edge.slice(1)}`}
                  type="number"
                  inputMode="decimal"
                  value={readAbsoluteNumber(element.layout?.[edge])}
                  onChange={(event) => {
                    updateEdge(edge, parseOptionalNumber(event.target.value));
                  }}
                />

                <span>px</span>
              </div>
            </label>
          ))}
        </div>
      )}

      {showPreserveSize && (
        <label className={styles.checkboxRow}>
          <span title={t("inspector.preserveSizeHelp")}>
            {t("inspector.preserveSize")}
          </span>

          <input
            id="container-preserve-size"
            name="containerPreserveSize"
            type="checkbox"
            checked={element.layout?.flexShrink === 0}
            onChange={(event) => {
              onUpdate((container) =>
                updateContainerPreserveSize(container, event.target.checked),
              );
            }}
          />
        </label>
      )}

      {showLayerControls && layerControls !== null && (
        <div className={styles.positionLayerActions}>
          <button
            type="button"
            disabled={layerControls.index === 0}
            onClick={() => layerControls.onMoveTo(0)}
          >
            {t("inspector.sendToBack")}
          </button>
          <button
            type="button"
            disabled={layerControls.index === layerControls.count - 1}
            onClick={() => layerControls.onMoveTo(layerControls.count - 1)}
          >
            {t("inspector.bringToFront")}
          </button>
        </div>
      )}
    </InspectorSection>
  );
}
