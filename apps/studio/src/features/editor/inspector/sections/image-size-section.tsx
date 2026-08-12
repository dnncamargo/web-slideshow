import type { ImageElement } from "@powershow/document-schema";

import {
  convertAuthoringLength,
  parseAuthoringLength,
  serializeAuthoringLength,
  type AuthoringLengthUnit,
} from "@powershow/theme/element-style-defaults";

import { useStudioI18n } from "@/features/i18n/studio-i18n-context";

import styles from "../../editor-workspace.module.css";

import { InspectorSection } from "../inspector-section";

import type { UpdateElementStyle } from "../inspector-types";

import { EffectiveLengthInput } from "./effective-length-input";

interface ImageSizeSectionProps {
  element: ImageElement;

  onUpdateStyle: UpdateElementStyle;
}

function getInitialUnit(
  value: string | number | undefined,
  preferredUnit: AuthoringLengthUnit,
): AuthoringLengthUnit {
  const parsed = value === undefined ? undefined : parseAuthoringLength(value);

  return parsed && ["px", "%"].includes(parsed.unit)
    ? (parsed.unit as AuthoringLengthUnit)
    : preferredUnit;
}

// ============================================================
// BEGIN: IMAGE SIZE SECTION
// ============================================================

export function ImageSizeSection({
  element,
  onUpdateStyle,
}: ImageSizeSectionProps) {
  const { t } = useStudioI18n();

  const widthUnit = getInitialUnit(element.style?.width, "%");
  const heightUnit = getInitialUnit(element.style?.height, "px");

  return (
    <InspectorSection title={t("inspector.size")}>
      <div className={styles.fieldGrid}>
        <label className={styles.field}>
          <span>{t("inspector.width")}</span>

          <EffectiveLengthInput
            id="image-width"
            name="imageWidth"
            value={element.style?.width}
            inheritedValue={0}
            preferredUnit={widthUnit}
            units={["%", "px"]}
            stepByUnit={{ "%": "1", px: "1" }}
            onChange={(width) => {
              onUpdateStyle((currentStyle) => ({
                ...currentStyle,
                width,
              }));
            }}
            onReset={() => {
              onUpdateStyle((currentStyle) => ({
                ...currentStyle,
                width: undefined,
              }));
            }}
          />
        </label>

        <label className={styles.field}>
          <span>{t("inspector.height")}</span>

          <EffectiveLengthInput
            id="image-height"
            name="imageHeight"
            value={element.style?.height}
            inheritedValue={0}
            preferredUnit={heightUnit}
            units={["%", "px"]}
            stepByUnit={{ "%": "1", px: "1" }}
            onChange={(height) => {
              onUpdateStyle((currentStyle) => ({
                ...currentStyle,
                height,
              }));
            }}
            onReset={() => {
              onUpdateStyle((currentStyle) => ({
                ...currentStyle,
                height: undefined,
              }));
            }}
          />
        </label>
      </div>
    </InspectorSection>
  );
}

// ============================================================
// END: IMAGE SIZE SECTION
// ============================================================
