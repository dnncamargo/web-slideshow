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

import type { ElementLayout } from "@powershow/document-schema";

import { EffectiveLengthInput } from "./effective-length-input";

interface ImageSizeSectionProps {
  element: ImageElement;

  onUpdateLayout: (update: (layout: ElementLayout | undefined) => ElementLayout | undefined) => void;

  preserveImageProportion: boolean;

  onPreserveImageProportionChange: (value: boolean) => void;
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
  onUpdateLayout,
  preserveImageProportion,
  onPreserveImageProportionChange,
}: ImageSizeSectionProps) {
  const { t } = useStudioI18n();

  const widthUnit = getInitialUnit(element.layout?.width, "%");
  const heightUnit = getInitialUnit(element.layout?.height, "px");

  return (
    <InspectorSection title={t("inspector.size")}>
      <label className={styles.checkboxRow}>
        <span title={t("image.preserveProportionHelp")}>
          {t("image.preserveProportion")}
        </span>

        <input
          id="image-preserve-proportion"
          name="imagePreserveProportion"
          type="checkbox"
          checked={preserveImageProportion}
          onChange={(event) => {
            onPreserveImageProportionChange(event.target.checked);
          }}
        />
      </label>

      <div className={styles.fieldGrid}>
        <label className={styles.field}>
          <span>{t("inspector.width")}</span>

          <EffectiveLengthInput
            id="image-width"
            name="imageWidth"
            value={element.layout?.width}
            inheritedValue={0}
            preferredUnit={widthUnit}
            units={["%", "px"]}
            stepByUnit={{ "%": "1", px: "1" }}
            onChange={(width) => {
              onUpdateLayout((currentLayout) => ({
                ...currentLayout,
                width,
              }));
            }}
            onReset={() => {
              onUpdateLayout((currentLayout) => ({
                ...currentLayout,
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
            value={element.layout?.height}
            inheritedValue={0}
            preferredUnit={heightUnit}
            units={["%", "px"]}
            stepByUnit={{ "%": "1", px: "1" }}
            onChange={(height) => {
              onUpdateLayout((currentLayout) => ({
                ...currentLayout,
                height,
              }));
            }}
            onReset={() => {
              onUpdateLayout((currentLayout) => ({
                ...currentLayout,
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
