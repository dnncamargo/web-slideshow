import type { ContainerElement, Gradient } from "@powershow/document-schema";
import { resolveEffectiveElementStyleDefaults } from "@powershow/theme/element-style-defaults";

import { useStudioI18n } from "@/features/i18n/studio-i18n-context";

import styles from "../../editor-workspace.module.css";

import { getControlName, parseOptionalNumber } from "../inspector-helpers";
import { InspectorSection } from "../inspector-section";
import { ColorControl } from "./color-control";
import { ContainerBackgroundPatternControl } from "./container-background-pattern-control";
import { EffectiveLengthInput } from "./effective-length-input";
import { ElementBorderControl } from "./element-border-control";
import { ElementGradientControl } from "./element-gradient-control";

interface ContainerAppearanceSectionProps {
  element: ContainerElement;
  onUpdate: (update: (element: ContainerElement) => ContainerElement) => void;
}

function readOpacityPercentage(value: number | undefined): number {
  return value === undefined ? 100 : value * 100;
}

export function ContainerAppearanceSection({ element, onUpdate }: ContainerAppearanceSectionProps) {
  const { t } = useStudioI18n();
  const style = element.style;
  const background = style?.background;
  const defaults = resolveEffectiveElementStyleDefaults(element);

  function updateStyle(update: (style: NonNullable<ContainerElement["style"]>) => NonNullable<ContainerElement["style"]>) {
    onUpdate((current) => ({ ...current, style: update(current.style ?? {}) }));
  }

  return (
    <InspectorSection title={t("inspector.appearance")}>
      <div className={styles.colorControl}>
        <label className={styles.field}>
          <span>{t("inspector.color")}</span>
          <ColorControl
            id="container-color"
            name={getControlName("container", "Color")}
            value={style?.color}
            onChange={(color) => updateStyle((current) => ({ ...current, color }))}
          />
        </label>
        <button className={styles.secondaryButton} type="button" onClick={() => updateStyle((current) => ({ ...current, color: undefined }))}>
          <span>{t("inspector.useThemeDefault")}</span>
        </button>
      </div>

      <div className={styles.backgroundControls}>
        <div className={styles.colorControl}>
          <label className={styles.field}>
            <span title={t("inspector.backgroundHelp")}>{t("inspector.background")}</span>
            <ColorControl
              id="container-background"
              name={getControlName("container", "Background")}
              value={background?.color}
              onChange={(color) => updateStyle((current) => ({
                ...current,
                background: { ...current.background, color },
              }))}
            />
          </label>
          <button className={styles.secondaryButton} type="button" onClick={() => updateStyle((current) => {
            const nextBackground = current.background === undefined ? undefined : { ...current.background, color: undefined };
            return { ...current, background: nextBackground };
          })}>
            <span>{t("inspector.clearBackground")}</span>
          </button>
        </div>

        <ElementGradientControl
          gradient={background?.gradient}
          controlPrefix="container"
          onChange={(gradient: Gradient | undefined) => updateStyle((current) => ({
            ...current,
            background: { ...current.background, gradient },
          }))}
        />

        <ContainerBackgroundPatternControl
          element={element}
          controlPrefix="container"
          onChange={(pattern, parsedColor) => updateStyle((current) => ({
            ...current,
            background: {
              ...current.background,
              ...(parsedColor === undefined ? {} : { color: parsedColor }),
              pattern,
            },
          }))}
        />
      </div>

      <div className={styles.fieldGrid}>
        <div className={styles.field}>
          <label htmlFor="container-border-radius" title={t("inspector.roundedCornersHelp")}>{t("inspector.roundedCorners")}</label>
          <EffectiveLengthInput
            id="container-border-radius"
            name={getControlName("container", "BorderRadius")}
            min="0"
            value={style?.borderRadius}
            inheritedValue={defaults.borderRadius}
            preferredUnit="px"
            units={["px", "rem"]}
            stepByUnit={{ px: "1", rem: "0.1" }}
            onChange={(borderRadius) => updateStyle((current) => ({ ...current, borderRadius }))}
            onReset={() => updateStyle((current) => ({ ...current, borderRadius: undefined }))}
          />
        </div>

        <label className={styles.field}>
          <span title={t("inspector.opacityHelp")}>{t("inspector.opacity")}</span>
          <div className={styles.unitInput}>
            <input
              id="container-opacity"
              name={getControlName("container", "Opacity")}
              type="number"
              min="0"
              max="100"
              value={readOpacityPercentage(element.effect?.opacity)}
              onChange={(event) => {
                const percentage = parseOptionalNumber(event.target.value);
                onUpdate((current) => ({
                  ...current,
                  effect: {
                    ...current.effect,
                    opacity: percentage === undefined ? undefined : percentage / 100,
                  },
                }));
              }}
            />
            <span>%</span>
          </div>
        </label>
      </div>

      <ElementBorderControl
        border={style?.border}
        controlPrefix="container"
        onChange={(border) => updateStyle((current) => ({ ...current, border }))}
      />
    </InspectorSection>
  );
}
