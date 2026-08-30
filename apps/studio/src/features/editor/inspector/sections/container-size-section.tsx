import type { ContainerElement, Presentation } from "@powershow/document-schema";

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
import { getContainerShareablePropertySource } from "../linked-style-inspector";
import { ContainerLinkedPropertyMeta } from "./container-linked-property-meta";

type PanelSizeSelection = PanelSizePreset | "custom";

interface ContainerSizeSectionProps {
  element: ContainerElement;
  localElement?: ContainerElement;
  presentation?: Pick<Presentation, "linkedStyles">;

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
  const width = container.layout?.width;

  const height = container.layout?.height;

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
  localElement = element,
  presentation,
  onUpdate,
}: ContainerSizeSectionProps) {
  const { t } = useStudioI18n();
  const source = (property: "layout.width" | "layout.height") => getContainerShareablePropertySource(presentation, localElement, property);

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

              layout: { ...container.layout, width: size.width, height: size.height },
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
              value={readPercentage(element.layout?.width)}
              onChange={(event) => {
                const number = parseOptionalNumber(event.target.value);

                onUpdate((container) => ({
                  ...container,

                  layout: { ...container.layout, width: number === undefined ? undefined : `${number}%` },
                }));
              }}
            />

            <span>%</span>
          </div>
          <ContainerLinkedPropertyMeta source={source("layout.width").source} linkedValue={source("layout.width").linkedValue} onReset={source("layout.width").source === "local" && source("layout.width").linkedValue !== undefined ? () => onUpdate((container) => ({ ...container, layout: { ...container.layout, width: undefined } })) : undefined} />
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
              value={readPercentage(element.layout?.height)}
              onChange={(event) => {
                const number = parseOptionalNumber(event.target.value);

                onUpdate((container) => ({
                  ...container,

                  layout: { ...container.layout, height: number === undefined ? undefined : `${number}%` },
                }));
              }}
            />

            <span>%</span>
          </div>
          <ContainerLinkedPropertyMeta source={source("layout.height").source} linkedValue={source("layout.height").linkedValue} onReset={source("layout.height").source === "local" && source("layout.height").linkedValue !== undefined ? () => onUpdate((container) => ({ ...container, layout: { ...container.layout, height: undefined } })) : undefined} />
        </label>
      </div>
    </InspectorSection>
  );
}

// ============================================================
// END: CONTAINER SIZE SECTION
// ============================================================
