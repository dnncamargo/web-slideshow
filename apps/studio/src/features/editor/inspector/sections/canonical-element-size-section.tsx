import type { ResizablePositionedLayout } from "@web-slideshow/document-schema";
import {
  parseAuthoringLength,
  type AuthoringLengthUnit,
} from "@web-slideshow/theme/element-style-defaults";

import { useStudioI18n } from "@/features/i18n/studio-i18n-context";

import styles from "../../editor-workspace.module.css";

import { InspectorSection } from "../inspector-section";

import { EffectiveLengthInput } from "./effective-length-input";

interface CanonicalElementSizeSectionProps {
  layout: ResizablePositionedLayout | undefined;
  effectiveLayout?: ResizablePositionedLayout;
  disabledFields?: readonly ("width" | "height")[];
  onUpdateLayout: (
    update: (
      layout: ResizablePositionedLayout | undefined,
    ) => ResizablePositionedLayout | undefined,
  ) => void;
}

function getInitialUnit(
  value: string | number | undefined,
  preferredUnit: AuthoringLengthUnit,
): AuthoringLengthUnit {
  const parsed = value === undefined ? undefined : parseAuthoringLength(value);

  return parsed && ["px", "%"].includes(parsed.unit)
    ? parsed.unit as AuthoringLengthUnit
    : preferredUnit;
}

function updateDimension(
  layout: ResizablePositionedLayout | undefined,
  dimension: "width" | "height",
  value: string | number | undefined,
): ResizablePositionedLayout | undefined {
  const next = { ...(layout ?? {}) };
  if (value === undefined) delete next[dimension];
  else next[dimension] = value;
  return Object.keys(next).length === 0 ? undefined : next;
}

export function CanonicalElementSizeSection({
  layout,
  effectiveLayout,
  disabledFields = [],
  onUpdateLayout,
}: CanonicalElementSizeSectionProps) {
  const { t } = useStudioI18n();
  const displayedLayout = { ...(layout ?? {}), ...(effectiveLayout ?? {}) };
  const widthUnit = getInitialUnit(displayedLayout.width, "%");
  const heightUnit = getInitialUnit(displayedLayout.height, "px");

  return (
    <InspectorSection title={t("inspector.size")}>
      <div className={styles.fieldGrid}>
        <label className={styles.field}>
          <span>{t("inspector.width")}</span>
          <EffectiveLengthInput
            id="element-width"
            name="elementWidth"
            value={displayedLayout.width}
            disabled={disabledFields.includes("width")}
            inheritedValue={0}
            preferredUnit={widthUnit}
            units={["%", "px"]}
            stepByUnit={{ "%": "1", px: "1" }}
            onChange={(width) => onUpdateLayout((current) => updateDimension(current, "width", width))}
            onReset={() => onUpdateLayout((current) => updateDimension(current, "width", undefined))}
          />
        </label>

        <label className={styles.field}>
          <span>{t("inspector.height")}</span>
          <EffectiveLengthInput
            id="element-height"
            name="elementHeight"
            value={displayedLayout.height}
            disabled={disabledFields.includes("height")}
            inheritedValue={0}
            preferredUnit={heightUnit}
            units={["%", "px"]}
            stepByUnit={{ "%": "1", px: "1" }}
            onChange={(height) => onUpdateLayout((current) => updateDimension(current, "height", height))}
            onReset={() => onUpdateLayout((current) => updateDimension(current, "height", undefined))}
          />
        </label>
      </div>
    </InspectorSection>
  );
}
