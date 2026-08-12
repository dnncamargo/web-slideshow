import type { ContainerElement } from "@powershow/document-schema";

import {
  PANEL_SIZE_PRESETS,
  resolvePanelSize,
} from "@powershow/theme/panel-size";

import type { PanelSizePreset } from "@powershow/theme/panel-size";

import { useStudioI18n } from "@/features/i18n/studio-i18n-context";

import styles from "../../editor-workspace.module.css";

import type { UpdateContainer } from "../container-inspector-helpers";

import { parseOptionalNumber } from "../inspector-helpers";

import { InspectorSection } from "../inspector-section";

type PanelSizeSelection = PanelSizePreset | "custom";

interface ContainerSizeSectionProps {
  element: ContainerElement;

  onUpdate: UpdateContainer;
}

function readPercentage(value: string | number | undefined): number | "" {
  if (typeof value !== "string" || !value.endsWith("%")) {
    return "";
  }

  const number = Number(value.slice(0, -1));

  return Number.isFinite(number) ? number : "";
}

function detectPanelSizePreset(
  container: ContainerElement,
): PanelSizeSelection {
  const width = container.style?.width;

  const height = container.style?.height;

  for (const preset of ["small", "medium", "large", "wide", "full"] as const) {
    const dimensions = PANEL_SIZE_PRESETS[preset];

    if (width === dimensions.width && height === dimensions.height) {
      return preset;
    }
  }

  return "custom";
}

// ============================================================
// BEGIN: CONTAINER SIZE SECTION
// ============================================================

export function ContainerSizeSection({
  element,
  onUpdate,
}: ContainerSizeSectionProps) {
  const { t } = useStudioI18n();

  return (
    <InspectorSection title={t("inspector.size")}>
      <label className={styles.field}>
        <span>{t("inspector.preset")}</span>

        <select
          id="container-size-preset"
          name="containerSizePreset"
          value={detectPanelSizePreset(element)}
          onChange={(event) => {
            const value = event.target.value;

            if (value === "custom") {
              return;
            }

            const preset = value as PanelSizePreset;

            const size = resolvePanelSize(preset);

            onUpdate((container) => ({
              ...container,

              style: {
                ...container.style,

                ...size,
              },
            }));
          }}
        >
          <option value="small">{t("inspector.small")}</option>

          <option value="medium">{t("inspector.medium")}</option>

          <option value="large">{t("inspector.large")}</option>

          <option value="wide">{t("inspector.wide")}</option>

          <option value="full">{t("inspector.full")}</option>

          <option value="custom">{t("inspector.custom")}</option>
        </select>
      </label>

      <div className={styles.fieldGrid}>
        <label className={styles.field}>
          <span>{t("inspector.width")}</span>

          <div className={styles.unitInput}>
            <input
              id="container-width"
              name="containerWidth"
              type="number"
              min="1"
              max="100"
              value={readPercentage(element.style?.width)}
              onChange={(event) => {
                const number = parseOptionalNumber(event.target.value);

                onUpdate((container) => ({
                  ...container,

                  style: {
                    ...container.style,

                    width: number === undefined ? undefined : `${number}%`,
                  },
                }));
              }}
            />

            <span>%</span>
          </div>
        </label>

        <label className={styles.field}>
          <span>{t("inspector.height")}</span>

          <div className={styles.unitInput}>
            <input
              id="container-height"
              name="containerHeight"
              type="number"
              min="1"
              max="100"
              value={readPercentage(element.style?.height)}
              onChange={(event) => {
                const number = parseOptionalNumber(event.target.value);

                onUpdate((container) => ({
                  ...container,

                  style: {
                    ...container.style,

                    height: number === undefined ? undefined : `${number}%`,
                  },
                }));
              }}
            />

            <span>%</span>
          </div>
        </label>
      </div>
    </InspectorSection>
  );
}

// ============================================================
// END: CONTAINER SIZE SECTION
// ============================================================
