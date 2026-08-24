import type {
  ContainerElement,
  ImageElement,
  PowerShowElement,
  PositionAnchor,
  SignedLength,
  TextElement,
  TextboxElement,
} from "@powershow/document-schema";

import { useStudioI18n } from "@/features/i18n/studio-i18n-context";

import styles from "../../editor-workspace.module.css";

import { InspectorSection } from "../inspector-section";
import type { UpdateElementStyle } from "../inspector-types";

import {
  getPositionOffsetUnit,
  serializePositionOffset,
  shouldShowPlacementLayerControls,
  updatePlacementAnchor,
  updatePlacementMode,
  updatePlacementOffset,
  type PositionOffsetUnit,
} from "./element-placement-helpers";

const ANCHORS: readonly PositionAnchor[] = [
  "top-left",
  "top",
  "top-right",
  "left",
  "center",
  "right",
  "bottom-left",
  "bottom",
  "bottom-right",
];

const ANCHOR_SYMBOLS: Readonly<Record<PositionAnchor, string>> = {
  "top-left": "↖",
  top: "↑",
  "top-right": "↗",
  left: "←",
  center: "●",
  right: "→",
  "bottom-left": "↙",
  bottom: "↓",
  "bottom-right": "↘",
};

interface LayerControls {
  index: number;
  count: number;
  onMoveTo: (index: number) => void;
}

interface ElementPlacementSectionProps {
  element: Exclude<PowerShowElement, ContainerElement | TextElement | TextboxElement | ImageElement | Extract<PowerShowElement, { type: "gallery" | "embed" | "scripted" }>>;
  parent: ContainerElement | null;
  onUpdateStyle: UpdateElementStyle;
  layerControls: LayerControls;
}

function PositionOffsetInput({
  axis,
  value,
  onChange,
}: {
  axis: "x" | "y";
  value: SignedLength | undefined;
  onChange: (value: SignedLength | undefined) => void;
}) {
  const unit = getPositionOffsetUnit(value);
  const numericValue =
    value === undefined
      ? 0
      : typeof value === "number"
        ? value
        : Number(value.slice(0, unit === "%" ? -1 : -2));

  return (
    <div className={styles.unitInput}>
      <input
        id={`element-offset-${axis}`}
        name={`elementOffset${axis.toUpperCase()}`}
        type="number"
        inputMode="decimal"
        value={Number.isFinite(numericValue) ? numericValue : 0}
        onChange={(event) => {
          const nextValue = event.target.value.trim();
          onChange(
            nextValue === ""
              ? undefined
              : serializePositionOffset(Number(nextValue), unit),
          );
        }}
      />

      <select
        id={`element-offset-${axis}-unit`}
        name={`elementOffset${axis.toUpperCase()}Unit`}
        value={unit}
        onChange={(event) => {
          const nextUnit = event.target.value as PositionOffsetUnit;
          onChange(serializePositionOffset(numericValue, nextUnit));
        }}
      >
        <option value="px">px</option>
        <option value="%">%</option>
      </select>
    </div>
  );
}

export function ElementPlacementSection({
  element,
  parent,
  onUpdateStyle,
  layerControls,
}: ElementPlacementSectionProps) {
  const { t } = useStudioI18n();
  const placement = element.style?.placement;
  const isAbsolute = placement?.mode === "absolute";
  const layerControlsVisible = shouldShowPlacementLayerControls(
    isAbsolute,
    parent?.layout?.children?.mode,
  );

  return (
    <InspectorSection title={t("inspector.placement")}>
      <label className={styles.field}>
        <span title={t("inspector.positionHelp")}>{t("inspector.position")}</span>

        <select
          id="element-placement-mode"
          name="elementPlacementMode"
          value={placement?.mode ?? "flow"}
          onChange={(event) => {
            onUpdateStyle((style) =>
              updatePlacementMode(
                style,
                event.target.value as "flow" | "absolute",
              ),
            );
          }}
        >
          <option value="flow">{t("inspector.flow")}</option>
          <option value="absolute">{t("inspector.absolute")}</option>
        </select>

        <small className={styles.fieldHint}>{t("inspector.canvasSnapHelp")}</small>
      </label>

      {isAbsolute && (
        <>
          <div className={styles.field}>
            <span>{t("inspector.anchor")}</span>

            <div className={styles.positionAnchorGrid}>
              {ANCHORS.map((anchor) => (
                <button
                  key={anchor}
                  className={styles.positionAnchorButton}
                  type="button"
                  aria-label={t(`inspector.anchor.${anchor}`)}
                  title={t(`inspector.anchor.${anchor}`)}
                  aria-pressed={(placement.anchor ?? "center") === anchor}
                  onClick={() => {
                    onUpdateStyle((style) => updatePlacementAnchor(style, anchor));
                  }}
                >
                  {ANCHOR_SYMBOLS[anchor]}
                </button>
              ))}
            </div>
          </div>

          <div className={styles.fieldGrid}>
            <label className={styles.field}>
              <span>{t("inspector.xOffset")}</span>
              <PositionOffsetInput
                axis="x"
                value={placement?.offsetX}
                onChange={(offsetX) => {
                  onUpdateStyle((style) =>
                    updatePlacementOffset(style, "x", offsetX),
                  );
                }}
              />
            </label>

            <label className={styles.field}>
              <span>{t("inspector.yOffset")}</span>
              <PositionOffsetInput
                axis="y"
                value={placement?.offsetY}
                onChange={(offsetY) => {
                  onUpdateStyle((style) =>
                    updatePlacementOffset(style, "y", offsetY),
                  );
                }}
              />
            </label>
          </div>
        </>
      )}

      {layerControlsVisible && (
        <div className={styles.positionLayerActions}>
          <button type="button" disabled={layerControls.index === 0} onClick={() => layerControls.onMoveTo(0)}>
            {t("inspector.sendToBack")}
          </button>
          <button type="button" disabled={layerControls.index === layerControls.count - 1} onClick={() => layerControls.onMoveTo(layerControls.count - 1)}>
            {t("inspector.bringToFront")}
          </button>
        </div>
      )}
    </InspectorSection>
  );
}
