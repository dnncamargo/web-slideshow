import type {
  ContainerElement,
  Length,
  Presentation,
} from "@powershow/document-schema";

import { useStudioI18n } from "@/features/i18n/studio-i18n-context";
import { useAuthoringHistory } from "../../authoring-history-context";

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
import { getContainerShareablePropertySource } from "../linked-style-inspector";
import { ContainerLinkedPropertyMeta } from "./container-linked-property-meta";

interface ContainerPositionSectionProps {
  element: ContainerElement;
  localElement?: ContainerElement;
  presentation?: Pick<Presentation, "linkedStyles">;

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
  localElement = element,
  presentation,
  onUpdate,
  parent,
  layerControls,
}: ContainerPositionSectionProps) {
  const { t } = useStudioI18n();
  const authoringHistory = useAuthoringHistory();
  function runDiscrete(setting: string, callback: () => void): void {
    const meta = { kind: "element.setting", labelKey: "history.element.setting", labelParams: { setting } } as const;
    if (authoringHistory) authoringHistory.discrete(meta, callback);
    else callback();
  }
  const isAbsolute = element.layout?.position === "absolute";
  const showLayerControls =
    layerControls !== null &&
    shouldShowContainerLayerControls(
      isAbsolute,
      parent?.layout?.children?.mode,
    );
  const showPreserveSize = shouldShowContainerPreserveSize(element, parent);
  const linked = presentation?.linkedStyles?.find((style) => style.id === localElement.linkedStyleId);
  const linkedPosition = linked?.layout?.position;
  const linkedFlexShrink = linked?.layout?.flexShrink;
  const source = (property: "layout.position" | "layout.top" | "layout.right" | "layout.bottom" | "layout.left" | "layout.flexShrink") => getContainerShareablePropertySource(presentation, localElement, property);

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
            const mode = event.target.value as "flow" | "absolute";
            const localLayout = localElement.layout;
            const hasLocalPositioning = localLayout?.position !== undefined || EDGES.some((edge) => localLayout?.[edge] !== undefined);
            if ((mode === "flow" && linkedPosition === "absolute") || (mode === "flow" && !hasLocalPositioning) || (mode === "absolute" && localLayout?.position === "absolute")) return;
            runDiscrete("container.positionMode", () => onUpdate((container) =>
              linkedPosition === "absolute" && mode === "flow"
                ? container
                : updateContainerPositionMode(container, mode),
            ));
          }}
        >
          <option value="flow">{t("inspector.flow")}</option>
          <option value="absolute">{t("inspector.absolute")}</option>
        </select>
      </label>
      <ContainerLinkedPropertyMeta source={source("layout.position").source} />

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
                    onUpdate((container) => ({ ...container, layout: { ...container.layout, position: "absolute", [edge]: parseOptionalNumber(event.target.value) } }));
                  }}
                />

                <span>px</span>
              </div>
              <ContainerLinkedPropertyMeta
                source={source(`layout.${edge}` as "layout.top" | "layout.right" | "layout.bottom" | "layout.left").source}
                onReset={source(`layout.${edge}` as "layout.top" | "layout.right" | "layout.bottom" | "layout.left").source === "local" && source(`layout.${edge}` as "layout.top" | "layout.right" | "layout.bottom" | "layout.left").linkedValue !== undefined ? () => onUpdate((container) => {
                  const layout = { ...container.layout, [edge]: undefined };
                  const hasLocalEdge = ["top", "right", "bottom", "left"].some((candidate) => candidate !== edge && layout[candidate as ContainerPositionEdge] !== undefined);
                  return { ...container, layout: hasLocalEdge ? layout : { ...layout, position: undefined } };
                }) : undefined}
              />
            </label>
          ))}
        </div>
      )}

      {showPreserveSize && (
        <label className={styles.checkboxRow}>
          <input
            id="container-preserve-size"
            name="containerPreserveSize"
            type="checkbox"
            checked={element.layout?.flexShrink === 0}
            onChange={(event) => {
              const preserve = event.target.checked;
              if ((preserve && localElement.layout?.flexShrink === 0) || (!preserve && localElement.layout?.flexShrink === undefined) || (linkedFlexShrink === 0 && !preserve)) return;
              runDiscrete("container.preserveSize", () => onUpdate((container) =>
                linkedFlexShrink === 0 && !preserve
                  ? container
                  : updateContainerPreserveSize(container, preserve),
              ));
            }}
          />
          <span title={t("inspector.preserveSizeHelp")}>
            {t("inspector.preserveSize")}
          </span>
          <ContainerLinkedPropertyMeta source={source("layout.flexShrink").source} />
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
