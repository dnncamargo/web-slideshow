import type { ContainerElement, Gradient, Length, Presentation } from "@powershow/document-schema";
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
import { getContainerShareablePropertySource } from "../linked-style-inspector";
import { ContainerLinkedPropertyMeta } from "./container-linked-property-meta";

interface ContainerAppearanceSectionProps {
  element: ContainerElement;
  localElement?: ContainerElement;
  presentation?: Pick<Presentation, "linkedStyles">;
  onUpdate: (update: (element: ContainerElement) => ContainerElement) => void;
}

function readOpacityPercentage(value: number | undefined): number {
  return value === undefined ? 100 : value * 100;
}

export function ContainerAppearanceSection({ element, localElement = element, presentation, onUpdate }: ContainerAppearanceSectionProps) {
  const { t } = useStudioI18n();
  const style = element.style;
  const background = style?.background;
  const defaults = resolveEffectiveElementStyleDefaults(element);
  const source = (property: Parameters<typeof getContainerShareablePropertySource>[2]) => getContainerShareablePropertySource(presentation, localElement, property);

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
            secondaryAction={source("style.color").linkedValue === undefined ? { label: t("inspector.useThemeDefault"), onClick: () => updateStyle((current) => ({ ...current, color: undefined })) } : undefined}
          />
        </label>
        <ContainerLinkedPropertyMeta source={source("style.color").source} linkedValue={source("style.color").linkedValue} onReset={source("style.color").source === "local" && source("style.color").linkedValue !== undefined ? () => updateStyle((current) => ({ ...current, color: undefined })) : undefined} />
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
              secondaryAction={source("style.background.color").linkedValue === undefined ? { label: t("inspector.remove"), onClick: () => updateStyle((current) => {
                const nextBackground = current.background === undefined ? undefined : { ...current.background, color: undefined };
                return { ...current, background: nextBackground };
              }) } : undefined}
            />
          </label>
          <ContainerLinkedPropertyMeta source={source("style.background.color").source} linkedValue={source("style.background.color").linkedValue} onReset={source("style.background.color").source === "local" && source("style.background.color").linkedValue !== undefined ? () => updateStyle((current) => ({ ...current, background: current.background === undefined ? undefined : { ...current.background, color: undefined } })) : undefined} />
        </div>

        <ElementGradientControl
          gradient={background?.gradient}
          controlPrefix="container"
          onChange={(gradient: Gradient | undefined) => updateStyle((current) => ({
            ...current,
            background: { ...current.background, gradient },
          }))}
          allowNone={source("style.background.gradient").linkedValue === undefined}
        />
        <ContainerLinkedPropertyMeta source={source("style.background.gradient").source} onReset={source("style.background.gradient").source === "local" && source("style.background.gradient").linkedValue !== undefined ? () => updateStyle((current) => ({ ...current, background: current.background === undefined ? undefined : { ...current.background, gradient: undefined } })) : undefined} />

        <ContainerBackgroundPatternControl
          element={element}
          controlPrefix="container"
          allowNone={source("style.background.pattern").linkedValue === undefined}
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
            value={localElement.style?.borderRadius}
            inheritedValue={(source("style.borderRadius").linkedValue as Length | undefined) ?? defaults.borderRadius}
            inheritedSource={source("style.borderRadius").linkedValue !== undefined ? "linked" : "theme"}
            preserveInheritedUnit
            preferredUnit="px"
            units={["px", "rem"]}
            stepByUnit={{ px: "1", rem: "0.1" }}
            onChange={(borderRadius) => updateStyle((current) => ({ ...current, borderRadius }))}
            onReset={() => updateStyle((current) => ({ ...current, borderRadius: undefined }))}
          />
          <ContainerLinkedPropertyMeta source={source("style.borderRadius").source} linkedValue={source("style.borderRadius").linkedValue} />
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
          <ContainerLinkedPropertyMeta source={source("effect.opacity").source} linkedValue={source("effect.opacity").linkedValue} onReset={source("effect.opacity").source === "local" && source("effect.opacity").linkedValue !== undefined ? () => onUpdate((current) => ({ ...current, effect: current.effect === undefined ? undefined : { ...current.effect, opacity: undefined } })) : undefined} />
        </div>

      <ElementBorderControl
        border={style?.border}
        controlPrefix="container"
        onChange={(border) => updateStyle((current) => ({ ...current, border }))}
        allowNone={source("style.border").linkedValue === undefined}
      />
      <ContainerLinkedPropertyMeta source={source("style.border").source} onReset={source("style.border").source === "local" && source("style.border").linkedValue !== undefined ? () => updateStyle((current) => ({ ...current, border: undefined })) : undefined} />
    </InspectorSection>
  );
}
